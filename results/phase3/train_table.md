# LockPulse phase 3 - train results

Split: train; ambiguous excluded: 1. Settings from chosen.json (picked on validation).
DIAGNOSTIC ONLY: M1-M3 were fitted on these runs (in-sample scores); the rules B1-B4 were not. Nothing in this table was used for any choice.

| detector | input | setting | scope | runs | hang_runs | detected | detection_rate | delay_median_ms | delay_p90_ms | fa_healthy | fa_early | fa_rate | pr_auc |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B1 fixed timeout | Tier P | T=1500 ms | overall | 359 | 170 | 170 | 1.000 | 1507 | 1513 | 0 | 0 | 0.000 | 1.000 |
| B1 fixed timeout | Tier P | T=1500 ms | consistent_lock_order | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B1 fixed timeout | Tier P | T=1500 ms | high_contention | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B1 fixed timeout | Tier P | T=1500 ms | long_critical_section | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B1 fixed timeout | Tier P | T=1500 ms | lost_wakeup | 60 | 51 | 51 | 1.000 | 1507 | 1513 | 0 | 0 | 0.000 | 1.000 |
| B1 fixed timeout | Tier P | T=1500 ms | prodcons_missing_signal | 59 | 59 | 59 | 1.000 | 1505 | 1510 | 0 | 0 | 0.000 | 1.000 |
| B1 fixed timeout | Tier P | T=1500 ms | two_lock_inversion | 60 | 60 | 60 | 1.000 | 1509 | 1515 | 0 | 0 | 0.000 | 1.000 |
| B2 futex silence | Tier P | T=50 ms | overall | 359 | 170 | 170 | 1.000 | 64 | 69 | 0 | 0 | 0.000 | 0.999 |
| B2 futex silence | Tier P | T=50 ms | consistent_lock_order | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B2 futex silence | Tier P | T=50 ms | high_contention | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B2 futex silence | Tier P | T=50 ms | long_critical_section | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B2 futex silence | Tier P | T=50 ms | lost_wakeup | 60 | 51 | 51 | 1.000 | 63 | 67 | 0 | 0 | 0.000 | 1.000 |
| B2 futex silence | Tier P | T=50 ms | prodcons_missing_signal | 59 | 59 | 59 | 1.000 | 64 | 69 | 0 | 0 | 0.000 | 1.000 |
| B2 futex silence | Tier P | T=50 ms | two_lock_inversion | 60 | 60 | 60 | 1.000 | 64 | 69 | 0 | 0 | 0.000 | 1.000 |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | overall | 359 | 170 | 60 | 0.353 | 0 | 0 | 0 | 0 | 0.000 |  |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | consistent_lock_order | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | high_contention | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | long_critical_section | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | lost_wakeup | 60 | 51 | 0 | 0.000 |  |  | 0 | 0 | 0.000 |  |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | prodcons_missing_signal | 59 | 59 | 0 | 0.000 |  |  | 0 | 0 | 0.000 |  |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | two_lock_inversion | 60 | 60 | 60 | 1.000 | 0 | 0 | 0 | 0 | 0.000 |  |
| B4 progress watchdog | Tier F | T=1500 ms | overall | 359 | 170 | 170 | 1.000 | 1513 | 1515 | 42 | 0 | 0.117 |  |
| B4 progress watchdog | Tier F | T=1500 ms | consistent_lock_order | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B4 progress watchdog | Tier F | T=1500 ms | high_contention | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B4 progress watchdog | Tier F | T=1500 ms | long_critical_section | 60 | 0 | 0 |  |  |  | 42 | 0 | 0.700 |  |
| B4 progress watchdog | Tier F | T=1500 ms | lost_wakeup | 60 | 51 | 51 | 1.000 | 1513 | 1515 | 0 | 0 | 0.000 |  |
| B4 progress watchdog | Tier F | T=1500 ms | prodcons_missing_signal | 59 | 59 | 59 | 1.000 | 1513 | 1515 | 0 | 0 | 0.000 |  |
| B4 progress watchdog | Tier F | T=1500 ms | two_lock_inversion | 60 | 60 | 60 | 1.000 | 1513 | 1514 | 0 | 0 | 0.000 |  |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.9996 | overall | 359 | 170 | 170 | 1.000 | 44 | 111 | 0 | 0 | 0.000 | 1.000 |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.9996 | consistent_lock_order | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.9996 | high_contention | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.9996 | long_critical_section | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.9996 | lost_wakeup | 60 | 51 | 51 | 1.000 | 40 | 52 | 0 | 0 | 0.000 | 1.000 |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.9996 | prodcons_missing_signal | 59 | 59 | 59 | 1.000 | 40 | 111 | 0 | 0 | 0.000 | 1.000 |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.9996 | two_lock_inversion | 60 | 60 | 60 | 1.000 | 47 | 113 | 0 | 0 | 0.000 | 1.000 |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.9947 | overall | 359 | 170 | 170 | 1.000 | 41 | 58 | 0 | 0 | 0.000 | 1.000 |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.9947 | consistent_lock_order | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.9947 | high_contention | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.9947 | long_critical_section | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.9947 | lost_wakeup | 60 | 51 | 51 | 1.000 | 40 | 57 | 0 | 0 | 0.000 | 1.000 |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.9947 | prodcons_missing_signal | 59 | 59 | 59 | 1.000 | 23 | 44 | 0 | 0 | 0.000 | 1.000 |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.9947 | two_lock_inversion | 60 | 60 | 60 | 1.000 | 48 | 59 | 0 | 0 | 0.000 | 1.000 |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.1, "max_leaf_nodes": 31}, threshold=1 | overall | 359 | 170 | 170 | 1.000 | 42 | 57 | 0 | 0 | 0.000 | 1.000 |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.1, "max_leaf_nodes": 31}, threshold=1 | consistent_lock_order | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.1, "max_leaf_nodes": 31}, threshold=1 | high_contention | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.1, "max_leaf_nodes": 31}, threshold=1 | long_critical_section | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.1, "max_leaf_nodes": 31}, threshold=1 | lost_wakeup | 60 | 51 | 51 | 1.000 | 34 | 56 | 0 | 0 | 0.000 | 1.000 |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.1, "max_leaf_nodes": 31}, threshold=1 | prodcons_missing_signal | 59 | 59 | 59 | 1.000 | 38 | 45 | 0 | 0 | 0.000 | 1.000 |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.1, "max_leaf_nodes": 31}, threshold=1 | two_lock_inversion | 60 | 60 | 60 | 1.000 | 50 | 59 | 0 | 0 | 0.000 | 1.000 |
