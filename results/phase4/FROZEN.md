# Frozen phase-3 detectors

These files were frozen **before** any test-split evaluation. Phase 4 (`python -m ml.phase4`,
`python -m ml.evaluate --split test --final`) verifies every hash below before loading, and
aborts on any mismatch. No setting may be re-tuned after seeing test numbers.

- Settings commit (last commit that touched `results/phase3/chosen.json`): `2562e5360db39a47a026e9c385328350f0ef4bec`
- The models were added to git in the freeze commit that also adds this file. They are
  byte-identical to a fresh `python -m ml.phase3` retrain (verified before freezing).

| file | SHA-256 |
|---|---|
| `results/phase3/chosen.json` | `5f5345b581d9684b5318f73152811f726663dbc1427001d6aa80d88dbb5035a3` |
| `results/phase3/models/M1.joblib` | `d30aaf5842341fa9ec16c3b81e6a720e00b959ed3b6ff4f283325631b1074777` |
| `results/phase3/models/M2.joblib` | `2d40bb73ec3b1e1a5264e7eb1ef4cbabb7daa152cedbb2d500e63793f00881d7` |
| `results/phase3/models/M3.joblib` | `c2f2ea9dfaf66e99a1840c07d6d91c64db74baf2a2e8b6fa159721c9fe33c926` |
