# LockPulse

LockPulse is a research prototype. It detects hangs (deadlocks, lost wakeups, barrier and semaphore hangs) in multithreaded C programs that use pthreads on Linux. It records two kinds of telemetry at the same time:

| Tier | What it is | Used for |
|---|---|---|
| **P** (partial) | An external sampler reads `/proc/<pid>/task/<tid>/{stat,status,syscall}` every 5 ms. Nothing runs inside the target. | The **only** input the ML model will ever see (later phases). |
| **F** (full) | An `LD_PRELOAD` shim (`liblockpulse.so`) logs every pthread mutex call into a shared-memory trace file. | Ground-truth labels and an upper-bound baseline. **Never** a model input. |

A watchdog kills runs that stop making progress. The current phase is **1 (Foundations)**: it builds this pipeline end to end for 4 scenario families. Labeling, features and ML come in later phases. The project rules are in [CLAUDE.md](CLAUDE.md).

## Requirements

- Linux x86-64 (WSL2 Ubuntu is fine), gcc, GNU make ≥ 3.82, Python 3 + pandas
  (`sudo apt-get install build-essential python3-pandas`).
- **Clone the repo to a path without spaces or `:`.** `LD_PRELOAD` cannot represent such paths, so `lp-run` refuses Tier F there. On WSL, use the Linux filesystem (`~/lockpulse`) rather than `/mnt/c/...`.

## Build

```sh
make            # = make all: shim, launcher, bench, tools
make clean      # removes build/ only; never touches data/
```

| Output | Built from |
|---|---|
| `build/liblockpulse.so` | `runtime/shim.c runtime/tracebuf.c` |
| `build/lp-run` | `launcher/*.c runtime/tracebuf.c` |
| `build/lp-dump` | `tools/lp-dump.c runtime/tracebuf.c` |
| `build/bench/<name>` | `bench/<name>.c bench/bench_common.h` |

CI builds with `EXTRA_CFLAGS=-Werror`. Run `make EXTRA_CFLAGS=-Werror` locally to reproduce it.

## Run one benchmark

```sh
./build/lp-run --family two_lock_inversion --run-id demo1 --tier PF \
    -- ./build/bench/two_lock_inversion --seed 1
# lp-run: run=demo1 family=two_lock_inversion tier=PF exit=watchdog_kill duration_ms=3010.4 samples=...

./build/lp-dump data/raw/tierF/demo1.bin > data/processed/demo1_tierF.csv
```

`lp-run` options: `--tier P|F|PF` (default PF), `--interval-ms 5`, `--watchdog-ms 3000`, `--max-ms 10000`, `--data-dir data/raw`, `--shim PATH` (default: `liblockpulse.so` next to `lp-run`).

- The progress watchdog needs Tier F: it watches the trace header's `progress_counter`. `--max-ms` is always enforced.
- `lp-run` exits 0 whenever the run was recorded, whatever the benchmark did. Check `exit_reason` in the metadata. It exits 1 on launcher errors and 2 on bad usage.
- Run ids are never reused: `lp-run` refuses to overwrite existing raw data.

### Benchmarks

All benchmarks accept `--threads N --iters N --cs-us N --seed N` and ignore flags that don't apply. They force interleavings with barriers, never with sleeps. A completed run prints `elapsed_ns=<n>` and exits 0.

| Family | Expected | Mechanism |
|---|---|---|
| `two_lock_inversion` | hang (deadlock) | T1 holds A and T2 holds B, both meet at a barrier, then each requests the other lock. |
| `lost_wakeup` | hang (no lock cycle) | `cond_signal` is sent before anyone waits, then a barrier; the waiter calls `cond_wait` without a predicate. |
| `high_contention` | healthy | 16 threads × 10000 lock/increment/unlock rounds on one mutex; the final count is verified. |
| `long_critical_section` | healthy, hard negative | One thread busy-loops for 1.0–2.5 s (drawn from the seed) while holding a mutex that the others block on. |

Default parameters are in [configs/phase1.json](configs/phase1.json).

## Phase-1 gate

```sh
make clean && make check-phase1
```

[scripts/check_phase1.py](scripts/check_phase1.py) does the following:

1. Builds everything.
2. Runs each family 3 times (seeds 1..3) with `--tier PF`.
3. Runs `high_contention` once each with `--tier P`, with `--tier F` and untraced.
4. Asserts:
   - hangs end in `watchdog_kill` and healthy runs end in `exited_ok`;
   - Tier P and Tier F data are non-empty;
   - timestamps lie within the run's `[start_ns, end_ns]`, and the two tiers overlap;
   - there is no tracebuf overflow;
   - every watchdog kill happened at least `watchdog_ms` after the last progress event.
5. Prints a summary table, the overhead numbers, and the tail of a deadlock run.

The report is also written to `results/check_phase1_latest.txt`. The gate exits non-zero if any assertion fails.

## Data layout and file formats

```
data/raw/tierP/<run_id>.csv     Tier P samples             (raw, immutable)
data/raw/tierF/<run_id>.bin     Tier F trace buffer         (raw, immutable)
data/raw/meta/<run_id>.json     run metadata               (raw, immutable)
data/processed/tierF/<run_id>.csv  lp-dump output           (derived)
```

Both tiers timestamp with `CLOCK_MONOTONIC` in nanoseconds, so they can be compared directly.

### Tier P CSV: `ts_ns,tid,state,utime_ticks,stime_ticks,vcsw,nvcsw,syscall_nr`

