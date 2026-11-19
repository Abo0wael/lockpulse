# LockPulse: detecting hangs in multithreaded C programs from uninstrumented thread-state telemetry

## Summary

LockPulse samples thread states from `/proc`, with nothing inside the target, and uses them to decide whether a pthreads program has hung. On three held-out test families (91 hangs, 89 healthy runs), the outcome is:
- A hand-made rule on that telemetry (B2: every live thread blocked in futex with no context switch for 50 ms) detects every hang with no false alarms.
- So do a random forest (M2) and a gradient-boosting model (M3) on the same telemetry.
- The models alert 14–22 ms earlier at the median.
- The full-information mutex wait-for graph (B3) is exact and immediate on the deadlock family, but blind to the semaphore hang.
- Simple timeouts (B1 CPU silence, B4 progress watchdog) need T = 1.5 s to survive the validation hard negatives, and still raise false alarms on 38 % of the I/O-stall runs.

**Honest bottom line:** on this benchmark the learned models match, but don't beat, the best hand-made rule. The `/proc/<tid>/syscall` field is what makes both work.

## 1. Problem

- **The question:** can a model trained on cheap, externally sampled thread-state telemetry detect hangs as well as a full-instrumentation detector, at a fraction of its overhead?
- **What counts as a hang:** deadlocks, lost wakeups, barrier and semaphore hangs.
- **Why it's interesting:** with full lock instrumentation, a mutex deadlock is a cycle in the wait-for graph. That check is exact and immediate, which leaves machine learning nothing to add. The open questions are elsewhere:
  - without ownership information;
  - for hangs with no lock cycle;
  - against hard negatives that look like hangs from outside (heavy contention, long critical sections, sleeping or I/O-blocked threads).

## 2. System

| Part | What it does |
|---|---|
| Launcher (`lp-run`, C) | Forks and execs the benchmark as a child, runs the sampler and the watchdog, writes run metadata. |
| Tier P (partial, the only model input) | Every 5 ms (absolute-time pacing) reads `/proc/<pid>/task/<tid>/{stat,status,syscall}`: state, utime/stime, voluntary/involuntary context switches, current syscall. Nothing runs inside the target. |
| Tier F (full, labels and baselines only) | An `LD_PRELOAD` shim (`liblockpulse.so`) interposes `pthread_mutex_*`, `pthread_cond_*` (via `dlvsym` at `GLIBC_2.3.2`), `sem_*` and `pthread_barrier_wait`. It logs every request, acquire, release, wait, signal, post and barrier event into a `MAP_SHARED` per-thread ring, so the trace survives `SIGKILL`. |
| Watchdog | Kills the target when the Tier F progress counter hasn't moved for 3 s. |
| Clock | Both tiers use `CLOCK_MONOTONIC` ns. |

## 3. Benchmark

- **13 scenario families**, 7 that hang and 6 hard negatives. Each family has 4 parameter configurations × 15 seeds, for 780 runs collected on GitHub Actions (`ubuntu-26.04`, run 44361187947).
- **Hang families:** 3 configs force the bug with barriers or semaphores; the fourth (`--force 0`) leaves it to the scheduler.
- **Labels** come from the Tier F oracle (`ml/label.py`). t0 is the last progress event, given every live thread is blocked from then on; deadlock means a wait-for cycle at t0.
- **Totals:** 381 hang runs (166 deadlocks), 398 healthy, 1 ambiguous (excluded everywhere).

| Split | Hang families | Healthy families | Runs |
|---|---|---|---:|
| Train | two_lock_inversion (deadlock), lost_wakeup, prodcons_missing_signal | high_contention, long_critical_section, consistent_lock_order | 359 |
| Validation | three_thread_cycle (deadlock), barrier_mismatch | prodcons_correct, sleeping_workers | 240 |
| Test (held out until phase 4) | dining_philosophers (deadlock), sem_never_posted | blocked_on_io | 180 |

**Dated split fix (2026-11-19, before any test evaluation):** `sleeping_workers` moved from train to validation, and `consistent_lock_order` from validation to train.
- In the original split, validation had no long-pause healthy family. Every threshold therefore tied, and the tie-break chose T = 50 ms for B1 and B4, which fires on every pause.
- The fix needed only a re-label (the split column), no re-collection.
- The test split is unchanged.

## 4. Method

- **Features (Tier P only, `ml/features.py`):**
  - One row per 5 ms tick, over a trailing window of W ticks (W ∈ {10, 20, 40}).
  - Fractions of threads in state S, in futex, in futex for the whole window, and in sleep or I/O syscalls.
  - CPU utilisation (sum and max), voluntary and involuntary context-switch rates and their change, longest futex silence, live thread count and its change.
  - The features are causal: a unit test checks that appending future samples never changes earlier rows.
  - Family, config, seed, split, duration and exit reason are never inputs.
