# Overhead (fixed-work mode, 10 repetitions per mode)

Source: collect run 44361187947, job `overhead` (scripts/overhead.py); copied here, no new runs.
Modes: untraced = benchmark alone; P = /proc sampler only; F = LD_PRELOAD shim only; PF = both.
CPU % is the launcher's own CPU (getrusage RUSAGE_SELF) over the run's wall time: the sampler in P/PF,
only the watchdog in F. The /proc/self/stat tick-based column of overhead.csv is 0 throughout because
these runs last ~30-60 ms, below the 10 ms tick resolution's useful range.

| family | mode | runs | bench ms median | bench ms IQR | slowdown vs untraced | lock ops/s median | launcher (sampler+watchdog) CPU % median [IQR] |
|---|---|---:|---:|---:|---:|---:|---:|
| high_contention | untraced | 10 | 30.7 | 7.9 | 1.00x | 5,209,638 | - |
| high_contention | P | 10 | 35.3 | 7.4 | 1.15x | 4,530,858 | 7.1 [6.3-9.2] |
| high_contention | F | 10 | 54.7 | 6.1 | 1.78x | 2,927,630 | 1.8 [1.7-1.8] |
| high_contention | PF | 10 | 53.0 | 9.6 | 1.73x | 3,018,282 | 12.1 [11.8-12.6] |
| prodcons_correct | untraced | 10 | 43.9 | 1.2 | 1.00x | 227,702 | - |
| prodcons_correct | P | 10 | 43.8 | 2.5 | 1.00x | 228,554 | 6.8 [6.8-6.9] |
| prodcons_correct | F | 10 | 53.0 | 0.5 | 1.21x | 188,654 | 1.9 [1.9-2.0] |
| prodcons_correct | PF | 10 | 53.4 | 0.8 | 1.21x | 187,444 | 7.2 [7.1-7.3] |
