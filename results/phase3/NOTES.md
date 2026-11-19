# Phase 3 notes: features and models

Data: collect run 44361187947 (780 runs). One ambiguous run (`prodcons_missing_signal-c1-s01`) is excluded everywhere, leaving 779 runs: 359 train, 240 validation, 180 test.

The **test split was not used**. Features were built for it (the same code runs over every run), but no model, threshold or table touches it, and `python -m ml.evaluate --split test` refuses to run without `--final`.

One command reproduces everything: `python -m ml.phase3 --rebuild-features` (or `make phase3`). It took 105 s on the Windows dev machine: 44 s features, 3 s baselines, 48 s training, 11 s evaluation. Random seeds are fixed, so reruns give identical tables.

## Pre-test design fixes (2026-11-19)

Both changes were made after the first phase-3 run and before any test-split evaluation. They were decided by the project lead.

1. **Split swap: `sleeping_workers` train → validation, `consistent_lock_order` validation → train.**
   - **Why:** the original validation split had no long-pause healthy family. Every grid point reached detection 1.00 with no false alarms, so the tie-break (lower delay) chose the most aggressive setting everywhere (T = 50 ms, smallest window). The train diagnostic then showed B1 and B4 at T = 50 ms false-alarming on 60/60 `sleeping_workers` runs.
   - **What changed:**
     - `configs/phase2.json` (the split field);
     - `labels.csv` (re-labelled, not re-collected: only the `split` column changed, for exactly those 120 runs);
     - the family table in `docs/LockPulse_Guide.md`;
     - `ml/label.py`, so the configured split now wins over the collection-time tag in each run's metadata.
   - The test split is unchanged.
2. **Onset tolerance of one sampler tick (5 ms) for all detectors.** An alert counts as on time if it comes at or after t0 − 5 ms.
   - **Why:** t0 is the last Tier F progress event. In runs with bystander threads, a bystander's last `BARRIER_EXIT` can land a few microseconds after a mutex cycle has already closed, which charged a correct B3 alert as an early false alarm.
   - **What it changed** (validation, at the chosen settings, from `validation_tolerance_effect.csv`): B3 went from 51/120 detections with 9 early false alarms to 60/120 with none. **No other detector changed.** On train, B3 gains 19 `two_lock_inversion` runs for the same reason.
   - Delays can now be slightly negative, down to −5 ms.

## Validation results (barrier_mismatch, three_thread_cycle, prodcons_correct, sleeping_workers)

| Detector | Chosen setting | Detection | Median / p90 delay | False alarms (healthy + early) | PR-AUC |
|---|---|---:|---:|---:|---:|
| B1 fixed timeout (P) | T = 1500 ms | 120/120 | 1511 / 1520 ms | 7 + 0 (2.9 %) | 0.954 |
| B2 futex silence (P) | T = 50 ms | 120/120 | 66 / 75 ms | 0 + 0 | 0.999 |
| B3 wait-for graph (F) | no threshold | 60/120 | 0 / 0.3 ms | 0 + 0 | – |
| B4 progress watchdog (F) | T = 1500 ms | 120/120 | 1512 / 1515 ms | 7 + 0 (2.9 %) | – |
| M1 logistic regression | W = 10, C = 10, threshold 0.99958 | 120/120 | 54 / 119 ms | 11 + 0 (4.6 %) | 0.997 |
| M2 random forest | W = 10, depth 6, leaf 5, threshold 0.9947 | 120/120 | 60 / 94 ms | 0 + 0 | 0.998 |
| M3 gradient boosting | W = 10, lr 0.1, 31 leaves, threshold 0.999994 | 120/120 | 58 / 67 ms | 0 + 0 | 0.998 |

Per family (all in `validation_table.md`):
- **Hang families:** every detector except B3 finds all 60 `barrier_mismatch` and all 60 `three_thread_cycle` runs. B3 finds all 60 `three_thread_cycle` runs and none of the `barrier_mismatch` runs (not a mutex hang).
- **Healthy families:** `prodcons_correct` has no false alarms for any detector. All false alarms are on `sleeping_workers`: B1 7/60, B4 7/60, M1 11/60, and 0/60 for B2, M2 and M3.

## Do the grids separate now? Yes

**B1 and B4 (T sweep, validation):**

| T (ms) | 50–1000 | 1500 | 2000 |
|---|---|---|---|
| False-alarm rate | 25 % (all 60 `sleeping_workers` runs) | 2.9 % (7 runs) | 0 % |
| Detection | 1.00 | 1.00 | 1.00 |

