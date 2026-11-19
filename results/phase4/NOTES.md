# Phase 4 run log

## Freeze

- **Settings commit:** `2562e53`, the last commit that touched `results/phase3/chosen.json`.
- **Models:** M1–M3 were committed in `354405d`. Before freezing I checked that a fresh phase-3 retrain reproduces them byte for byte.
- **Hashes:** the SHA-256 values are in `FROZEN.md` and `frozen.json`.
- **Re-recorded freeze (`56c55de`):** the first record hashed the Windows CRLF working copy of `chosen.json`. A fresh clone gets LF (from `.gitattributes`) and would have failed the check. I restored the LF form from git and re-hashed it. The model files are binary and were unaffected.
  - **This happened before any test evaluation.**
- Since then, every writer emits LF, and `ml.phase3` refuses to overwrite the frozen `results/phase3/`.

## One-shot test evaluation

- **Command:** `python -m ml.evaluate --split test --final`, run **once** at 2026-11-19T15:48:01Z on commit `56c55de` (`test_run_utc.txt`, console output in `test_eval.log`).
- **The run verified the freeze** before loading anything.
- **The outputs were committed immediately** in `c22d4a4`: `test_table.md`, `test_table.csv` and `test_tolerance_effect.csv`.
- **No bug forced a re-run.**

### Regenerations

These are deterministic: same frozen files, no tuning.

- **After adding the per-run alert log:** `test_alerts.csv` comes from the same evaluation code. It was added afterwards so the delay figure and the demo could use per-run alert times.
  - `python -m ml.phase4` regenerated the test table twice: once on its own, and once via the reproduce sequence (fresh phase-3 retrain into `build/phase3-repro`, `ml.freeze compare`, then `ml.phase4`).
  - Both times, `test_table.csv`, `test_table.md` and `test_tolerance_effect.csv` came out **byte-identical** to the committed one-shot files (`git diff` was empty).
- **Replay demo cross-check:** `RunView` reproduces the alert time of every detector on all 180 test runs (0 mismatches against `test_alerts.csv`).

## Nothing was re-tuned after seeing test numbers

- **Ablations** re-choose thresholds and T on validation only. Each feature group or interval gets its own threshold, chosen by the phase-3 rule.
- **Their test numbers are reported, not used.**
- **The frozen detectors are unchanged.**

## Runtime (Windows dev machine, Python 3.14.6)

| Step | Time |
|---|---:|
| `python -m ml.phase4` | ~45–50 s (evaluation 11–14 s, ablations 25–27 s, figures 1–12 s) |
| Full reproduce (phase-3 retrain with feature rebuild, freeze compare, phase 4) | 162 s |
