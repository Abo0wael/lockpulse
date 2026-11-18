#!/usr/bin/env python3
"""Phase-1 gate for LockPulse (`make check-phase1`).

1. Builds everything (make all).
2. Runs each family in configs/phase1.json with --tier PF for every seed, plus
   the overhead family once with --tier P, once with --tier F and once with no
   tracing at all.
3. Asserts expected exit reasons, non-empty Tier P / Tier F data, timestamp
   ranges inside [start_ns, end_ns] and overlapping (same clock), no tracebuf
   overflow, and that every watchdog kill happened >= watchdog_ms after the
   last Tier F progress event.
4. Prints a per-run summary table and the overhead numbers.
5. Prints the tail of one deadlock run (Tier F + Tier P) for a human to read.

Raw data goes to data/raw/ (immutable; run ids carry a session timestamp so
nothing is ever overwritten). Tier F CSVs produced by lp-dump are derived data
and go to data/processed/tierF/. The printed report is also saved to
results/check_phase1_latest.txt.

Exit status: 0 if every assertion passed, 1 otherwise.
Dependencies: Python 3 standard library + pandas.
"""
import json
import subprocess
import sys
import time
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
LP_RUN = BUILD / "lp-run"
LP_DUMP = BUILD / "lp-dump"
RAW = ROOT / "data" / "raw"
PROC_F = ROOT / "data" / "processed" / "tierF"
RESULTS = ROOT / "results"
CONFIG = ROOT / "configs" / "phase1.json"
REPORT = RESULTS / "check_phase1_latest.txt"

PROGRESS_EVENTS = ("MUTEX_ACQ", "MUTEX_REL")
SYSCALL_NAMES = {202: "futex", 7: "poll", 230: "clock_nanosleep", 61: "wait4",
                 -1: "running", -2: "unreadable", -3: "blocked-no-syscall"}

LINES = []
FAILURES = []


def log(msg=""):
    print(msg, flush=True)
    LINES.append(msg)


def check(cond, msg):
    if not cond:
        FAILURES.append(msg)
        log("  FAIL: " + msg)
    return bool(cond)


def first_line(cmd):
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        text = (out.stdout or out.stderr).strip()
        return text.splitlines()[0] if text else "(no output)"
    except (OSError, subprocess.SubprocessError) as exc:
        return "unavailable ({})".format(exc)


def bench_cmd(cfg, seed):
    args = [str(ROOT / cfg["binary"])]
    for key, val in cfg.get("params", {}).items():
        args += ["--" + key.replace("_", "-"), str(val)]
    args += ["--seed", str(seed)]
    return args


def parse_elapsed_ns(text):
    for line in text.splitlines():
        if line.startswith("elapsed_ns="):
            try:
                return int(line.split("=", 1)[1])
            except ValueError:
                return None
    return None


def run_lp(session, family, cfg, defaults, seed, tier):
    run_id = "{}-{}-s{}-{}".format(session, family, seed, tier)
    watchdog_ms = cfg.get("watchdog_ms", defaults["watchdog_ms"])
    max_ms = cfg.get("max_ms", defaults["max_ms"])
    cmd = [str(LP_RUN), "--family", family, "--run-id", run_id, "--tier", tier,
           "--interval-ms", str(defaults["interval_ms"]),
           "--watchdog-ms", str(watchdog_ms), "--max-ms", str(max_ms),
           "--data-dir", str(RAW), "--"] + bench_cmd(cfg, seed)
    run = {"run_id": run_id, "family": family, "seed": seed, "tier": tier,
           "watchdog_ms": watchdog_ms, "meta": None, "p_df": None, "f_df": None,
           "dump_rc": None, "stdout": "", "stderr": ""}
    try:
        proc = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True,
                              timeout=max_ms / 1000.0 + 60)
    except subprocess.TimeoutExpired:
        check(False, "{}: lp-run did not return (launcher itself hung)".format(run_id))
        return run
    run["stdout"], run["stderr"] = proc.stdout, proc.stderr
    if not check(proc.returncode == 0, "{}: lp-run exited {}: {}".format(
            run_id, proc.returncode, proc.stderr.strip()[-400:])):
        return run

    run["meta"] = json.loads((RAW / "meta" / (run_id + ".json")).read_text())
    if "P" in tier:
        run["p_df"] = pd.read_csv(RAW / "tierP" / (run_id + ".csv"))
    if "F" in tier:
        PROC_F.mkdir(parents=True, exist_ok=True)
        out = PROC_F / (run_id + ".csv")
        with open(out, "w") as fh:
            dump = subprocess.run([str(LP_DUMP), str(RAW / "tierF" / (run_id + ".bin"))],
                                  stdout=fh, stderr=subprocess.PIPE, text=True)
        run["dump_rc"] = dump.returncode
        check(dump.returncode in (0, 3), "{}: lp-dump failed ({}): {}".format(
            run_id, dump.returncode, dump.stderr.strip()))
        run["f_df"] = pd.read_csv(out, dtype={"event": str, "obj_addr": str})
    return run


