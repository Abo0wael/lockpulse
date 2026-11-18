# LockPulse

Research prototype: detect hangs in multithreaded C programs (Linux, pthreads)
from uninstrumented, externally sampled /proc thread-state telemetry (Tier P).
A full LD_PRELOAD trace of synchronization calls (Tier F) is used ONLY for
ground-truth labels and as an upper-bound baseline — never as a model input.

Full specification: docs/LockPulse_Guide.md — read it before any non-trivial change.

## Current phase: 2 (Benchmark and labels). Do not implement later phases unless asked.

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
- Healthy families run 1-4 s and never go 3 s without a progress event.
- Data under data/raw/ is immutable once written; derived data goes to data/processed/.
  Gate runs use data/raw/gate/ and data/processed/gate/; overhead runs data/raw/overhead/.
- Dataset splits are always by scenario family, never by row or by run.
- Every run writes metadata (family, params, seed, tags, exit reason, runner image,
  gcc/glibc/kernel versions).
- Tier P may be used for LABELS (ml/label.py) but never as a model feature in phase 2.
- Python: standard library + pandas only in phase 2.
