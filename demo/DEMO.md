# LockPulse: 5-minute demo

Everything replays **recorded** runs from collect run 44361187947 through the **frozen** detectors (hashes in `results/phase4/FROZEN.md`). It needs no Linux and no target program; the venv and `data/collect1` are enough.

```sh
python -m demo.replay <run_id> --speed 1.0      # real time; --speed 0 prints instantly
```

**Reading the screen:**
- Each status line shows the time since the first sample, one letter per thread, the futex count, the M3 score and the B2 silence.
- Thread letters: `R` running, `F` blocked in futex, `I` sleep or I/O, `B` other blocked, `.` not alive.
- `*** ALERT ... ***` appears the moment a detector fires.
- The ground truth (hang, t0, deadlock) is only revealed at the end, followed by each detector's verdict and delay.

**Frozen settings:**

| Detector | Input | Setting |
|---|---|---|
| B1 CPU-silence timeout | Tier P | T = 1.5 s |
| B2 all-threads-in-futex silence | Tier P | T = 50 ms |
| B3 wait-for cycle | Tier F | no threshold |
| B4 progress watchdog | Tier F | T = 1.5 s |
| M1, M2, M3 | Tier P features | thresholds chosen on validation, score above threshold for 3 ticks |

## 0:00 to 0:30, the setup (talk, no command)

- **The problem:** we want to spot a hung multithreaded program from outside, using only `/proc` thread states sampled every 5 ms (Tier P). That means no instrumentation and no knowledge of who holds which lock.
- **The yardstick:** a full `LD_PRELOAD` trace of every lock, condition-variable, semaphore and barrier call (Tier F). It gives us ground truth and two "full-information" baselines.

## 0:30 to 1:30, a hang with no lock cycle (test family)

```sh
python -m demo.replay sem_never_posted-c1-s01 --speed 1.0
```

- **What happens:** the poster thread crashes out early (it goes `.`). The two workers and main sit in `F` (futex: `sem_wait` / `pthread_join`) for good.
- **What to point at:**
  - M1, M2, M3 and B2 alert 20–75 ms after the hang starts.
  - **B3 never fires**: there's no mutex cycle, so a wait-for graph is blind to this hang even though it has the full trace.
  - B1 and B4 fire only after their 1.5 s timeout.
- **Message:** the partial view catches non-mutex hangs that the full-information graph misses (hypothesis H2).

## 1:30 to 2:30, a classic deadlock (test family)

```sh
python -m demo.replay dining_philosophers-c1-s01 --speed 1.0
```

- **What happens:** five philosophers each hold their left fork; all six threads end up in `F`.
- **What to point at:**
  - **B3 fires first, at t0 itself**, and prints the cycle (5 threads).
  - M1 follows at +46 ms, M3 at +56 ms, and B2 and M2 at +61 ms.
- **Message:** on mutex deadlocks the full-information graph is exact and fastest (H3). The partial-view detectors are about 50 ms behind, at a fraction of the overhead (Tier P adds 0–15 % in the overhead table; Tier F adds 21–78 %).

## 2:30 to 3:45, a hard negative: blocked on I/O (test family)

```sh
python -m demo.replay blocked_on_io-c1-s02 --speed 1.0
```

- **What happens:** the writer pauses for over 1.5 s; readers sit in `I` (blocked in `read`) and nothing moves.
- **What to point at:** **B1 and B4 raise a false alarm** at about 2 s. The program is fine and finishes normally. **B2, M2 and M3 stay quiet**: the threads are in `read`, not futex.
- **The numbers on test:** B1 and B4 false-alarm on 23 of 60 `blocked_on_io` runs, M1 on 15, and B2, M2 and M3 on none.

## 3:45 to 4:30, a hard negative: sleeping workers (validation family)

```sh
python -m demo.replay sleeping_workers-c2-s06 --speed 1.0
```

- **What happens:** all threads `nanosleep` for 1–2 s between two work phases (`I` everywhere).
- **What to point at:** B1 and B4 again alert falsely; B2 and the models don't.
- **Why this family matters:** it was moved into the validation split on 2026-11-19, before any test evaluation. Without it, threshold tuning picked T = 50 ms for B1 and B4, which fires on every pause.

## 4:30 to 5:00, the honest summary (show `results/phase4/test_table.md` and `figures/`)

- **On the three unseen test families**, B2 (a hand-made Tier P rule: every thread in futex, no context switch) and the random forest / gradient boosting models are **all perfect**: 91/91 hangs, no false alarms. The models are 14–33 ms faster at the median (B2 69 ms; M1 36, M2 47, M3 55 ms).
- **ML didn't beat the best rule on this benchmark.** It matched it. The rule's known blind spot, a healthy program whose threads all wait in futex (for example an idle thread pool), isn't in the benchmark yet.
- **The `syscall` field is what makes this work.** Without it, both models detect nothing on test (see the ablation table).
