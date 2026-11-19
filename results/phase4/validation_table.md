# LockPulse phase 3 - validation results

Split: validation (barrier_mismatch, prodcons_correct, sleeping_workers, three_thread_cycle). Runs: 240; ambiguous excluded (all splits): 1.
Settings and models: results\phase3 (picked on validation).
Alert policy: first tick where the score has been >= threshold for 3 consecutive ticks; an alert is on time if it comes at or after t0 - 5 ms.

| detector | input | setting | scope | runs | hang_runs | detected | detection_rate | delay_median_ms | delay_p90_ms | fa_healthy | fa_early | fa_rate | pr_auc |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B1 fixed timeout | Tier P | T=1500 ms | overall | 240 | 120 | 120 | 1.000 | 1511 | 1520 | 7 | 0 | 0.029 | 0.954 |
| B1 fixed timeout | Tier P | T=1500 ms | barrier_mismatch | 60 | 60 | 60 | 1.000 | 1515 | 1524 | 0 | 0 | 0.000 | 1.000 |
| B1 fixed timeout | Tier P | T=1500 ms | prodcons_correct | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B1 fixed timeout | Tier P | T=1500 ms | sleeping_workers | 60 | 0 | 0 |  |  |  | 7 | 0 | 0.117 |  |
| B1 fixed timeout | Tier P | T=1500 ms | three_thread_cycle | 60 | 60 | 60 | 1.000 | 1509 | 1513 | 0 | 0 | 0.000 | 1.000 |
| B2 futex silence | Tier P | T=50 ms | overall | 240 | 120 | 120 | 1.000 | 66 | 75 | 0 | 0 | 0.000 | 0.999 |
| B2 futex silence | Tier P | T=50 ms | barrier_mismatch | 60 | 60 | 60 | 1.000 | 71 | 79 | 0 | 0 | 0.000 | 1.000 |
| B2 futex silence | Tier P | T=50 ms | prodcons_correct | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B2 futex silence | Tier P | T=50 ms | sleeping_workers | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B2 futex silence | Tier P | T=50 ms | three_thread_cycle | 60 | 60 | 60 | 1.000 | 63 | 69 | 0 | 0 | 0.000 | 1.000 |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | overall | 240 | 120 | 60 | 0.500 | 0 | 0 | 0 | 0 | 0.000 |  |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | barrier_mismatch | 60 | 60 | 0 | 0.000 |  |  | 0 | 0 | 0.000 |  |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | prodcons_correct | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | sleeping_workers | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | three_thread_cycle | 60 | 60 | 60 | 1.000 | 0 | 0 | 0 | 0 | 0.000 |  |
| B4 progress watchdog | Tier F | T=1500 ms | overall | 240 | 120 | 120 | 1.000 | 1512 | 1515 | 7 | 0 | 0.029 |  |
| B4 progress watchdog | Tier F | T=1500 ms | barrier_mismatch | 60 | 60 | 60 | 1.000 | 1513 | 1515 | 0 | 0 | 0.000 |  |
| B4 progress watchdog | Tier F | T=1500 ms | prodcons_correct | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B4 progress watchdog | Tier F | T=1500 ms | sleeping_workers | 60 | 0 | 0 |  |  |  | 7 | 0 | 0.117 |  |
| B4 progress watchdog | Tier F | T=1500 ms | three_thread_cycle | 60 | 60 | 60 | 1.000 | 1512 | 1514 | 0 | 0 | 0.000 |  |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.9996 | overall | 240 | 120 | 120 | 1.000 | 54 | 119 | 11 | 0 | 0.046 | 0.997 |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.9996 | barrier_mismatch | 60 | 60 | 60 | 1.000 | 60 | 124 | 0 | 0 | 0.000 | 1.000 |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.9996 | prodcons_correct | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.9996 | sleeping_workers | 60 | 0 | 0 |  |  |  | 11 | 0 | 0.183 |  |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.9996 | three_thread_cycle | 60 | 60 | 60 | 1.000 | 49 | 76 | 0 | 0 | 0.000 | 1.000 |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.9947 | overall | 240 | 120 | 120 | 1.000 | 60 | 94 | 0 | 0 | 0.000 | 0.998 |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.9947 | barrier_mismatch | 60 | 60 | 60 | 1.000 | 71 | 98 | 0 | 0 | 0.000 | 1.000 |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.9947 | prodcons_correct | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.9947 | sleeping_workers | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.9947 | three_thread_cycle | 60 | 60 | 60 | 1.000 | 49 | 61 | 0 | 0 | 0.000 | 1.000 |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.1, "max_leaf_nodes": 31}, threshold=1 | overall | 240 | 120 | 120 | 1.000 | 58 | 67 | 0 | 0 | 0.000 | 0.998 |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.1, "max_leaf_nodes": 31}, threshold=1 | barrier_mismatch | 60 | 60 | 60 | 1.000 | 61 | 70 | 0 | 0 | 0.000 | 1.000 |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.1, "max_leaf_nodes": 31}, threshold=1 | prodcons_correct | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.1, "max_leaf_nodes": 31}, threshold=1 | sleeping_workers | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.1, "max_leaf_nodes": 31}, threshold=1 | three_thread_cycle | 60 | 60 | 60 | 1.000 | 56 | 59 | 0 | 0 | 0.000 | 1.000 |
