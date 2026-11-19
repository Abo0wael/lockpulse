# LockPulse phase 3 - train results

Split: train; ambiguous excluded: 1. Settings from chosen.json (picked on validation).
DIAGNOSTIC ONLY: M1-M3 were fitted on these runs (in-sample scores); the rules B1-B4 were not. Nothing in this table was used for any choice.

| detector | input | setting | scope | runs | hang_runs | detected | detection_rate | delay_median_ms | delay_p90_ms | fa_healthy | fa_early | fa_rate | pr_auc |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B1 fixed timeout | Tier P | T=50 ms | overall | 359 | 170 | 170 | 1.000 | 59 | 64 | 60 | 0 | 0.167 | 0.967 |
| B1 fixed timeout | Tier P | T=50 ms | high_contention | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B1 fixed timeout | Tier P | T=50 ms | long_critical_section | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B1 fixed timeout | Tier P | T=50 ms | lost_wakeup | 60 | 51 | 51 | 1.000 | 57 | 62 | 0 | 0 | 0.000 | 1.000 |
| B1 fixed timeout | Tier P | T=50 ms | prodcons_missing_signal | 59 | 59 | 59 | 1.000 | 57 | 62 | 0 | 0 | 0.000 | 1.000 |
| B1 fixed timeout | Tier P | T=50 ms | sleeping_workers | 60 | 0 | 0 |  |  |  | 60 | 0 | 1.000 |  |
| B1 fixed timeout | Tier P | T=50 ms | two_lock_inversion | 60 | 60 | 60 | 1.000 | 61 | 66 | 0 | 0 | 0.000 | 1.000 |
| B2 futex silence | Tier P | T=50 ms | overall | 359 | 170 | 170 | 1.000 | 64 | 69 | 0 | 0 | 0.000 | 0.999 |
| B2 futex silence | Tier P | T=50 ms | high_contention | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B2 futex silence | Tier P | T=50 ms | long_critical_section | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B2 futex silence | Tier P | T=50 ms | lost_wakeup | 60 | 51 | 51 | 1.000 | 63 | 67 | 0 | 0 | 0.000 | 1.000 |
| B2 futex silence | Tier P | T=50 ms | prodcons_missing_signal | 59 | 59 | 59 | 1.000 | 64 | 69 | 0 | 0 | 0.000 | 1.000 |
| B2 futex silence | Tier P | T=50 ms | sleeping_workers | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B2 futex silence | Tier P | T=50 ms | two_lock_inversion | 60 | 60 | 60 | 1.000 | 64 | 69 | 0 | 0 | 0.000 | 1.000 |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | overall | 359 | 170 | 41 | 0.241 | 0 | 0 | 0 | 19 | 0.053 |  |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | high_contention | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | long_critical_section | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | lost_wakeup | 60 | 51 | 0 | 0.000 |  |  | 0 | 0 | 0.000 |  |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | prodcons_missing_signal | 59 | 59 | 0 | 0.000 |  |  | 0 | 0 | 0.000 |  |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | sleeping_workers | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | two_lock_inversion | 60 | 60 | 41 | 0.683 | 0 | 0 | 0 | 19 | 0.317 |  |
| B4 progress watchdog | Tier F | T=50 ms | overall | 359 | 170 | 170 | 1.000 | 63 | 65 | 120 | 0 | 0.334 |  |
| B4 progress watchdog | Tier F | T=50 ms | high_contention | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B4 progress watchdog | Tier F | T=50 ms | long_critical_section | 60 | 0 | 0 |  |  |  | 60 | 0 | 1.000 |  |
| B4 progress watchdog | Tier F | T=50 ms | lost_wakeup | 60 | 51 | 51 | 1.000 | 63 | 65 | 0 | 0 | 0.000 |  |
| B4 progress watchdog | Tier F | T=50 ms | prodcons_missing_signal | 59 | 59 | 59 | 1.000 | 63 | 65 | 0 | 0 | 0.000 |  |
| B4 progress watchdog | Tier F | T=50 ms | sleeping_workers | 60 | 0 | 0 |  |  |  | 60 | 0 | 1.000 |  |
| B4 progress watchdog | Tier F | T=50 ms | two_lock_inversion | 60 | 60 | 60 | 1.000 | 63 | 64 | 0 | 0 | 0.000 |  |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.8742 | overall | 359 | 170 | 170 | 1.000 | 24 | 35 | 5 | 0 | 0.014 | 1.000 |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.8742 | high_contention | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.8742 | long_critical_section | 60 | 0 | 0 |  |  |  | 5 | 0 | 0.083 |  |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.8742 | lost_wakeup | 60 | 51 | 51 | 1.000 | 23 | 32 | 0 | 0 | 0.000 | 1.000 |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.8742 | prodcons_missing_signal | 59 | 59 | 59 | 1.000 | 15 | 25 | 0 | 0 | 0.000 | 1.000 |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.8742 | sleeping_workers | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.8742 | two_lock_inversion | 60 | 60 | 60 | 1.000 | 31 | 39 | 0 | 0 | 0.000 | 1.000 |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.5055 | overall | 359 | 170 | 170 | 1.000 | 14 | 36 | 1 | 0 | 0.003 | 1.000 |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.5055 | high_contention | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.5055 | long_critical_section | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.5055 | lost_wakeup | 60 | 51 | 51 | 1.000 | 14 | 22 | 0 | 0 | 0.000 | 1.000 |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.5055 | prodcons_missing_signal | 59 | 59 | 59 | 1.000 | 13 | 15 | 0 | 0 | 0.000 | 1.000 |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.5055 | sleeping_workers | 60 | 0 | 0 |  |  |  | 1 | 0 | 0.017 |  |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.5055 | two_lock_inversion | 60 | 60 | 60 | 1.000 | 28 | 40 | 0 | 0 | 0.000 | 1.000 |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.05, "max_leaf_nodes": 31}, threshold=0.9874 | overall | 359 | 170 | 170 | 1.000 | 13 | 18 | 0 | 0 | 0.000 | 1.000 |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.05, "max_leaf_nodes": 31}, threshold=0.9874 | high_contention | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.05, "max_leaf_nodes": 31}, threshold=0.9874 | long_critical_section | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.05, "max_leaf_nodes": 31}, threshold=0.9874 | lost_wakeup | 60 | 51 | 51 | 1.000 | 13 | 17 | 0 | 0 | 0.000 | 1.000 |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.05, "max_leaf_nodes": 31}, threshold=0.9874 | prodcons_missing_signal | 59 | 59 | 59 | 1.000 | 13 | 15 | 0 | 0 | 0.000 | 1.000 |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.05, "max_leaf_nodes": 31}, threshold=0.9874 | sleeping_workers | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.05, "max_leaf_nodes": 31}, threshold=0.9874 | two_lock_inversion | 60 | 60 | 60 | 1.000 | 14 | 31 | 0 | 0 | 0.000 | 1.000 |
