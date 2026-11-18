# LockPulse

Research prototype: detect hangs in multithreaded C programs (Linux, pthreads)
from uninstrumented, externally sampled /proc thread-state telemetry (Tier P).
A full LD_PRELOAD trace of synchronization calls (Tier F) is used ONLY for
ground-truth labels and as an upper-bound baseline — never as a model input.

Full specification: docs/LockPulse_Guide.md — read it before any non-trivial change.

## Current phase: 1 (Foundations). Do not implement later phases unless asked.

## Rules
- Linux x86-64 only (WSL2 Ubuntu is fine). C11, gcc, `-Wall -Wextra -O2`, zero warnings.
- Both tiers timestamp with CLOCK_MONOTONIC in nanoseconds.
- Shim hot path: no malloc, no printf/stdio, no locks; guard against recursion
  into the shim with a thread-local flag.
- Benchmarks force interleavings with barriers/semaphores, never with sleeps.
- Data under data/raw/ is immutable once written; derived data goes to data/processed/.
- Dataset splits are always by scenario family, never by row or by run.
- Every run writes metadata (family, params, seed, exit reason, gcc/glibc/kernel versions).
- Python: standard library + pandas only in phase 1.
