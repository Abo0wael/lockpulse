#!/usr/bin/env python3
"""Phase-2 gate for LockPulse (`make check-phase2`; `make check-shim` = --shim-only).

1. Builds everything (make all).
2. Shim self-test:
   a. build/tests/shim_selftest untraced must exit 0;
   b. the same program under lp-run --tier F must exit 0, and the Tier F trace
      must contain exactly the event counts it prints (LPEXPECT lines), close
      every blocking call it opened, and pair every COND_WAIT_ENTER with an
      implicit MUTEX_REL / MUTEX_ACQ;
   c. lp-dump --info must show pthread_cond_* resolved with dlvsym (preferred
      version GLIBC_2.3.2) and sem_* / pthread_barrier_wait with dlvsym;
   d. lp-dump must still read a schema-v1 trace (backward compatibility).
3. Runs config c1, seed 1 of each of the 13 families in configs/phase2.json
   (tier PF), labels them with ml/label.py and asserts:
   every force=1 hang config -> hang=1; every healthy family -> exited_ok and
   hang=0; deadlock=1 exactly for the families with hang_type "deadlock";
   no run ambiguous.
4. Runs the oracle unit tests (ml/tests).
The report is also saved to results/check_phase2_latest.txt. Gate data goes to
data/raw/gate/ and data/processed/gate/ so it never mixes with the dataset.
Exit status: 0 if every assertion passed, 1 otherwise.
"""
import collections
import json
import struct
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "ml"))
import lpkit  # noqa: E402
import label  # noqa: E402

ROOT = lpkit.ROOT
GATE_RAW = ROOT / "data" / "raw" / "gate"
GATE_PROC = ROOT / "data" / "processed" / "gate"
SELFTEST = ROOT / "build" / "tests" / "shim_selftest"
REPORT = ROOT / "results" / "check_phase2_latest.txt"

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


def finish():
    if FAILURES:
        log("== RESULT: FAIL ({} assertion(s)) ==".format(len(FAILURES)))
        for f in FAILURES:
            log("  - " + f)
    else:
        log("== RESULT: PASS ==")
    try:
        REPORT.parent.mkdir(parents=True, exist_ok=True)
        REPORT.write_text("\n".join(LINES) + "\n")
    except OSError as exc:
        print("warning: could not write {}: {}".format(REPORT, exc), file=sys.stderr)
    sys.exit(1 if FAILURES else 0)


# ------------------------------------------------------------------ self-test

def write_v1_trace(path):
    """A minimal schema-v1 trace: 1 thread slot, 4 records/thread, 2 records written."""
    rpt, region = 4, 64 + 4 * 32
    hdr = struct.pack("<4sIIIIIQQIIQQ", b"LPTR", 1, 1, rpt, 4096, 32, region, 1, 1, 0, 0, 0)
    region_hdr = struct.pack("<QII", 2, 4242, 0) + bytes(48)
    recs = struct.pack("<QQQIHH", 1000, 0, 0xABC, 4242, 2, 0) + struct.pack("<QQQIHH", 2000, 1000, 0xABC, 4242, 3, 0)
    data = hdr + bytes(4096 - len(hdr)) + region_hdr + recs + bytes(2 * 32)
    Path(path).write_bytes(data)


