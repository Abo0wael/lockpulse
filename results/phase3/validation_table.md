# LockPulse phase 3 - validation results

Split: validation (barrier_mismatch, consistent_lock_order, prodcons_correct, three_thread_cycle). Runs: 240; ambiguous excluded: 1.
Alert policy: first tick where the score has been >= threshold for 3 consecutive ticks. Threshold rule: max detection rate s.t. false-alarm rate <= 5%; tie-break lower median delay.
PR-AUC: window-level over validation ticks >= 40 (common tick set); blank where a family has one class or the detector has no continuous score.

| detector | input | setting | scope | runs | hang_runs | detected | detection_rate | delay_median_ms | delay_p90_ms | fa_healthy | fa_early | fa_rate | pr_auc |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B1 fixed timeout | Tier P | T=50 ms | overall | 240 | 120 | 120 | 1.000 | 61 | 70 | 0 | 0 | 0.000 | 0.999 |
| B1 fixed timeout | Tier P | T=50 ms | barrier_mismatch | 60 | 60 | 60 | 1.000 | 65 | 75 | 0 | 0 | 0.000 | 1.000 |
| B1 fixed timeout | Tier P | T=50 ms | consistent_lock_order | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B1 fixed timeout | Tier P | T=50 ms | prodcons_correct | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B1 fixed timeout | Tier P | T=50 ms | three_thread_cycle | 60 | 60 | 60 | 1.000 | 59 | 63 | 0 | 0 | 0.000 | 1.000 |
| B2 futex silence | Tier P | T=50 ms | overall | 240 | 120 | 120 | 1.000 | 66 | 75 | 0 | 0 | 0.000 | 0.999 |
| B2 futex silence | Tier P | T=50 ms | barrier_mismatch | 60 | 60 | 60 | 1.000 | 71 | 79 | 0 | 0 | 0.000 | 1.000 |
| B2 futex silence | Tier P | T=50 ms | consistent_lock_order | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B2 futex silence | Tier P | T=50 ms | prodcons_correct | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B2 futex silence | Tier P | T=50 ms | three_thread_cycle | 60 | 60 | 60 | 1.000 | 63 | 69 | 0 | 0 | 0.000 | 1.000 |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | overall | 240 | 120 | 51 | 0.425 | 0 | 0 | 0 | 9 | 0.037 |  |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | barrier_mismatch | 60 | 60 | 0 | 0.000 |  |  | 0 | 0 | 0.000 |  |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | consistent_lock_order | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | prodcons_correct | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B3 wait-for graph | Tier F | no threshold (cycle at MUTEX_REQ) | three_thread_cycle | 60 | 60 | 51 | 0.850 | 0 | 0 | 0 | 9 | 0.150 |  |
| B4 progress watchdog | Tier F | T=50 ms | overall | 240 | 120 | 120 | 1.000 | 62 | 65 | 0 | 0 | 0.000 |  |
| B4 progress watchdog | Tier F | T=50 ms | barrier_mismatch | 60 | 60 | 60 | 1.000 | 63 | 65 | 0 | 0 | 0.000 |  |
| B4 progress watchdog | Tier F | T=50 ms | consistent_lock_order | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B4 progress watchdog | Tier F | T=50 ms | prodcons_correct | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| B4 progress watchdog | Tier F | T=50 ms | three_thread_cycle | 60 | 60 | 60 | 1.000 | 62 | 64 | 0 | 0 | 0.000 |  |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.8742 | overall | 240 | 120 | 120 | 1.000 | 39 | 58 | 0 | 0 | 0.000 | 1.000 |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.8742 | barrier_mismatch | 60 | 60 | 60 | 1.000 | 54 | 61 | 0 | 0 | 0.000 | 1.000 |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.8742 | consistent_lock_order | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.8742 | prodcons_correct | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M1 logistic regression | Tier P | W=10 (50 ms), {"C": 10.0}, threshold=0.8742 | three_thread_cycle | 60 | 60 | 60 | 1.000 | 31 | 44 | 0 | 0 | 0.000 | 1.000 |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.5055 | overall | 240 | 120 | 120 | 1.000 | 45 | 57 | 0 | 0 | 0.000 | 0.999 |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.5055 | barrier_mismatch | 60 | 60 | 60 | 1.000 | 54 | 59 | 0 | 0 | 0.000 | 1.000 |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.5055 | consistent_lock_order | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.5055 | prodcons_correct | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M2 random forest | Tier P | W=10 (50 ms), {"max_depth": 6, "min_samples_leaf": 5}, threshold=0.5055 | three_thread_cycle | 60 | 60 | 60 | 1.000 | 31 | 51 | 0 | 0 | 0.000 | 1.000 |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.05, "max_leaf_nodes": 31}, threshold=0.9874 | overall | 240 | 120 | 120 | 1.000 | 48 | 59 | 0 | 0 | 0.000 | 1.000 |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.05, "max_leaf_nodes": 31}, threshold=0.9874 | barrier_mismatch | 60 | 60 | 60 | 1.000 | 52 | 64 | 0 | 0 | 0.000 | 1.000 |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.05, "max_leaf_nodes": 31}, threshold=0.9874 | consistent_lock_order | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.05, "max_leaf_nodes": 31}, threshold=0.9874 | prodcons_correct | 60 | 0 | 0 |  |  |  | 0 | 0 | 0.000 |  |
| M3 gradient boosting | Tier P | W=10 (50 ms), {"learning_rate": 0.05, "max_leaf_nodes": 31}, threshold=0.9874 | three_thread_cycle | 60 | 60 | 60 | 1.000 | 33 | 56 | 0 | 0 | 0.000 | 1.000 |
