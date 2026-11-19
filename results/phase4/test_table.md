# LockPulse phase 3 - test results

Split: test (blocked_on_io, dining_philosophers, sem_never_posted). Runs: 180; ambiguous excluded (all splits): 1.
Settings and models: results\phase3 (picked on validation; frozen, hashes verified).
Alert policy: first tick where the score has been >= threshold for 3 consecutive ticks; an alert is on time if it comes at or after t0 - 5 ms.

| detector | input | setting | scope | runs | hang_runs | detected | detection_rate | delay_median_ms | delay_p90_ms | fa_healthy | fa_early | fa_rate | pr_auc |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B1 fixed timeout | Tier P | T=1500 ms | overall | 180 | 91 | 91 | 1.000 | 1512 | 1525 | 23 | 0 | 0.128 | 0.918 |
| B1 fixed timeout | Tier P | T=1500 ms | blocked_on_io | 60 | 0 | 0 |  |  |  | 23 | 0 | 0.383 |  |
| B1 fixed timeout | Tier P | T=1500 ms | dining_philosophers | 60 | 46 | 46 | 1.000 | 1508 | 1513 | 0 | 0 | 0.000 | 1.000 |
| B1 fixed timeout | Tier P | T=1500 ms | sem_never_posted | 60 | 45 | 45 | 1.000 | 1517 | 1528 | 0 | 0 | 0.000 | 1.000 |
| B2 futex silence | Tier P | T=50 ms | overall | 180 | 91 | 91 | 1.000 | 69 | 83 | 0 | 0 | 0.000 | 0.998 |
| B2 futex silence | Tier P | T=50 ms | blocked_on_io | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B2 futex silence | Tier P | T=50 ms | dining_philosophers | 60 | 46 | 46 | 1.000 | 63 | 70 | 0 | 0 | 0.000 | 1.000 |
| B2 futex silence | Tier P | T=50 ms | sem_never_posted | 60 | 45 | 45 | 1.000 | 78 | 85 | 0 | 0 | 0.000 | 0.999 |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | overall | 180 | 91 | 46 | 0.505 | 0 | 0 | 0 | 0 | 0.000 |  |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | blocked_on_io | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | dining_philosophers | 60 | 46 | 46 | 1.000 | 0 | 0 | 0 | 0 | 0.000 |  |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | sem_never_posted | 60 | 45 | 0 | 0.000 |  |  | 0 | 0 | 0.000 |  |
| B4 progress watchdog | Tier F | T=1500 ms | overall | 180 | 91 | 91 | 1.000 | 1513 | 1515 | 23 | 0 | 0.128 |  |
| B4 progress watchdog | Tier F | T=1500 ms | blocked_on_io | 60 | 0 | 0 |  |  |  | 23 | 0 | 0.383 |  |
| B4 progress watchdog | Tier F | T=1500 ms | dining_philosophers | 60 | 46 | 46 | 1.000 | 1512 | 1515 | 0 | 0 | 0.000 |  |
| B4 progress watchdog | Tier F | T=1500 ms | sem_never_posted | 60 | 45 | 45 | 1.000 | 1513 | 1514 | 0 | 0 | 0.000 |  |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.9996 | overall | 180 | 91 | 91 | 1.000 | 36 | 110 | 15 | 0 | 0.083 | 0.991 |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.9996 | blocked_on_io | 60 | 0 | 0 |  |  |  | 15 | 0 | 0.250 |  |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.9996 | dining_philosophers | 60 | 46 | 46 | 1.000 | 46 | 112 | 0 | 0 | 0.000 | 1.000 |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.9996 | sem_never_posted | 60 | 45 | 45 | 1.000 | 24 | 34 | 0 | 0 | 0.000 | 1.000 |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.9947 | overall | 180 | 91 | 91 | 1.000 | 47 | 65 | 0 | 0 | 0.000 | 0.999 |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.9947 | blocked_on_io | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.9947 | dining_philosophers | 60 | 46 | 46 | 1.000 | 45 | 70 | 0 | 0 | 0.000 | 1.000 |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.9947 | sem_never_posted | 60 | 45 | 45 | 1.000 | 48 | 64 | 0 | 0 | 0.000 | 1.000 |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.1, "max_leaf_nodes": 31}, threshold=1 | overall | 180 | 91 | 91 | 1.000 | 55 | 60 | 0 | 0 | 0.000 | 0.999 |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.1, "max_leaf_nodes": 31}, threshold=1 | blocked_on_io | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.1, "max_leaf_nodes": 31}, threshold=1 | dining_philosophers | 60 | 46 | 46 | 1.000 | 57 | 60 | 0 | 0 | 0.000 | 1.000 |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.1, "max_leaf_nodes": 31}, threshold=1 | sem_never_posted | 60 | 45 | 45 | 1.000 | 47 | 63 | 0 | 0 | 0.000 | 1.000 |