def shim_selftest(session):
    log("== shim self-test ==")
    plain = subprocess.run([str(SELFTEST)], capture_output=True, text=True, timeout=60)
    check(plain.returncode == 0 and "selftest: ok" in plain.stdout,
          "selftest untraced: rc={} {}".format(plain.returncode, plain.stderr.strip()[-300:]))

    run_id = session + "-shim_selftest"
    cmd = [str(lpkit.LP_RUN), "--family", "shim_selftest", "--run-id", run_id, "--tier", "F",
           "--watchdog-ms", "5000", "--max-ms", "30000", "--data-dir", str(GATE_RAW), "--", str(SELFTEST)]
    traced = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True, timeout=90)
    if not check(traced.returncode == 0, "lp-run selftest rc={}: {}".format(traced.returncode, traced.stderr.strip())):
        return
    meta = json.loads((GATE_RAW / "meta" / (run_id + ".json")).read_text())
    check(meta["exit_reason"] == "exited_ok" and "selftest: ok" in traced.stdout,
          "selftest under shim: exit={} stderr={}".format(meta["exit_reason"], traced.stderr.strip()[-300:]))

    bin_path = GATE_RAW / "tierF" / (run_id + ".bin")
    csv_path = GATE_PROC / "tierF" / (run_id + ".csv")
    rc, err = lpkit.dump_tierf(bin_path, csv_path)
    if not check(rc == 0, "lp-dump selftest rc={} {}".format(rc, err)):
        return
    f = label.read_tierf_csv(csv_path)
    counts = collections.Counter(f["event"])
    log("  Tier F events: " + ", ".join("{}={}".format(k, v) for k, v in sorted(counts.items())))

    expected = {}
    for line in traced.stdout.splitlines():
        if line.startswith("LPEXPECT "):
            _, ev, n = line.split()
            expected[ev] = int(n)
    check(len(expected) >= 8, "selftest printed only {} LPEXPECT lines".format(len(expected)))
    for ev, n in sorted(expected.items()):
        check(counts.get(ev, 0) == n, "selftest: {} count {} != expected {}".format(ev, counts.get(ev, 0), n))

    implicit = f[f["site"] == 65535]
    n_enter = counts.get("COND_WAIT_ENTER", 0)
    n_irel = int((implicit["event"] == "MUTEX_REL").sum())
    n_iacq = int((implicit["event"] == "MUTEX_ACQ").sum())
    check(n_enter > 0, "selftest: no COND_WAIT_ENTER recorded")
    check(n_irel == n_enter and n_iacq == n_enter,
          "selftest: implicit REL={} ACQ={} vs COND_WAIT_ENTER={}".format(n_irel, n_iacq, n_enter))
    check(counts.get("COND_WAIT_EXIT", 0) == n_enter - 1,
          "selftest: COND_WAIT_EXIT={} expected ENTER-1={} (one timeout)".format(counts.get("COND_WAIT_EXIT", 0),
                                                                               n_enter - 1))
    state = label.replay(f)
    check(not state.pending, "selftest: blocking calls left open at exit: {}".format(state.pending))
    check(not state.owner, "selftest: mutexes still owned at exit: {}".format(state.owner))

    info = subprocess.run([str(lpkit.LP_DUMP), "--info", str(bin_path)], capture_output=True, text=True)
    kv = dict(l.split("=", 1) for l in info.stdout.splitlines() if "=" in l)
    log("  symbol resolution:")
    for k in sorted(kv):
        if k.startswith("resolve."):
            log("    {} = {}".format(k[len("resolve."):], kv[k]))
    check(kv.get("schema_version") == "2", "trace schema_version={}".format(kv.get("schema_version")))
    for fn in ("pthread_cond_wait", "pthread_cond_timedwait", "pthread_cond_signal", "pthread_cond_broadcast"):
        check(kv.get("resolve." + fn) == "dlvsym:preferred",
              "{} resolved via {} (want dlvsym GLIBC_2.3.2)".format(fn, kv.get("resolve." + fn)))
    for fn in ("sem_wait", "sem_timedwait", "sem_trywait", "sem_post", "pthread_barrier_wait"):
        check(str(kv.get("resolve." + fn, "")).startswith("dlvsym"),
              "{} resolved via {} (want dlvsym)".format(fn, kv.get("resolve." + fn)))

    with tempfile.TemporaryDirectory() as td:
        v1 = Path(td) / "v1.bin"
        write_v1_trace(v1)
        d = subprocess.run([str(lpkit.LP_DUMP), str(v1)], capture_output=True, text=True)
        rows = d.stdout.strip().splitlines()
        check(d.returncode == 0 and len(rows) == 3 and rows[1].split(",")[2] == "MUTEX_REQ"
              and rows[2].split(",")[2] == "MUTEX_ACQ",
              "lp-dump on a schema-v1 trace: rc={} out={!r} err={}".format(d.returncode, d.stdout, d.stderr.strip()))
    log("  self-test done")
    log("")


# --------------------------------------------------------------- family runs

