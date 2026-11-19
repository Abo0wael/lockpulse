# Ablations (choices on validation, numbers on test)

Feature groups: M2/M3 with the frozen W and hyperparameters, retrained on train with the
group's features only, threshold re-chosen on validation by the phase-3 rule.
Sampling interval: 5 ms ticks sub-sampled to 10/20 ms, features rebuilt with the same 100 ms
window (W = 20/10/5 ticks), models retrained, threshold (B2: T) re-chosen on validation. The
alert policy stays 3 consecutive ticks. 2 ms would need re-collection and is not included.

| ablation | variant | detector | setting | val det | val FA | test detected | test delay median / p90 (ms) | test FA healthy + early | test FA rate | test PR-AUC |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| features | all | M2 | W=10 (50 ms), 13 features | 1.00 | 0.000 | 91/91 | 47 / 65 | 0 + 0 | 0.000 | 0.999 |
| features | no_syscall | M2 | W=10 (50 ms), 9 features | 0.00 | 0.000 | 0/91 |  /  | 0 + 0 | 0.000 | 0.761 |
| features | no_ctxsw | M2 | W=10 (50 ms), 8 features | 1.00 | 0.000 | 91/91 | 56 / 80 | 0 + 0 | 0.000 | 0.998 |
| features | state_cpu | M2 | W=10 (50 ms), 3 features | 0.00 | 0.000 | 0/91 |  /  | 0 + 0 | 0.000 | 0.759 |
| features | all | M3 | W=10 (50 ms), 13 features | 1.00 | 0.000 | 91/91 | 55 / 60 | 0 + 0 | 0.000 | 0.999 |
| features | no_syscall | M3 | W=10 (50 ms), 9 features | 0.00 | 0.000 | 0/91 |  /  | 0 + 0 | 0.000 | 0.760 |
| features | no_ctxsw | M3 | W=10 (50 ms), 8 features | 1.00 | 0.000 | 91/91 | 55 / 62 | 0 + 0 | 0.000 | 0.998 |
| features | state_cpu | M3 | W=10 (50 ms), 3 features | 0.00 | 0.000 | 0/91 |  /  | 0 + 0 | 0.000 | 0.759 |
| interval | 5 ms | M2 | W=20 ticks (100 ms) | 1.00 | 0.000 | 91/91 | 34 / 72 | 0 + 0 | 0.000 | 0.998 |
| interval | 5 ms | M3 | W=20 ticks (100 ms) | 1.00 | 0.000 | 91/91 | 68 / 95 | 0 + 0 | 0.000 | 0.998 |
| interval | 5 ms | B2 | T=50 ms | 1.00 | 0.000 | 91/91 | 69 / 83 | 0 + 0 | 0.000 |  |
| interval | 10 ms | M2 | W=10 ticks (100 ms) | 1.00 | 0.000 | 91/91 | 45 / 81 | 0 + 0 | 0.000 | 0.998 |
| interval | 10 ms | M3 | W=10 ticks (100 ms) | 1.00 | 0.000 | 91/91 | 103 / 138 | 0 + 0 | 0.000 | 0.995 |
| interval | 10 ms | B2 | T=50 ms | 1.00 | 0.000 | 91/91 | 85 / 98 | 0 + 0 | 0.000 |  |
| interval | 20 ms | M2 | W=5 ticks (100 ms) | 1.00 | 0.000 | 91/91 | 72 / 105 | 0 + 0 | 0.000 | 0.997 |
| interval | 20 ms | M3 | W=5 ticks (100 ms) | 1.00 | 0.004 | 91/91 | 85 / 110 | 0 + 0 | 0.000 | 0.998 |
| interval | 20 ms | B2 | T=50 ms | 1.00 | 0.000 | 91/91 | 116 / 129 | 0 + 0 | 0.000 |  |