- **Baselines:**
  - **B1 (Tier P):** the CPU time of all threads hasn't grown for T ms.
  - **B2 (Tier P):** every live thread has been in futex with no context switch for T ms.
  - **B3 (Tier F):** alert at the `MUTEX_REQ` that closes a wait-for cycle. Ownership includes the mutex release and re-acquire inside `pthread_cond_wait`.
  - **B4 (Tier F):** no progress event for T ms.
- **Models:**
  - **M1:** logistic regression.
  - **M2:** random forest.
  - **M3:** histogram gradient boosting.
  - All three use balanced class weights and fixed seeds, and are trained on train runs (every 4th tick).
- **Alert policy and threshold rule:**
  - The first alert is the first tick where the score has stayed at or above the threshold for 3 consecutive ticks.
  - An alert at or after t0 − 5 ms (one tick) counts as on time; earlier, it's a false alarm. A healthy run with any alert is a false alarm.
  - On validation, every detector picks its threshold, T, W and hyperparameters to **maximise the detection rate subject to false alarms ≤ 5 % of runs**, then the lower median delay.
- **Freeze:** the chosen settings and models were frozen (SHA-256 in `FROZEN.md`) and evaluated once on test.

## 5. Results

### 5.1 Validation (where every choice was made)

| Detector | Setting | Detected | Delay median / p90 | False alarms |
|---|---|---:|---:|---:|
| B1 CPU silence (P) | T = 1500 ms | 120/120 | 1511 / 1520 ms | 7 (`sleeping_workers`) |
| B2 futex silence (P) | T = 50 ms | 120/120 | 66 / 75 ms | 0 |
| B3 wait-for graph (F) | none | 60/120 | 0 / 0.3 ms | 0 |
| B4 progress watchdog (F) | T = 1500 ms | 120/120 | 1512 / 1515 ms | 7 (`sleeping_workers`) |
| M1 logistic regression | W = 50 ms | 120/120 | 54 / 119 ms | 11 (`sleeping_workers`) |
| M2 random forest | W = 50 ms | 120/120 | 60 / 94 ms | 0 |
| M3 gradient boosting | W = 50 ms | 120/120 | 58 / 67 ms | 0 |

Full table: `results/phase3/validation_table.md`.

### 5.2 Test, one shot with the frozen detectors

`test_table.md`: 180 runs, 91 hangs (46 dining-philosophers deadlocks, 45 semaphore hangs).

| Detector | Detected | Delay median / p90 | False alarms (`blocked_on_io` / other) | PR-AUC |
|---|---:|---:|---:|---:|
| B1 CPU silence (P), T = 1.5 s | 91/91 | 1512 / 1525 ms | 23/60 / 0 | 0.918 |
| B2 futex silence (P), T = 50 ms | 91/91 | 69 / 83 ms | 0 / 0 | 0.998 |
| B3 wait-for graph (F) | 46/91: dining 46/46, sem 0/45 | 0 / 0.001 ms | 0 / 0 | – |
| B4 progress watchdog (F), T = 1.5 s | 91/91 | 1513 / 1515 ms | 23/60 / 0 | – |
| M1 logistic regression | 91/91 | 36 / 110 ms | 15/60 / 0 | 0.991 |
| M2 random forest | 91/91 | 47 / 65 ms | 0 / 0 | 0.999 |
| M3 gradient boosting | 91/91 | 55 / 60 ms | 0 / 0 | 0.999 |

- **The onset tolerance changed no test outcome** (`test_tolerance_effect.csv`).
- **Figures:**
  - `figures/delay_by_detector_test.png`: delay box plot, log scale;
  - `figures/false_alarms_by_family_test.png`;
  - `figures/timeline_sem_never_posted-c1-s01.png`: per-thread states, M3 score and B2 silence, with t0 and every alert marked.

### 5.3 Ablations (choices on validation, numbers on test; `ablation_table.md`)

| Ablation | M2 test detected, delay | M3 test detected, delay | Notes |
|---|---|---|---|
| All 13 features | 91/91, 47 ms | 91/91, 55 ms | Equal to the frozen models. |
| Without syscall features | **0/91** | **0/91** | On validation, every threshold that detects hangs also flags most `sleeping_workers` runs, so the 5 % rule picks a threshold that never fires. |
| Without context-switch features | 91/91, 56 ms | 91/91, 55 ms | No loss. |
| Only state + CPU | **0/91** | **0/91** | Same failure as without syscall. |

Sampling interval (100 ms window; 2 ms not included, as it would need re-collection):

| Interval | M2 | M3 | B2 |
|---|---|---|---|
| 5 ms | 91/91, 34 / 72 ms | 91/91, 68 / 95 ms | 91/91, 69 / 83 ms |
| 10 ms | 91/91, 45 / 81 ms | 91/91, 103 / 138 ms | 91/91, 85 / 98 ms |
| 20 ms | 91/91, 72 / 105 ms | 91/91, 85 / 110 ms | 91/91, 116 / 129 ms |

None of these configurations raised a false alarm on test. Coarser sampling costs delay: B2's median goes from 69 to 85 to 116 ms, because the silence is measured in coarser steps and the 3-tick alert policy takes 3 × the interval. It doesn't cost detection or false alarms.