def family_runs(session, cfg):
    log("== one run per family (config c1, seed 1, tier PF) ==")
    results = []
    for spec in lpkit.iter_specs(cfg, config_ids=["c1"], seeds=[1]):
        run_id = lpkit.run_id_for(spec["family"], spec["config_id"], spec["seed"], prefix=session + "-")
        p = lpkit.paths(GATE_RAW, GATE_PROC, run_id)
        try:
            proc = lpkit.run_lp(spec, run_id, GATE_RAW, tier="PF")
        except subprocess.TimeoutExpired:
            check(False, "{}: lp-run did not return".format(run_id))
            continue
        if not check(proc.returncode == 0 and p["meta"].exists(),
                     "{}: lp-run rc={} {}".format(run_id, proc.returncode, proc.stderr.strip()[-300:])):
            continue
        rc, err = lpkit.dump_tierf(p["tierF_bin"], p["tierF_csv"])
        check(rc == 0, "{}: lp-dump rc={} {}".format(run_id, rc, err))
        meta = json.loads(p["meta"].read_text())
        tierf = label.read_tierf_csv(p["tierF_csv"]) if p["tierF_csv"].exists() else None
        tierp = label.read_tierp_csv(p["tierP"]) if p["tierP"].exists() else None
        row = label.label_run(meta, tierf, tierp, split=spec["split"])
        row["duration_ms"] = meta.get("duration_ms")
        row["kind"] = spec["kind"]
        row["hang_type"] = spec["hang_type"]
        row["forced"] = spec["params"].get("force")
        results.append(row)
        log("  {:<26} {:<14} hang={} deadlock={} ambiguous={} {:.0f} ms".format(
            spec["family"], row["exit_reason"], row["hang"], row["deadlock"], row["ambiguous"],
            row["duration_ms"] or 0))

        fam = spec["family"]
        if spec["kind"] == "hang" and row["forced"] == 1:
            check(row["hang"] == 1, "{}: forced hang config labeled hang={} ({})".format(fam, row["hang"], row["reason"]))
        if spec["kind"] == "healthy":
            check(row["exit_reason"] == "exited_ok" and row["hang"] == 0,
                  "{}: healthy family exit={} hang={}".format(fam, row["exit_reason"], row["hang"]))
        want_dl = 1 if spec["hang_type"] == "deadlock" else 0
        check(row["deadlock"] == want_dl,
              "{}: deadlock={} expected {} ({})".format(fam, row["deadlock"], want_dl, row["reason"]))
        check(row["ambiguous"] == 0, "{}: ambiguous ({})".format(fam, row["reason"]))
    log("")
    if results:
        df = pd.DataFrame(results)
        GATE_PROC.mkdir(parents=True, exist_ok=True)
        df.to_csv(GATE_PROC / "labels_{}.csv".format(session), index=False)
        log("labels (reason truncated):")
        for r in results:
            log("  {}: {}".format(r["family"], str(r["reason"])[:220]))
        log("")


def unit_tests():
    log("== oracle unit tests (ml/tests) ==")
    p = subprocess.run([sys.executable, "-m", "unittest", "discover", "-s", "ml/tests", "-v"],
                       cwd=str(ROOT), capture_output=True, text=True, timeout=300)
    tail = (p.stdout + p.stderr).strip().splitlines()[-6:]
    for line in tail:
        log("  " + line)
    check(p.returncode == 0, "ml unit tests failed")
    log("")


def main():
    shim_only = "--shim-only" in sys.argv[1:]
    session = time.strftime("p2-%Y%m%d-%H%M%S")
    log("== LockPulse phase-2 gate  session={} ==".format(session))
    for line in lpkit.env_lines():
        log(line)
    log("")

    log("== build ==")
    b = lpkit.make_all()
    log(b.stdout.strip())
    if b.stderr.strip():
        log(b.stderr.strip())
    if not check(b.returncode == 0, "build failed"):
        finish()
    log("")

    shim_selftest(session)
    if not shim_only:
        family_runs(session, lpkit.load_config())
        unit_tests()
    finish()


if __name__ == "__main__":
    main()