The rule takes the smallest feasible T, 1500 ms, so the median delay jumps from about 60 ms to about 1510 ms. In `sleeping_workers` each thread sleeps its own seeded 1.0–2.0 s, and the silence ends when the first thread wakes. The 7 remaining false alarms are therefore runs where even the shortest sleep exceeded about 1.5 s; T = 2000 ms would remove them.

**B2:** 0 false alarms at every T. Sleeping threads sit in `clock_nanosleep`, never in futex, so `sleeping_workers` can't trigger it; it keeps T = 50 ms.

**Models (`model_search.csv`):**
- **M1** now presses against the 5 % bound: false-alarm rates of 2.9–5.0 % across its grid. At W = 40, one candidate drops to 0.79 detection.
- **M2 and M3** separate mostly through delay (W = 10: about 60 ms; W = 20: about 90 ms; W = 40: 120–160 ms) and a few W = 40 / W = 20 candidates with 2–5 % false alarms.
- **W = 10 still wins** for all three models, now on delay with false alarms in bounds, not on a tie.
- The chosen thresholds for M2 and M3 are very close to 1.0 (0.9947 and 0.999994). The models are confident, but the margin to a `sleeping_workers` false alarm is small, and that's worth watching on test.

**Feature importance** (permutation, validation, average precision):
- M2 relies almost entirely on `frac_futex`.
- M3 now spreads over `frac_futex_whole`, `frac_S` and `cpu_util_sum`, about 0.05–0.06 each. That's what lets it tell "everyone asleep in nanosleep" from "everyone stuck in futex".
- The features are correlated, so permutation importance spreads credit unevenly; don't over-read the rankings.

## Train diagnostic (`train_table.md`; in-sample for M1–M3, not used for any choice)

At the validation-chosen settings, B4 (T = 1500 ms) false-alarms on 42/60 `long_critical_section` runs. Their 1.0–2.5 s lock holds produce no Tier F progress for longer than 1.5 s. No other detector raises a false alarm on train: B1 doesn't fire there because the holder keeps burning CPU, and B2 doesn't fire because the holder is running, not in futex. `long_critical_section` stays in train, so validation can't see this B4 weakness.

## Where the model loses to (or doesn't beat) the rules

- **B2 (all threads in futex, no context switch) is as good as the best models on validation.** It matches M2 and M3 on detection (120/120) and false alarms (none). M2 and M3 are only 6–8 ms faster at the median (58–60 ms versus 66 ms), about one or two sampler ticks. At p90, B2 (75 ms) beats M2 (94 ms) and trails M3 (67 ms).
  - So **on validation, a hand-made Tier P rule essentially suffices; the models add a tick or two of speed, nothing in detection or false alarms.**
  - The models' edge is only over the weaker rules: B1 and B4 pay about 1.5 s of delay to avoid the sleep false alarms.
- **M1 is the weakest learned detector:** 11 false alarms, and a p90 of 119 ms.
- **Remaining risk for phase 4:** B2's one blind spot is a healthy program where every thread waits in futex for a long time without context switches. No validation family has that pattern. It's the same risk the guide names for the test family `sem_never_posted` versus a healthy semaphore wait, and for `blocked_on_io` (readers in `read`, where B2 should stay quiet). H1 and H2 can only be decided on the test split in phase 4.
- **`futex_silence_ms` is weak as specified** ("longest run any thread has spent in futex with no switch"). Main sits in `pthread_join` all run, so it grows in healthy runs too. `frac_futex_whole` carries the useful signal.

## Deviations from the guide / the phase-3 request

- **Alert semantics: only the first alert counts.** A hang run whose first alert comes before t0 − 5 ms is an early false alarm and not detected. That makes "delay = first alert − t0" well defined.
- **Training uses every 4th tick of each train run.** Consecutive 5 ms ticks are nearly identical, and this cuts fit time about 4× without dropping any run. Validation is scored on every tick.
- **The rules can alert from the first tick** of a run, while models wait out their W warm-up ticks (50 ms at W = 10).
- **PR-AUC is computed for every detector on the same tick set** (validation ticks ≥ 40), so the numbers are comparable. B3 and B4 have no PR-AUC (Tier F).
- **Unit for the CPU features:** they use CLK_TCK from the metadata (100, i.e. 10 ms per utime/stime tick) and express CPU as a utilisation fraction.
- **Runtime environment:** the local run used Python 3.14.6 with numpy 2.4.6, pandas 2.3.3, scikit-learn 1.9.0 and joblib 1.5.3, pinned in `requirements-ml.txt`. CI runs only the unit tests (numpy and pandas from apt, no scikit-learn).