def validate(run, expected_exit):
    rid, m = run["run_id"], run["meta"]
    if m is None:
        return
    check(m["exit_reason"] == expected_exit,
          "{}: exit_reason={} expected {}".format(rid, m["exit_reason"], expected_exit))
    for w in m.get("warnings", []):
        log("  note: {}: {}".format(rid, w))

    start, end = m["start_ns"], m["end_ns"]
    ranges = {}
    for name, df in (("Tier P", run["p_df"]), ("Tier F", run["f_df"])):
        if df is None:
            continue
        if not check(len(df) > 0, "{}: {} CSV is empty".format(rid, name)):
            continue
        lo, hi = int(df["ts_ns"].min()), int(df["ts_ns"].max())
        ranges[name] = (lo, hi)
        check(start <= lo and hi <= end,
              "{}: {} ts range [{}, {}] not inside run [{}, {}]".format(rid, name, lo, hi, start, end))
    if len(ranges) == 2:
        (plo, phi), (flo, fhi) = ranges["Tier P"], ranges["Tier F"]
        check(max(plo, flo) <= min(phi, fhi),
              "{}: Tier P [{}, {}] and Tier F [{}, {}] do not overlap".format(rid, plo, phi, flo, fhi))

    tf = m.get("tierF")
    if tf is not None:
        check(not tf["overflow"], "{}: tracebuf overflow (flags={}, dropped={})".format(
            rid, tf["overflow_flags"], tf["dropped_records"]))
        check(run["dump_rc"] != 3, "{}: lp-dump reports overflow".format(rid))

    last = last_progress_ns(run)
    if m["exit_reason"] == "watchdog_kill" and last is not None and m.get("kill_ns") is not None:
        gap_ns = m["kill_ns"] - last
        check(gap_ns >= run["watchdog_ms"] * 1_000_000,
              "{}: killed {:.1f} ms after last progress event, watchdog is {} ms".format(
                  rid, gap_ns / 1e6, run["watchdog_ms"]))


def last_progress_ns(run):
    f = run["f_df"]
    if f is None or len(f) == 0:
        return None
    prog = f[f["event"].isin(PROGRESS_EVENTS)]
    return int(prog["ts_ns"].max()) if len(prog) else None


def ms_since(m, ns):
    if ns is None or m is None:
        return "-"
    return "{:.1f}".format((ns - m["start_ns"]) / 1e6)


def summary_table(runs):
    hdr = ("family", "seed", "tier", "exit_reason", "dur_ms", "P_rows", "P_ticks",
           "F_events", "last_prog_ms", "kill_ms")
    rows = []
    for r in runs:
        m = r["meta"]
        if m is None:
            rows.append((r["family"], str(r["seed"]), r["tier"], "LAUNCH_FAILED") + ("-",) * 6)
            continue
        tp = m.get("tierP") or {}
        rows.append((
            r["family"], str(r["seed"]), r["tier"], m["exit_reason"],
            "{:.1f}".format(m["duration_ms"]),
            str(tp.get("samples", "-")), str(tp.get("ticks", "-")),
            str(len(r["f_df"])) if r["f_df"] is not None else "-",
            ms_since(m, last_progress_ns(r)),
            ms_since(m, m.get("kill_ns")),
        ))
    widths = [max([len(h)] + [len(row[i]) for row in rows]) for i, h in enumerate(hdr)]
    fmt = "  ".join("{:<%d}" % w for w in widths)
    log(fmt.format(*hdr))
    log(fmt.format(*("-" * w for w in widths)))
    for row in rows:
        log(fmt.format(*row))
    log("(times are ms since the run's start_ns; last_prog = last Tier F MUTEX_ACQ/REL)")


def deadlock_detail(run):
    m, f, p = run["meta"], run["f_df"], run["p_df"]
    if m is None or f is None or p is None:
        log("(no deadlock run data to show)")
        return
    start = m["start_ns"]
    log("Run {}  exit={}  kill at {} ms".format(run["run_id"], m["exit_reason"], ms_since(m, m.get("kill_ns"))))
    log("")
    log("Last 10 Tier F events:")
    tail = f.tail(10).copy()
    tail.insert(0, "t_ms", ((tail["ts_ns"] - start) / 1e6).round(3))
    log(tail[["t_ms", "tid", "event", "obj_addr", "wait_ns"]].to_string(index=False))
    log("")
    log("Last 3 Tier P samples per thread:")
    last = p.sort_values(["tid", "ts_ns"]).groupby("tid").tail(3).copy()
    last.insert(0, "t_ms", ((last["ts_ns"] - start) / 1e6).round(3))
    last["syscall"] = last["syscall_nr"].map(lambda n: SYSCALL_NAMES.get(int(n), str(n)))
    log(last[["t_ms", "tid", "state", "utime_ticks", "stime_ticks", "vcsw", "nvcsw",
              "syscall_nr", "syscall"]].to_string(index=False))
    final = p.sort_values("ts_ns").groupby("tid").tail(1)
    in_futex = int((final["syscall_nr"] == 202).sum())
    log("")
    log("Observation: {} of {} threads were in futex (202) at the last sample.".format(in_futex, len(final)))


