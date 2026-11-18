# LockPulse — Project & Research Guide

## Summary

LockPulse detects hangs in multithreaded C programs from cheap thread-state telemetry, without instrumenting the target and without knowing who holds which lock. It replaces GhostThread AI, whose core problem was that, with full lock instrumentation, a wait-for graph detects mutex deadlocks exactly, which leaves machine learning little to add.

The new framing gives ML a job a graph cannot do. Under low-overhead, partial observability a lock graph cannot be built. The study measures how much of a full-information detector's accuracy a learned model can recover from that partial view, and at what overhead.

| | GhostThread AI (old) | LockPulse (new) |
| --- | --- | --- |
| Model input | Full mutex trace from wrappers | External /proc sampling of thread states only |
| Target | Mutex deadlock only | Hangs: mutex deadlocks, condition-variable lost wakeups, barrier and semaphore hangs |
| Role of full trace | Model input | Ground-truth oracle and upper-bound baseline |
| Instrumentation | Hand-written wrappers in benchmark code | `LD_PRELOAD` shim, works on unmodified binaries |
| Main claim | ML predicts deadlocks | Learned detector on partial telemetry vs. full-information detector: accuracy, delay, overhead |
| Timeline | 8 weeks | 10 days in 4 phases, paper phase after |

## Research question

Can a model trained on uninstrumented, externally sampled thread-state telemetry detect hangs in multithreaded C programs with a delay and false-alarm rate close to a full-instrumentation detector, at a fraction of its overhead?

**Hypotheses**

- H1: Thread states, futex-wait status, CPU-time deltas and context-switch rates separate a hang from heavy contention and long finite waits.
- H2: On condition-variable, barrier and semaphore hangs, the partial-view model beats a mutex wait-for graph, which cannot see them.
- H3: On mutex deadlocks, the full-information graph detector stays best; the gap to the model is small enough to justify the lower overhead.

**Research questions**

1. RQ1: How do detection delay and false alarms of the learned model compare with rule-based detectors on the same partial telemetry?
2. RQ2: How close does the partial-view model come to the full-information graph detector, per hang type?
3. RQ3: What overhead does each telemetry tier add to the target program?
4. RQ4: Does the model generalize to hang families held out from training, and where does it fail?

RQ4 and H3 are written to allow negative results. A finding that the model only helps on non-mutex hangs is still a valid contribution.

## Background: why the old problem was too easy

With full instrumentation of `pthread_mutex_*`, a mutex deadlock is a cycle in the wait-for graph. Checking for a cycle on each blocked request is exact and immediate, so no learned model can beat it on that case.

