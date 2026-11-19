# Phase 3 notes: features and models

Data: collect run 44361187947 (780 runs). One ambiguous run (`prodcons_missing_signal-c1-s01`) is excluded everywhere, leaving 779 runs: 359 train, 240 validation, 180 test.

The **test split was not used**. Features were built for it (the same code runs over every run), but no model, threshold or table touches it, and `python -m ml.evaluate --split test` refuses to run without `--final`.

One command reproduces everything: `python -m ml.phase3` (or `make phase3`). It took 141 s on the Windows dev machine: 64 s features, 5 s baselines, 63 s training, 9 s evaluation. Two runs gave identical tables, since every random seed is fixed.

## What was chosen, and why

Every choice below was made on validation with one rule: maximise the detection rate while the false-alarm rate stays ≤ 5 % of runs, and break ties by the lower median delay.

| Detector | Chosen setting | Validation: detection / false-alarm rate / median delay (p90) |
|---|---|---|
| B1 fixed timeout (Tier P) | T = 50 ms | 1.00 / 0.00 / 61 ms (70) |
| B2 futex silence (Tier P) | T = 50 ms | 1.00 / 0.00 / 66 ms (75) |
| B3 wait-for graph (Tier F) | no threshold | 0.43 / 0.04 / 0 ms |
| B4 progress watchdog (Tier F) | T = 50 ms | 1.00 / 0.00 / 62 ms (65) |
| M1 logistic regression | W = 10 ticks (50 ms), C = 10, threshold 0.874 | 1.00 / 0.00 / 39 ms (58) |
| M2 random forest | W = 10, max_depth 6, min_samples_leaf 5, threshold 0.506 | 1.00 / 0.00 / 45 ms (57) |
| M3 gradient boosting | W = 10, learning_rate 0.05, max_leaf_nodes 31, threshold 0.987 | 1.00 / 0.00 / 48 ms (59) |

- **Why W = 10 and T = 50 ms everywhere:** every candidate in every grid reached detection 1.00 with no false alarms on validation (see `model_search.csv` and `baseline_sweeps.csv`). So the rule fell through to its tie-break, the median delay, and the fastest option always wins: the smallest window and the smallest T.
- **The other hyperparameters barely matter:** within one W, all candidates sit within 0.002 PR-AUC of each other.
- **The models are 15–25 ms faster than the Tier P rules on validation.** Most of that gap is the rules' 50 ms minimum T plus the 3-tick alert policy, not something the rules can't see.
- **Features that matter:** permutation importance on validation (average precision) is dominated by the futex fractions, `frac_futex` (M2) and `frac_futex_whole` (M3). Everything else is below 0.002. The features are strongly correlated, so permutation importance spreads credit unevenly, and these rankings shouldn't be over-read.

## Surprises and caveats

1. **Validation can't separate the detectors.** Its healthy families (`consistent_lock_order`, `prodcons_correct`) are busy all the time and never pause. The guide's split puts every long-pause hard negative in train or test: `long_critical_section` and `sleeping_workers` in train, `blocked_on_io` in test. With no pause in validation, every threshold-tuned detector picks its most aggressive setting.
   - The train split shows what that costs, using `train_table.md` (a diagnostic only: in-sample for M1–M3, out-of-sample for the rules, and not used for any choice):

     | Detector at its validation-chosen setting | `sleeping_workers` false alarms | `long_critical_section` false alarms |
     |---|---|---|
     | B1 (T = 50 ms) | 60 / 60 | 0 / 60 |
     | B4 (T = 50 ms) | 60 / 60 | 60 / 60 |
     | B2 | 0 / 60 | 0 / 60 |
     | M1–M3 | 0–5 / 60 | 0–5 / 60 |

   - B2 survives because those pauses happen in `clock_nanosleep` or on a running holder, not with every thread in futex.
   - Expect B1 and B4 to fire on every `blocked_on_io` test run in phase 4.
   - This is a property of the split, not a bug. Whether to move one long-pause family into validation, or tune T on train for the rules, is a decision for you before phase 4, because it changes the guide's split table.
2. **B3 detects the mutex deadlocks, but 9 of 60 `three_thread_cycle` runs count as early false alarms.**
   - In those runs (configs c2 and c3, which have bystander threads), the cycle closes 0–6 µs before a bystander's `BARRIER_EXIT`.
   - The oracle sets t0 to the last progress event, so it lands after the cycle has already closed.
   - Under the rule ("alert before t0 is a false alarm") B3 is charged for being right a few microseconds early. Its remaining 51 alerts arrive within 0.4 ms of t0.
   - It's blind to `barrier_mismatch` (0 / 60), as expected.
   - The same artifact shows on train `two_lock_inversion` (19 / 60).
   - A tolerance of one sampler tick around t0 would remove it. I left the rule as specified.
3. **`futex_silence_ms` is weak as specified** ("longest run any thread has spent in futex with no switch"). In every run, main sits in `pthread_join` (futex, no switches) for the whole run, so the feature grows in healthy runs too. `frac_futex_whole` carries the useful version of the signal.
4. **The validation numbers are near the ceiling** (PR-AUC 0.999–1.000 for B1, B2 and M1–M3). The real comparison happens in phase 4 on the held-out families, especially `blocked_on_io` (I/O pauses) and `sem_never_posted` (a hang without any mutex).

## Where the model loses to (or doesn't beat) the rules

- **On validation, B2 matches the models** on detection and false alarms. It loses only on delay (about 66 ms vs 39–48 ms), and that gap comes mostly from the rule's T and K settings. On these data, then, the honest statement is: **rules suffice on validation; the models add speed but no detection.**
- **The only place the models clearly do better is the train diagnostic** (B1 and B4 false-alarm on long pauses), and that comparison is unfair: those families are the models' own training data.
- **H1 and H2 (hard negatives, non-mutex hangs) can only be decided on the test split in phase 4.**

## Deviations from the guide / the phase-3 request

- **Alert semantics: only the first alert counts.** A hang run whose first alert comes before t0 is a false alarm and is not counted as detected, even if the condition is still true after t0. That makes "delay = first alert − t0" well defined.
- **Training uses every 4th tick of each train run.** Consecutive 5 ms ticks are nearly identical, and this cuts fit time about 4× without dropping any run. Validation is scored on every tick.
- **The rules' T-sweep runs on all ticks of a run.** B1, B2 and B4 can alert from the first tick, while models can only alert after their W warm-up ticks. With W = 10 this is a 50 ms handicap for the models, and it doesn't affect any validation result.
- **PR-AUC is computed for every detector on the same tick set** (validation ticks ≥ 40, the largest W), so the numbers are comparable. B3 and B4 have no PR-AUC, as requested (B4 has a continuous score, but it's Tier F).
- **Unit for the CPU features:** they assume CLK_TCK from the metadata (100, i.e. 10 ms per utime/stime tick) and express CPU as a utilisation fraction, so they are scale-free.
- **Runtime environment:** the local run used Python 3.14.6 with numpy 2.4.6, pandas 2.3.3, scikit-learn 1.9.0 and joblib 1.5.3, pinned in `requirements-ml.txt`. CI runs only the unit tests (numpy and pandas from apt, no scikit-learn).