def main():
    cfg = json.loads(CONFIG.read_text())
    defaults, families = cfg["defaults"], cfg["families"]
    session = time.strftime("p1-%Y%m%d-%H%M%S")

    log("== LockPulse phase-1 gate  session={} ==".format(session))
    log("uname : " + first_line(["uname", "-a"]))
    log("gcc   : " + first_line(["gcc", "--version"]))
    log("glibc : " + first_line(["ldd", "--version"]))
    log("python: {}  pandas: {}".format(sys.version.split()[0], pd.__version__))
    log("")

    log("== build ==")
    b = subprocess.run(["make", "all"], cwd=str(ROOT), capture_output=True, text=True)
    log(b.stdout.strip())
    if b.stderr.strip():
        log(b.stderr.strip())
    if b.returncode != 0:
        log("FAIL: build failed")
        finish(1)
    log("")

    runs = []
    log("== PF runs ==")
    for family, fcfg in families.items():
        for seed in cfg["seeds"]:
            log("run {} seed={} tier=PF".format(family, seed))
            r = run_lp(session, family, fcfg, defaults, seed, "PF")
            validate(r, fcfg["expected_exit"])
            runs.append(r)
    log("")

    log("== overhead runs ==")
    ofam = cfg["overhead"]["family"]
    oseed = cfg["overhead"]["seed"]
    ocfg = families[ofam]
    overhead_runs = {}
    for tier in ("P", "F"):
        log("run {} seed={} tier={}".format(ofam, oseed, tier))
        r = run_lp(session, ofam, ocfg, defaults, oseed, tier)
        validate(r, ocfg["expected_exit"])
        runs.append(r)
        overhead_runs[tier] = r
    overhead_runs["PF"] = next((r for r in runs if r["family"] == ofam and r["seed"] == oseed
                                and r["tier"] == "PF"), None)

    log("run {} seed={} untraced".format(ofam, oseed))
    t0 = time.monotonic_ns()
    plain = subprocess.run(bench_cmd(ocfg, oseed), cwd=str(ROOT), capture_output=True, text=True, timeout=60)
    plain_wall_ns = time.monotonic_ns() - t0
    check(plain.returncode == 0, "untraced {} exited {}".format(ofam, plain.returncode))
    plain_elapsed = parse_elapsed_ns(plain.stdout)
    log("")

    log("== summary ==")
    summary_table(runs)
    log("")

    log("== overhead ({} seed={}, single run each - a first number, not a benchmark) ==".format(ofam, oseed))
    log("{:<10} {:>14} {:>14} {:>10}".format("mode", "bench_ms", "wall_ms", "x_untraced"))
    log("{:<10} {:>14} {:>14} {:>10}".format(
        "untraced", "{:.2f}".format(plain_elapsed / 1e6) if plain_elapsed else "-",
        "{:.2f}".format(plain_wall_ns / 1e6), "1.00"))
    for tier in ("P", "F", "PF"):
        r = overhead_runs.get(tier)
        if r is None or r["meta"] is None:
            log("{:<10} {:>14}".format("tier " + tier, "n/a"))
            continue
        el = parse_elapsed_ns(r["stdout"])
        ratio = "{:.2f}".format(el / plain_elapsed) if el and plain_elapsed else "-"
        log("{:<10} {:>14} {:>14} {:>10}".format(
            "tier " + tier, "{:.2f}".format(el / 1e6) if el else "-",
            "{:.2f}".format(r["meta"]["duration_ms"]), ratio))
    log("(bench_ms = the benchmark's own elapsed_ns; wall_ms = lp-run start..end incl. fork/exec, "
        "or Python-measured for untraced)")
    log("")

    log("== deadlock detail ==")
    dl = next((r for r in runs if r["family"] == "two_lock_inversion" and r["tier"] == "PF"
               and r["meta"] is not None), None)
    if dl is not None:
        deadlock_detail(dl)
    else:
        log("(no two_lock_inversion PF run completed)")
    log("")

    if FAILURES:
        log("== RESULT: FAIL ({} assertion(s)) ==".format(len(FAILURES)))
        for f in FAILURES:
            log("  - " + f)
        finish(1)
    log("== RESULT: PASS ==")
    finish(0)


def finish(code):
    try:
        RESULTS.mkdir(parents=True, exist_ok=True)
        REPORT.write_text("\n".join(LINES) + "\n")
    except OSError as exc:
        print("warning: could not write {}: {}".format(REPORT, exc), file=sys.stderr)
    sys.exit(code)


if __name__ == "__main__":
    main()