Even prediction before the deadlock is solved without ML. Lock-order graph algorithms (Goodlock; Linux `lockdep`; Helgrind; ThreadSanitizer's deadlock detector) flag a lock-order inversion from a single run in which the deadlock never actually happens.

The open space is elsewhere:

- **No ownership information.** Production-like monitoring often cannot wrap every lock call. Sampling `/proc` costs almost nothing inside the target but shows only thread states, not who holds what.
- **Hangs without a lock cycle.** A lost condition-variable wakeup, a barrier waiting for a thread that exited, or a semaphore never posted all freeze the program with no mutex cycle to find.
- **Hard negatives.** Heavy contention, long critical sections and threads sleeping on I/O look like a hang to a simple timeout.

Key terms: a *hang* here means every live thread of the process stays blocked with no progress until a watchdog ends the run. A *deadlock* is the subset where the blocking forms a mutex wait-for cycle.

## System architecture

Each benchmark run is recorded by two telemetry tiers at once. Tier P (partial) feeds the model. Tier F (full) supplies ground-truth labels and the upper-bound baseline, and is never a model input.

| Component | Tier | What it does | Language |
| --- | --- | --- | --- |
| Launcher | both | `fork` + `exec` the benchmark as a child, sets `LD_PRELOAD`, starts the sampler, enforces the watchdog | C |
| `liblockpulse.so` shim | F | Interposes `pthread_mutex_*`, `pthread_cond_*`, `sem_*`, `pthread_barrier_wait`; logs request, acquire, release, wait and signal events to per-thread buffers | C |
| `/proc` sampler | P | Every 5 ms reads `/proc/<pid>/task/*/{stat,status,syscall}`; no code runs inside the target | C |
| Labeler (oracle) | F | Finds hang onset from the full trace and the watchdog; marks deadlocks by wait-for cycle | Python |
| Feature extractor | P | Turns sampler snapshots into trailing-window features | Python |
| Models and rules | P | Logistic regression, random forest, gradient boosting; rule baselines | Python |
| Graph detector | F | Online wait-for cycle check; upper bound for mutex deadlocks | Python |
| Evaluator | both | Delay, false alarms, PR-AUC, overhead, per-family results | Python |

For overhead runs, each tier is switched on alone so its cost is measured separately. Data-collection runs use both tiers; report that the shim slightly changes timing.

## Telemetry and features

Tier P reads only what the kernel already exposes per thread; Tier F records every synchronization call.

**Tier P — per-thread fields read each sample**

| Source file | Field | Why it matters |
| --- | --- | --- |
| `/proc/<pid>/task/<tid>/stat` | state (R, S, D), `utime`, `stime` | Blocked vs. running; CPU progress |
| `/proc/<pid>/task/<tid>/status` | `voluntary_ctxt_switches`, `nonvoluntary_ctxt_switches` | Contention churn vs. silence |
| `/proc/<pid>/task/<tid>/syscall` | current syscall number (202 = `futex` on x86-64) | Blocked on a lock-like wait vs. sleep or I/O |
| `/proc/<pid>/task/` | thread count | Threads created or exited |

`/proc/<tid>/syscall` needs ptrace-level access. Running the target as a child of the launcher satisfies the default Yama setting.

**Tier F — event record**

`timestamp_ns, event, tid, obj_id, obj_type, site, wait_ns`, where `event` is one of `REQ`, `ACQ`, `REL`, `COND_WAIT`, `COND_SIGNAL`, `SEM_WAIT`, `SEM_POST`, `BARRIER_ENTER`, `BARRIER_EXIT`, `THREAD_START`, `THREAD_END`.

**Features (trailing window of the last W samples, W tuned on validation)**

- Fraction of threads in state S, and fraction blocked in `futex`
- Fraction of threads blocked in `futex` for the whole window
- Sum and max of CPU-time delta per thread across the window
- Voluntary context-switch rate, and its change vs. the previous window
- Longest time any thread has stayed in `futex` without a switch
- Fraction blocked in non-futex sleeps (`nanosleep`, `read`, `poll`)
- Live thread count and its change

Every feature at time t uses only samples at or before t. Nothing from the trace's future or from the watchdog may enter a row.

## Benchmark suite and ground truth

The suite has 13 scenario families: 7 that hang and 6 hard negatives. Each family takes parameters (threads 2–16, critical-section length, request rate, seed), so 4 configurations × 15 seeds gives about 60 runs per family and roughly 780 runs in total, about one hour of collection at a 5 s cap per run.

| Family | Hangs? | How it is built | Split |
| --- | --- | --- | --- |
| Two-lock inversion | Yes (deadlock) | T1 locks A then B, T2 locks B then A; a barrier forces the bad interleaving | Train |
| Three-thread cycle | Yes (deadlock) | A→B, B→C, C→A | Validation |
| Dining philosophers | Yes (deadlock) | N forks, every philosopher takes left then right | Test |
| Lost wakeup | Yes | `pthread_cond_signal` sent before the waiter waits, with no predicate check | Train |
| Producer–consumer, missing signal | Yes | Consumer waits on a condition the producer never signals on the last item | Train |
| Barrier mismatch | Yes | Barrier sized for N threads, one thread exits early | Validation |
| Semaphore never posted | Yes | Workers `sem_wait` on a semaphore whose poster crashes out | Test |
| High contention | No | 16 threads hammer one mutex with tiny critical sections | Train |
| Long critical section | No | Owner holds a lock for 1–3 s of real work, then releases | Train |
| Consistent lock order | No | Many locks, always taken in global order | Validation |
| Sleeping workers | No | All threads in `nanosleep` for 1–2 s, then resume | Train |
| Producer–consumer, correct | No | Same as the buggy one, with predicate loop and signals | Validation |
| Blocked on I/O | No | Threads `read` a pipe whose writer pauses 2 s | Test |

Test families are never seen during training or tuning. All runs of one family stay in one split.

**Ground truth (from Tier F, never from the template name)**

1. A watchdog ends a run when no thread has recorded `ACQ`, `REL`, `SEM_POST`, `COND_SIGNAL` or `BARRIER_EXIT` for 3 s.
2. Hang onset t0 = the time of the last such progress event, provided every live thread is blocked from t0 on.
3. A hang whose blocked threads form a mutex wait-for cycle at t0 is also tagged deadlock.
4. A watchdog stop that fails check 2 is marked ambiguous, reviewed by hand, and left out of training.
5. A run of a hanging family that finishes normally is labeled healthy. Scheduling decides, not the template.

**Window label:** y = 1 when the window ends at or after t0. Detection delay is then the main measure. An early-warning variant (y = 1 when t0 falls within the next H ms) is reported as exploratory only.

## Baselines and models

The model must beat strong rules on the same Tier P data; otherwise the result is that rules suffice.

| Detector | Input | What it tests |
| --- | --- | --- |
| B1 Fixed timeout | Tier P | Alert when no thread gains CPU time for T ms |
| B2 Futex-silence rule | Tier P | Alert when every thread sits in `futex` with no context switch for T ms; the strongest hand-made rule |
| B3 Wait-for graph | Tier F | Cycle check on each blocked request; exact for mutex deadlocks, blind to other hangs; the upper bound |
| B4 Full-trace progress watchdog | Tier F | No progress event for T ms |
| M1 Logistic regression | Tier P | Simplest learned model |
| M2 Random forest | Tier P | Nonlinear tabular model |
| M3 Gradient boosting | Tier P | Strongest tabular candidate |

Thresholds T and model alert thresholds are tuned on validation families only. No sequence model in the 10-day version: add one later only if M1–M3 leave a clear gap.

**Alert policy:** raise an alert when the score stays above the threshold for 3 consecutive samples. Each alert reports the score, the threads blocked in `futex`, and how long they have been silent. The first version only warns; it never kills threads or forces locks open.

## Evaluation protocol and metrics

Evaluate once on the held-out test families, after all choices are frozen on validation. Report every metric per hang family and per detector, not only averaged.

| Metric | Definition |
| --- | --- |
| Detection rate | Share of hang runs alerted after t0 and before the watchdog stop |
| Detection delay (ms) | First alert time minus t0; median and 90th percentile |
| False alarms per run | Alerts on healthy runs, or before t0 on hang runs |
| PR-AUC | Window-level, across thresholds; hang windows are the minority |
| Overhead (%) | Run-time increase of the target with Tier P only, Tier F only, both; 10 runs each |
| Sampler CPU (%) | CPU used by the sampler process itself |

**Ablations:** drop the `syscall` feature; drop context-switch features; vary sampling interval (2, 5, 20 ms) to show the cost–delay trade-off.

**Integrity rules:** class weights only inside training; no threshold chosen on test; failed and ambiguous runs counted and reported; pin the kernel, compiler, glibc and Python package versions.

## Implementation plan

The runtime (shim, launcher, sampler, benchmarks) is C with a Makefile; labeling, features, training and evaluation are Python with pandas and scikit-learn.

**Repository layout**

```
lockpulse/
  Makefile
  runtime/    shim.c  tracebuf.c  tracebuf.h      -> liblockpulse.so (Tier F)
  launcher/   launcher.c  sampler.c              -> lp-run (Tier P + watchdog)
  bench/      one .c file per scenario family (13)
  configs/    run configuration (family, params, seeds)
  ml/         label.py  features.py  train.py  evaluate.py
  data/raw/{tierP,tierF}/   data/processed/
  results/    tables, figures, run metadata
```

**Tier F shim (core idea)**

```c
#define _GNU_SOURCE
#include <dlfcn.h>
#include <pthread.h>
#include <stdint.h>
#include <time.h>
#include "tracebuf.h"

static int (*real_lock)(pthread_mutex_t *);
static int (*real_unlock)(pthread_mutex_t *);

static uint64_t now_ns(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (uint64_t)ts.tv_sec * 1000000000ull + ts.tv_nsec;
}

static void lp_resolve(void) {
    real_lock   = dlsym(RTLD_NEXT, "pthread_mutex_lock");
    real_unlock = dlsym(RTLD_NEXT, "pthread_mutex_unlock");
}

int pthread_mutex_lock(pthread_mutex_t *m) {
    if (!real_lock) lp_resolve();          /* may be called before constructors */
    uint64_t t0 = now_ns();
    tb_log(EV_REQ, m, t0, 0);              /* per-thread buffer, takes no lock */
    int rc = real_lock(m);
    uint64_t t1 = now_ns();
    tb_log(EV_ACQ, m, t1, t1 - t0);
    return rc;
}

int pthread_mutex_unlock(pthread_mutex_t *m) {
    if (!real_unlock) lp_resolve();
    tb_log(EV_REL, m, now_ns(), 0);
    return real_unlock(m);
}
```

The same pattern covers `pthread_cond_wait`, `pthread_cond_signal`, `sem_wait`, `sem_post` and `pthread_barrier_wait`. Build with `gcc -shared -fPIC -O2 -Wall -o liblockpulse.so shim.c tracebuf.c -ldl`.

**Pitfalls to handle**

- A hanging target is killed by the watchdog, so in-memory buffers would be lost. `tracebuf.c` writes records into a file mapped with `mmap(MAP_SHARED)`, one region per thread; the data survives `SIGKILL` and the launcher reads it afterwards.
- `tb_log` must never call an interposed function (no `printf`, no `malloc` on the hot path), or it recurses into the shim.
- Check every return code; record `EBUSY`, `EDEADLK` and `ETIMEDOUT` rather than assuming success.
- Use `CLOCK_MONOTONIC` in both shim and sampler so the two tiers share one time base.

**Tier P sampler loop**

1. Launcher forks; the child sets `LD_PRELOAD` (or not, per run config) and `exec`s the benchmark.
2. Every 5 ms (`clock_nanosleep` with `TIMER_ABSTIME`, so the period does not drift), list `/proc/<pid>/task/` and read `stat`, `status` and `syscall` for each thread.
3. Append one CSV row per thread: `ts_ns, tid, state, utime, stime, vcsw, nvcsw, syscall_nr`.
4. Watchdog: when the Tier F progress counter has not moved for 3 s, send `SIGKILL`, reap the child, write run metadata (family, params, seed, exit reason, versions).

**Python pipeline**

1. `label.py` — reads Tier F, computes t0, deadlock tag, ambiguous flag per run.
2. `features.py` — builds trailing-window rows from Tier P; attaches label, family and run id.
3. `train.py` — splits by family, tunes on validation, saves models and thresholds.
4. `evaluate.py` — runs every detector on test families; writes the metric tables and figures.

One command, `make all`, rebuilds everything from raw traces to result tables.

## Roadmap: 4 phases in 10 days

The technical work finishes in 10 days in four phases; each phase ends with a gate that must pass before the next starts. The paper phase (wider benchmark, related-work write-up) comes after day 10.

| Phase | Days | Deliverables | Gate to pass |
| --- | --- | --- | --- |
| 1. Foundations | 1–2 | Repo + Makefile; shim for mutex calls; launcher with sampler and watchdog; 4 families (two-lock inversion, lost wakeup, high contention, long critical section) | One hanging and one healthy run each produce aligned Tier P and Tier F traces |
| 2. Benchmark and labels | 3–5 | Shim extended to cond, sem, barrier; all 13 families; ~780 runs collected; `label.py` done; overhead runs | 10 traces checked by hand agree with `label.py`; ambiguous runs < 5% |
| 3. Features and models | 6–8 | `features.py`; baselines B1–B4; models M1–M3; family-grouped split; thresholds tuned on validation | Validation results table complete for all 7 detectors |
| 4. Evaluation and demo | 9–10 | One-shot test evaluation; per-family tables; ablations; overhead table; demo script; short report | `make all` reproduces every number in the report from raw traces |

**Team of five — one owner per deliverable**

| Role | Owns | Busiest in |
| --- | --- | --- |
| Runtime engineer | `liblockpulse.so`, `tracebuf.c`, overhead runs | Phases 1–2 |
| Launcher engineer | Launcher, `/proc` sampler, watchdog, run metadata | Phases 1–2 |
| Benchmark engineer | 13 scenario families, run configs, data collection | Phase 2 |
| ML engineer | `label.py`, `features.py`, `train.py`, models and thresholds | Phases 2–3 |
| Evaluation lead | Baselines B1–B4, `evaluate.py`, ablations, report, related work | Phases 3–4 |

If a phase slips, cut scope rather than days: drop gradient boosting first, then the barrier and semaphore families, then the ablations. Never cut the hard negatives or the family-grouped split.

## Related work and novelty

No novelty claim is made until the literature check below is done; the guide only states what to compare against.

| Line of work | Representative examples | What to record |
| --- | --- | --- |
| Lock-order / potential-deadlock detection | Goodlock; Linux `lockdep`; Valgrind Helgrind; ThreadSanitizer deadlock detector | Needs full instrumentation? Mutex-only? |
| Active deadlock testing | DeadlockFuzzer (PLDI 2009) | Finds bugs before deployment, not at run time |
| Run-time deadlock avoidance | Dimmunix (OSDI 2008) | Uses signatures of past deadlocks |
| Low-overhead production deadlock detection | UNDEAD (ASE 2017) | Overhead, mutex-only scope |
| Learning-based deadlock prediction | Ghorbani & Babamir, Concurrency and Computation: Practice and Experience (2019) | Inputs used, whether ownership info is required |
| Lightweight hang detection | ParaStack (SC 2017, MPI programs); Linux kernel hung-task detector | Signals used, how timeouts are avoided, overhead |

**Search queries:** "hang detection multithreaded programs low overhead", "deadlock detection without instrumentation", "thread state sampling anomaly detection", "condition variable lost wakeup detection", "machine learning hang detection". Use IEEE Xplore, ACM DL, USENIX and Google Scholar; read methods and evaluation, not just abstracts.

**Candidate contribution, if the check confirms a gap:** a labeled, reproducible benchmark of 13 hang and hard-negative families with paired partial and full telemetry, plus a measured answer to how close an uninstrumented learned detector gets to a full-information one, per hang type.

Provisional title: *LockPulse: Detecting Hangs in Multithreaded C Programs from Uninstrumented Thread-State Telemetry*.

## Risks and limitations

| Risk | Effect | Mitigation |
| --- | --- | --- |
| Rule B2 matches the model | ML adds nothing on Tier P | Report it honestly; the per-family comparison with B3 is still a result |
| Synthetic benchmark only | Model learns the generator, not hangs | Family-held-out test; hard negatives; later add reproduced real bugs |
| Shim changes timing | Hangs appear or vanish under tracing | Measure overhead; compare hang rates with and without shim |
| `/proc/<tid>/syscall` not readable | Loses the strongest feature | Launch target as child; ablation shows the loss if missing |
| 5 ms sampling misses short events | Slower detection | Report delay vs. sampling interval (2, 5, 20 ms) |
| Scope | Pthreads on Linux x86-64 only | State it; no claims for kernel locks, other OSes, or distributed systems |

The detector is advisory. It never terminates threads or releases locks, and runs only on the team's own benchmark programs in an isolated machine or VM.

## Definition of done and demo

- [ ] Shim and sampler run on all 13 families; traces from both tiers share one clock
- [ ] Labels for every run come from Tier F, with ambiguous runs listed and excluded
- [ ] B1–B4 and M1–M3 evaluated on held-out test families, per family
- [ ] Detection rate, delay, false alarms, PR-AUC and overhead reported
- [ ] At least one ablation and the sampling-interval trade-off reported
- [ ] `make all` reproduces every table and figure from raw traces
- [ ] Negative results stated plainly in the report

**Demo flow (5 minutes)**

1. Run the lost-wakeup benchmark under `lp-run`: the live view shows threads going silent in `futex`, and LockPulse alerts.
2. Show that the wait-for graph detector stays silent on it, because there is no lock cycle.
3. Run two-lock inversion: both detectors alert; compare their delays.
4. Run the long critical section and the blocked-on-I/O cases: check that the timeout rule fires falsely and LockPulse does not.
5. Show the overhead table: Tier P vs. Tier F.
