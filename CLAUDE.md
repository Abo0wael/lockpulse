# LockPulse

Research prototype: detect hangs in multithreaded C programs (Linux, pthreads)
from uninstrumented, externally sampled /proc thread-state telemetry (Tier P).
A full LD_PRELOAD trace of synchronization calls (Tier F) is used ONLY for
ground-truth labels and as an upper-bound baseline — never as a model input.

Full specification: docs/LockPulse_Guide.md — read it before any non-trivial change.

## Current phase: 4 (Evaluation and demo). Do not go beyond the guide unless asked.

## Phase 4 rules
- The phase-3 detectors are FROZEN (results/phase4/FROZEN.md, frozen.json). Never re-tune,
  retrain or overwrite results/phase3/ after seeing test numbers; `python -m ml.freeze check`
  must pass, and ml.phase3 refuses to write into results/phase3/.
- The one-shot test evaluation is done (results/phase4/NOTES.md). Re-running it is only a
  deterministic regeneration (ml.phase4) and must reproduce the committed test table byte for
  byte; any real re-run (e.g. a bug fix) must be logged in results/phase4/NOTES.md with why.
- Ablations choose on validation and only report on test.

## Phase 3 rules
- The TEST split (dining_philosophers, sem_never_posted, blocked_on_io) is never used for
  training, tuning, threshold choice or reporting; ml/evaluate.py refuses split=test without
  --final (phase 4 only). Features may be built for it.
- Model inputs are Tier P features only (ml/features.py FEATURES). Never family, config,
  seed, split, run duration, exit_reason or anything from Tier F. Tier F is for labels (t0)
  and baselines B3/B4 only.
- Features are causal: a row at tick t uses only Tier P samples with ts <= t (unit-tested).
- Ambiguous runs are excluded everywhere. Fixed random seeds. Every hyperparameter, window
  and threshold is chosen on VALIDATION.
- Phase 3 is pure Python and runs locally: `make venv` (pinned requirements-ml.txt), then
  `make phase3` / `python -m ml.phase3`.

## Rules
- Linux x86-64 only (WSL2 Ubuntu is fine). C11, gcc, `-Wall -Wextra -O2`, zero warnings
  (CI builds with `-Werror`).
- No local C build on the Windows dev machine: GitHub Actions (ubuntu-26.04 image) is the
  only verifier. Python-only checks (ml/tests, py_compile) may run locally.
- Both tiers timestamp with CLOCK_MONOTONIC in nanoseconds.
- Shim hot path: no malloc, no printf/stdio, no locks; guard against recursion
  into the shim with a thread-local flag; preserve errno.
- Versioned glibc symbols are resolved with dlvsym (pthread_cond_* -> GLIBC_2.3.2).
- Benchmarks force interleavings with barriers/semaphores, never with sleeps.
- Never wait on a barrier, condvar (other than with its own mutex), semaphore or join while
  holding a mutex, unless that hang is the family's intended bug.
- Overhead is measured in fixed-work mode (fixed --iters, --work-ms 0, --rate 0); the
  time-bounded mode is for data collection only.
- Healthy families run 1-4 s and never go 3 s without a progress event.
- Data under data/raw/ is immutable once written; derived data goes to data/processed/.
  Gate runs use data/raw/gate/ and data/processed/gate/; overhead runs data/raw/overhead/.
- Dataset splits are always by scenario family, never by row or by run.
- Every run writes metadata (family, params, seed, tags, exit reason, runner image,
  gcc/glibc/kernel versions).
- Tier P may be used for LABELS (ml/label.py) but never as a model feature in phase 2.
- Python: standard library + pandas for the collection/label scripts; phase 3 adds numpy,
  scikit-learn and joblib (pinned in requirements-ml.txt). ml/tests must run with numpy +
  pandas only (CI has no scikit-learn).
