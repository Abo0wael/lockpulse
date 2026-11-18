#!/usr/bin/env python3
"""overhead.py - telemetry overhead per tier (guide: RQ3, "Overhead (%)", "Sampler CPU (%)").

  python3 scripts/overhead.py [--config configs/phase2.json] [--reps 10]

For each family in the config's "overhead" section (high_contention and
prodcons_correct, config c1, fixed seed) it runs the benchmark `reps` times in
each mode: untraced (benchmark run directly), P (sampler only), F (shim only)
and PF (both). Modes are interleaved within each repetition so slow drifts of
the machine hit all modes alike.

Per run it records bench_ms (the benchmark's own elapsed_ns, excluding process
start-up) and the launcher's CPU usage. lp-run reads its own utime/stime from
/proc/self/stat (= /proc/<launcher pid>/stat) when the run ends and stores
them in the metadata (launcher_cpu); sampler CPU % = (utime+stime)/CLK_TCK
divided by the run's wall time. In mode F the launcher only runs the
watchdog, so its CPU is reported too.

Writes results/overhead_runs.csv (one row per run) and results/overhead.csv:
  family, mode, n, bench_ms_median, bench_ms_q1, bench_ms_q3, bench_ms_iqr,
  slowdown_vs_untraced (ratio of medians), sampler_cpu_pct_median,
  sampler_cpu_pct_iqr
Raw run data goes to data/raw/overhead/ so it never mixes with the dataset.
"""
import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lpkit  # noqa: E402


def run_untraced(spec):
    argv = lpkit.bench_argv(spec["binary"], spec["params"], spec["seed"])
    t0 = time.monotonic_ns()
    p = subprocess.run(argv, cwd=str(lpkit.ROOT), capture_output=True, text=True, timeout=120)
    wall_ns = time.monotonic_ns() - t0
    return p.returncode, lpkit.parse_elapsed_ns(p.stdout), wall_ns / 1e6, None, None


def run_traced(spec, mode, run_id, raw_dir):
    p = lpkit.run_lp(spec, run_id, raw_dir, tier=mode)
    if p.returncode != 0:
        return p.returncode, None, None, None, None
    meta = json.loads((Path(raw_dir) / "meta" / (run_id + ".json")).read_text())
    ok = 0 if meta["exit_reason"] == "exited_ok" else 1
    cpu = meta.get("launcher_cpu") or {}
    wall_s = meta["duration_ms"] / 1000.0
    pct_proc = None
    if cpu.get("utime_ticks") is not None and cpu.get("clk_tck"):
        pct_proc = 100.0 * (cpu["utime_ticks"] + cpu["stime_ticks"]) / cpu["clk_tck"] / wall_s
    pct_rusage = cpu.get("cpu_pct")
    return ok, lpkit.parse_elapsed_ns(p.stdout), meta["duration_ms"], pct_proc, pct_rusage


def iqr(s):
    return s.quantile(0.75) - s.quantile(0.25)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Measure per-tier overhead.")
    ap.add_argument("--config", default=str(lpkit.PHASE2_CONFIG))
    ap.add_argument("--reps", type=int, default=None)
    ap.add_argument("--raw", default=str(lpkit.DEFAULT_RAW / "overhead"))
    ap.add_argument("--out-dir", default=str(lpkit.ROOT / "results"))
    args = ap.parse_args(argv)

    cfg = lpkit.load_config(args.config)
    ocfg = cfg["overhead"]
    reps = args.reps or int(ocfg["reps"])
    modes = ocfg["modes"]
    session = time.strftime("ovh-%Y%m%d-%H%M%S")
    print("overhead: session={} reps={} modes={}".format(session, reps, modes))
    for line in lpkit.env_lines():
        print("  " + line)

    rows = []
    failures = 0
    for family, config_id in ocfg["families"].items():
        spec = next(lpkit.iter_specs(cfg, [family], [config_id], [int(ocfg["seed"])]))
        for rep in range(reps):
            for mode in modes:
                if mode == "untraced":
                    rc, el, wall, pct_proc, pct_ru = run_untraced(spec)
                else:
                    rid = "{}-{}-{}-r{:02d}".format(session, family, mode, rep)
                    rc, el, wall, pct_proc, pct_ru = run_traced(spec, mode, rid, args.raw)
                if rc != 0 or el is None:
                    failures += 1
                    print("  {} {} rep {}: FAILED (rc={})".format(family, mode, rep, rc))
                    continue
                rows.append({"family": family, "config_id": config_id, "mode": mode, "rep": rep,
                             "bench_ms": el / 1e6, "wall_ms": wall, "sampler_cpu_pct": pct_proc,
                             "sampler_cpu_pct_rusage": pct_ru})
                print("  {:<18} {:<8} rep {:>2}: bench {:8.1f} ms  launcher cpu {}".format(
                    family, mode, rep, el / 1e6,
                    "-" if pct_proc is None else "{:.2f}%".format(pct_proc)))

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    runs = pd.DataFrame(rows)
    runs.to_csv(out_dir / "overhead_runs.csv", index=False)

    summary = []
    for (family, mode), g in runs.groupby(["family", "mode"], sort=False):
        b = g["bench_ms"]
        c = g["sampler_cpu_pct"].dropna()
        summary.append({"family": family, "mode": mode, "n": len(g),
                        "bench_ms_median": b.median(), "bench_ms_q1": b.quantile(0.25),
                        "bench_ms_q3": b.quantile(0.75), "bench_ms_iqr": iqr(b),
                        "sampler_cpu_pct_median": c.median() if len(c) else None,
                        "sampler_cpu_pct_iqr": iqr(c) if len(c) else None})
    table = pd.DataFrame(summary)
    if len(table):
        base = table[table["mode"] == "untraced"].set_index("family")["bench_ms_median"]
        table["slowdown_vs_untraced"] = [r.bench_ms_median / base.get(r.family, float("nan"))
                                         for r in table.itertuples()]
        cols = ["family", "mode", "n", "bench_ms_median", "bench_ms_q1", "bench_ms_q3", "bench_ms_iqr",
                "slowdown_vs_untraced", "sampler_cpu_pct_median", "sampler_cpu_pct_iqr"]
        table = table[cols]
    table.to_csv(out_dir / "overhead.csv", index=False)
    print("")
    print(table.to_string(index=False, float_format=lambda v: "{:.3f}".format(v)))
    print("written: {} and {}".format(out_dir / "overhead.csv", out_dir / "overhead_runs.csv"))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