### 5.4 Overhead (`overhead_table.md`; fixed-work runs, 10 reps, from the collect artifact)

| Benchmark | Tier P (sampler) | Tier F (shim) | Both | Launcher CPU (P / PF) |
|---|---:|---:|---:|---:|
| high_contention (16 threads, 160k lock ops) | 1.15× | 1.78× | 1.73× | 7.1 % / 12.1 % |
| prodcons_correct (4 threads, 10k items) | 1.00× | 1.21× | 1.21× | 6.8 % / 7.2 % |

- **Caveat:** `high_contention`'s untraced IQR is 7.9 ms on a 30.7 ms median, so its 1.15× Tier P figure is within noise.
- **Figure:** `figures/overhead_slowdown.png`.

## 6. Discussion

- **Where rules suffice:**
  - B2 detects every test hang, mutex or not, with no false alarms. It's within 14–22 ms of M2 and M3 at the median.
  - The decisive information is the syscall field: "every thread parked in futex and silent" separates a hang from a busy workload, a sleeping workload and an I/O stall at once.
  - The feature ablation shows the same from the learning side: remove the syscall features and the models can't tell a hang from `sleeping_workers` at all.
- **Where ML helps:**
  - M2 and M3 alert a little earlier than B2: 47 and 55 ms vs 69 ms median on test.
  - Unlike B1, B4 and M1, they don't false-alarm on the I/O stalls.
  - The gain over the best rule is speed, not detection or false alarms. Hypothesis H1 (Tier P features separate hangs from hard negatives) holds, but a single hand-made rule over those features already does it. **The data doesn't support a claim that ML is needed here.**
- **Where ML does worse:** M1 (linear) false-alarms on 25 % of `blocked_on_io` runs. The non-linear models are needed to beat the timeouts, not the futex rule.
- **B3's blind spot (H2):**
  - The full-information wait-for graph is exact and immediate on the deadlock family (46/46, alert at t0).
  - It finds 0 of 45 semaphore hangs and, on validation, 0 of 60 barrier hangs. A lock graph can't see hangs without a lock cycle, while the Tier P detectors see all of them.
- **H3 (mutex deadlocks):** B3 is the fastest there (about 0 ms vs about 45–60 ms). The gap to the Tier P detectors is small next to the overhead difference: Tier P costs 0–15 %, Tier F 21–78 %.
- **Timeouts:** B1 and B4 aren't competitive. Tuned on validation to tolerate 1–2 s sleeps, they cost about 1.5 s of delay and still fail on `blocked_on_io` pauses. On train, B4 also fails on `long_critical_section`.

## 7. Limitations

- **The benchmark is synthetic:** 13 small programs with forced interleavings. The detectors may have learned this generator, not hangs in general, although the family-held-out test is meant to check that.
- **The rule's blind spot is untested:**
  - No healthy family has all threads waiting in futex for long, for example an idle thread pool waiting for work, or a server waiting on condition variables. B2 would false-alarm on it.
  - Whether M2 or M3 would do better is untested. This is the most important missing hard negative.
- **Every hang family hangs completely:** every live thread is blocked. Partial hangs, where one subsystem is stuck and others keep working, aren't covered.
- **Test is small:** 91 hangs and 89 healthy runs in 3 families. Perfect scores have wide uncertainty; a 0/89 false-alarm count still allows a true rate of a few percent.
- **CI-machine timing:**
  - All data comes from shared GitHub Actions VMs (4 vCPUs). Scheduling noise affects the timing features, the `--force 0` outcomes and the overhead numbers.
  - The overhead runs are short (30–60 ms) and only 10 per mode.
- **Platform scope:** Linux x86-64 and glibc pthreads only.
- **No partial-information alternative was tried** beyond `/proc`, such as eBPF or perf sampling.

## 8. Future work

1. **Add the missing hard negatives:**
   - an idle thread pool (all threads in futex, healthy);
   - condition-variable servers with long idle periods;
   - a partial hang.

   Re-test B2 against the models. This is where ML could actually show value.
2. **Real programs:** reproduce real hang bugs (e.g. from bug databases of open-source C servers) as a second, non-synthetic test set.
3. **Sampling interval:** a true 2 ms collection, and a lower-overhead sampler (fewer files per tick, or reading only `stat`/`syscall`).
4. **Early warning (exploratory in the guide):** predict t0 before it happens, for example from lock-holding patterns before a deadlock.
5. **Uncertainty:** confidence intervals over more seeds and runs per family, and a run on dedicated hardware for the overhead numbers.
6. **Interpretability:** per-alert explanations (which threads are silent in futex, and for how long) that are as clear as B3's cycle report.

## Reproducing

`python -m ml.phase4` regenerates every table and figure here from `data/collect1` and the frozen detectors. `make reproduce` also retrains phase 3 from the raw traces and checks that it reproduces the frozen models byte for byte. The README lists the exact steps from a fresh clone. The replay demo is `python -m demo.replay <run_id>`; `demo/DEMO.md` has the 5-minute script.