| Column | Meaning |
|---|---|
| `ts_ns` | Start of the sampling tick. All rows of one tick share it and form one snapshot. |
| `tid` | Kernel thread id. |
| `state` | `stat` field 3: `R` running, `S` sleeping, `D` disk wait, `Z` zombie, `T`/`t` stopped, ... |
| `utime_ticks`, `stime_ticks` | `stat` fields 14/15: user and system CPU time, in clock ticks (`sysconf(_SC_CLK_TCK)`, usually 100/s). |
| `vcsw`, `nvcsw` | `voluntary_ctxt_switches` / `nonvoluntary_ctxt_switches` from `status` (cumulative). |
| `syscall_nr` | First field of `syscall`. A value ≥ 0 is the x86-64 syscall the thread is blocked in (202 = futex). `-1` running, `-2` unreadable, `-3` the kernel reported `-1` (blocked, not in a syscall). |

### Tier F trace (`.bin`, schema v1; see [runtime/tracebuf.h](runtime/tracebuf.h))

The file is a 4096-byte header followed by one region per thread (64 threads × 65536 records). Each region is a 64-byte region header (atomic `count`, owner `tid`) followed by 32-byte records.

- **Header:** `magic "LPTR"`, `schema_version`, `max_threads`, `records_per_thread`, `header_size`, `record_size`, `region_size`, `progress_counter` (incremented on every MUTEX_ACQ and MUTEX_REL), `next_slot`, `overflow` (bit 0: records dropped, bit 1: more than 64 threads), `dropped_records`, `created_ns`.
- **Record (32 bytes, naturally aligned):** `u64 ts_ns`, `u64 wait_ns`, `u64 obj_addr`, `u32 tid`, `u16 event`, `u16 site`.

The file is created sparse and mapped `MAP_SHARED`, so every complete record survives the target being SIGKILLed.

### Tier F CSV (`lp-dump`): `ts_ns,tid,event,obj_addr,wait_ns,site`

All threads are merged and sorted by `ts_ns`.

| Column | Meaning |
|---|---|
| `event` | `THREAD_FIRST_SEEN`, `MUTEX_REQ`, `MUTEX_ACQ`, `MUTEX_REL`, `MUTEX_TRYLOCK_FAIL`, `ERROR`. COND/SEM/BARRIER values are reserved for phase 2. |
| `obj_addr` | Mutex address in hex (`0x0` for THREAD_FIRST_SEEN). |
| `wait_ns` | MUTEX_ACQ: ns from request to acquisition. ERROR: the pthread return code. Otherwise 0. |
| `site` | Call-site id, always 0 in phase 1. |

`lp-dump` exits 0 when the trace is OK, 3 when the buffer overflowed (the CSV is still written), 2 for an invalid file and 1 for usage or I/O errors.

### Metadata JSON (`meta/<run_id>.json`)

| Field | Contents |
|---|---|
| `run_id`, `family`, `bench_argv`, `params` | Every `--key value` passed to the benchmark. |
| `seed`, `tier`, `interval_ms`, `watchdog_ms`, `max_ms`, `pid` | Run settings. |
| `start_ns`, `exec_ns`, `end_ns`, `duration_ms` | `start_ns` is before fork, `exec_ns` is after a successful exec, `end_ns` is after reaping. |
| `exit_reason` | `exited_ok`, `exited_error(<code>)`, `signaled(<sig>)`, `watchdog_kill` or `max_time_kill`. |
| `exit_code`, `term_signal`, `killed_by`, `kill_ns`, `exec_errno` | Details of how the run ended. |
| `tierP` | `{path, samples, ticks, syscall_reads_ok, syscall_reads_unreadable}`, or `null`. |
| `tierF` | `{path, mapped, progress_counter, last_progress_observed_ns, overflow, overflow_flags, dropped_records, threads_seen, max_threads, records_per_thread}`, or `null`. |
| `env` | `{uname, gcc_version (of the compiler that built lp-run), glibc_version, yama_ptrace_scope}`. |
| `warnings` | For example: `/proc/<tid>/syscall` unreadable, or an empty Tier F trace. |

## How the team works

- **One branch per component.** Branch names: `shim/...`, `launcher/...`, `bench/...`, `gate/...`, `docs/...`.
- **Open a pull request into `main`.** The `phase1` GitHub Actions workflow runs `make clean && make check-phase1` with `-Werror` on `ubuntu-latest`.
- **CI must pass before merging.** No direct pushes to `main` once branch protection is on.
- **Use the CI artifact.** It is named `phase1-data-<run>` and contains the metadata, Tier P CSVs, Tier F CSVs and gate report. You can inspect runs without a Linux machine.
- **Edit only files your component owns** (table below). If you need to change another component's file, say so in the PR and request that owner's review.

| Component | Branch prefix | Owns |
|---|---|---|
| Tier F runtime (shim + trace format) | `shim/` | `runtime/shim.c`, `runtime/tracebuf.c`, `runtime/tracebuf.h`, `tools/lp-dump.c` |
| Launcher / sampler / watchdog | `launcher/` | `launcher/launcher.c`, `launcher/sampler.c`, `launcher/sampler.h`, `launcher/watchdog.c`, `launcher/watchdog.h` |
| Benchmarks | `bench/` | `bench/*.c`, `bench/bench_common.h`, `configs/phase1.json` |
| Gate script + CI | `gate/` | `scripts/check_phase1.py`, `.github/workflows/phase1.yml` |
| Shared (any change needs two reviewers) | n/a | `Makefile`, `README.md`, `CLAUDE.md`, `docs/`, `.gitignore`, `.gitattributes` |

`runtime/tracebuf.h` is the contract between the shim, the watchdog and `lp-dump`. Any layout change must bump `LP_SCHEMA_VERSION` and update the format section above in the same PR.
