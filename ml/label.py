#!/usr/bin/env python3
"""label.py - ground-truth oracle for LockPulse runs (phase 2).

Inputs per run: metadata JSON (data/raw/meta/<id>.json), Tier F CSV
(data/processed/tierF/<id>.csv, produced by lp-dump) and Tier P CSV
(data/raw/tierP/<id>.csv). Output: data/processed/labels.csv with columns

  run_id, family, split, config_id, seed, force, exit_reason,
  hang, t0_ns, deadlock, ambiguous, reason

Rules (guide "Ground truth", refined for phase 2):
  * Progress events = the events that drive the shim's progress counter:
    MUTEX_ACQ, MUTEX_REL, COND_SIGNAL, COND_BROADCAST, COND_WAIT_EXIT,
    SEM_POST, SEM_WAIT_EXIT, BARRIER_EXIT (incl. the implicit mutex events the
    shim logs inside pthread_cond_wait).
  * exited_ok                      -> hang=0.
  * watchdog_kill                  -> t0 = last progress event. hang=1 if every
    live thread (threads in the last Tier P snapshot, zombies excluded) is
    blocked from t0 on:
      - per Tier F it has a pending MUTEX_REQ / COND_WAIT_ENTER / SEM_WAIT_ENTER /
        BARRIER_ENTER not closed by its exit event or by ERROR, or
      - it has no pending Tier F wait (e.g. main in pthread_join, never seen by
        the shim) and per Tier P it stays in state S or D with no utime/stime
        change in every sample at or after t0.
    Otherwise ambiguous.
  * deadlock=1 when hang=1 and the final mutex wait-for graph (owners from
    ACQ/REL incl. implicit cond events, edges from pending MUTEX_REQ) has a
    cycle; the cycle is spelled out in `reason`.
  * ambiguous=1 for: watchdog_kill failing the all-blocked check, max_time_kill,
    exit by signal, exit with an error code, tracebuf overflow, missing data.
    Ambiguous rows always have hang=0, deadlock=0 and are excluded from
    training later.
Tier P is used here for LABELS only; it is never a model feature in this step.

Pure Python + pandas. Usage:
  python3 ml/label.py [--raw data/raw] [--processed data/processed]
                      [--config configs/phase2.json] [--out data/processed/labels.csv]
                      [--summary results/labels_summary.txt] [RUN_ID ...]
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent

PROGRESS_EVENTS = frozenset({
    "MUTEX_ACQ", "MUTEX_REL", "COND_SIGNAL", "COND_BROADCAST", "COND_WAIT_EXIT",
    "SEM_POST", "SEM_WAIT_EXIT", "BARRIER_EXIT",
})
# blocking call entry -> the event that ends it normally (ERROR also ends it)
WAIT_EXIT = {
    "MUTEX_REQ": "MUTEX_ACQ",
    "COND_WAIT_ENTER": "COND_WAIT_EXIT",
    "SEM_WAIT_ENTER": "SEM_WAIT_EXIT",
    "BARRIER_ENTER": "BARRIER_EXIT",
}
BLOCKED_STATES = frozenset({"S", "D"})
GONE_STATES = frozenset({"Z", "X", "x"})

LABEL_COLUMNS = ["run_id", "family", "split", "config_id", "seed", "force", "exit_reason",
                 "hang", "t0_ns", "deadlock", "ambiguous", "reason"]


class TraceState:
    """Result of replaying a Tier F trace."""

    def __init__(self):
        self.pending = {}   # tid -> (event, obj, ts)  open blocking call
        self.owner = {}     # mutex obj -> tid
        self.last_progress_ns = None
        self.tids = set()


def replay(tierf):
    """Replay Tier F events (sorted by ts_ns) into final pending/ownership state."""
    st = TraceState()
    if tierf is None or len(tierf) == 0:
        return st
    df = tierf.sort_values("ts_ns", kind="stable")
    for ts, tid, ev, obj in zip(df["ts_ns"].to_numpy(), df["tid"].to_numpy(),
                                df["event"].to_numpy(), df["obj_addr"].to_numpy()):
        tid = int(tid)
        ts = int(ts)
        st.tids.add(tid)
        if ev in PROGRESS_EVENTS:
            st.last_progress_ns = ts
        if ev in WAIT_EXIT:
            st.pending[tid] = (ev, obj, ts)
            continue
        p = st.pending.get(tid)
        if p is not None and (ev == "ERROR" or WAIT_EXIT[p[0]] == ev):
            del st.pending[tid]
        if ev == "MUTEX_ACQ":
            st.owner[obj] = tid
        elif ev == "MUTEX_REL":
            if st.owner.get(obj) == tid:
                del st.owner[obj]
    return st


def find_cycle(state):
    """Wait-for cycle among pending MUTEX_REQs. Returns [(tid, mutex), ...] or None."""
    edges = {}
    for tid, (ev, obj, _ts) in state.pending.items():
        if ev != "MUTEX_REQ":
            continue
        holder = state.owner.get(obj)
        if holder is not None and holder != tid:
            edges[tid] = (holder, obj)
    done = set()
    for start in sorted(edges):
        if start in done:
            continue
        path, index = [], {}
        node = start
        while node in edges and node not in done and node not in index:
            index[node] = len(path)
            path.append(node)
            node = edges[node][0]
        if node in index:  # closed a loop inside this walk
            cyc = path[index[node]:]
            return [(t, edges[t][1]) for t in cyc]
        done.update(path)
    return None


def format_cycle(cycle):
    parts = ["{} -[{}]->".format(tid, obj) for tid, obj in cycle]
    return " ".join(parts) + " {}".format(cycle[0][0])


def _int_or_blank(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return ""


def label_run(meta, tierf, tierp, split="", config_id=""):
    """Label one run. tierf/tierp are DataFrames (or None). Returns a dict row."""
    tags = meta.get("tags") or {}
    params = meta.get("params") or {}
    row = {
        "run_id": meta.get("run_id", ""),
        "family": meta.get("family", ""),
        "split": tags.get("split", split) or split,
        "config_id": tags.get("config_id", config_id) or config_id,
        "seed": _int_or_blank(meta.get("seed")),
        "force": _int_or_blank(params.get("force", tags.get("force"))),
        "exit_reason": meta.get("exit_reason", ""),
        "hang": 0,
        "t0_ns": "",
        "deadlock": 0,
        "ambiguous": 0,
        "reason": "",
    }

    def ambiguous(why):
        row.update(hang=0, deadlock=0, t0_ns="", ambiguous=1, reason="ambiguous: " + why)
        return row

    exit_reason = row["exit_reason"]
    tf_meta = meta.get("tierF") or {}
    if tf_meta.get("overflow"):
        return ambiguous("tracebuf overflow (flags={}, dropped={})".format(
            tf_meta.get("overflow_flags"), tf_meta.get("dropped_records")))
    if exit_reason == "exited_ok":
        row["reason"] = "exited normally"
        return row
    if exit_reason == "max_time_kill":
        return ambiguous("max_time_kill (progress continued until the hard cap)")
    if exit_reason.startswith("signaled"):
        return ambiguous("terminated by signal: " + exit_reason)
    if exit_reason.startswith("exited_error"):
        return ambiguous("benchmark failed: " + exit_reason)
    if exit_reason != "watchdog_kill":
        return ambiguous("unknown exit reason " + repr(exit_reason))

    if tierf is None or len(tierf) == 0:
        return ambiguous("watchdog_kill without Tier F events")
    if tierp is None or len(tierp) == 0:
        return ambiguous("watchdog_kill without Tier P samples")

    state = replay(tierf)
    t0 = state.last_progress_ns
    t0_note = ""
    if t0 is None:
        t0 = int(meta.get("exec_ns") or meta.get("start_ns") or 0)
        t0_note = " (no progress event at all; t0 = exec)"

    last_tick = int(tierp["ts_ns"].max())
    snap = tierp[tierp["ts_ns"] == last_tick]
    live = sorted(int(t) for t, s in zip(snap["tid"], snap["state"]) if str(s) not in GONE_STATES)
    after = tierp[tierp["ts_ns"] >= t0]

    blocked, running = [], []
    for tid in live:
        p = state.pending.get(tid)
        if p is not None:
            blocked.append("{} {}({})".format(tid, p[0], p[1]))
            continue
        rows = after[after["tid"] == tid]
        if len(rows) == 0:
            running.append("{} no Tier P sample after t0".format(tid))
            continue
        states = set(str(s) for s in rows["state"])
        cpu = rows["utime_ticks"].astype("int64") + rows["stime_ticks"].astype("int64")
        cpu_delta = int(cpu.max() - cpu.min())
        if states <= BLOCKED_STATES and cpu_delta == 0:
            blocked.append("{} P:{} no-cpu".format(tid, "/".join(sorted(states))))
        else:
            running.append("{} states={} cpu_delta={}".format(tid, "".join(sorted(states)), cpu_delta))

    if running:
        return ambiguous("watchdog_kill but not all live threads blocked since t0: " + "; ".join(running))
    if not live:
        return ambiguous("watchdog_kill with no live thread in the last Tier P sample")

    row["hang"] = 1
    row["t0_ns"] = int(t0)
    reason = "hang: all {} live threads blocked since t0{}: {}".format(len(live), t0_note, "; ".join(blocked))
    cycle = find_cycle(state)
    if cycle:
        row["deadlock"] = 1
        reason += " | deadlock cycle: " + format_cycle(cycle)
    row["reason"] = reason
    return row


# ----------------------------------------------------------------- file level

def read_tierf_csv(path):
    return pd.read_csv(path, dtype={"event": str, "obj_addr": str})


def read_tierp_csv(path):
    return pd.read_csv(path, dtype={"state": str})


def ensure_tierf_csv(raw_dir, processed_dir, run_id):
    """Return the Tier F CSV path, creating it with build/lp-dump if only the .bin exists."""
    csv = Path(processed_dir) / "tierF" / (run_id + ".csv")
    if csv.exists():
        return csv
    binf = Path(raw_dir) / "tierF" / (run_id + ".bin")
    dump = ROOT / "build" / "lp-dump"
    if binf.exists() and dump.exists():
        csv.parent.mkdir(parents=True, exist_ok=True)
        with open(csv, "w") as fh:
            p = subprocess.run([str(dump), str(binf)], stdout=fh, stderr=subprocess.PIPE)
        if p.returncode in (0, 3):
            return csv
        csv.unlink()
    return None


def label_files(raw_dir, processed_dir, run_id, config=None):
    raw_dir, processed_dir = Path(raw_dir), Path(processed_dir)
    meta = json.loads((raw_dir / "meta" / (run_id + ".json")).read_text())
    split = ""
    if config is not None:
        split = config.get("families", {}).get(meta.get("family"), {}).get("split", "")
    fcsv = ensure_tierf_csv(raw_dir, processed_dir, run_id)
    pcsv = raw_dir / "tierP" / (run_id + ".csv")
    tierf = read_tierf_csv(fcsv) if fcsv is not None else None
    tierp = read_tierp_csv(pcsv) if pcsv.exists() else None
    return label_run(meta, tierf, tierp, split=split)


def label_all(raw_dir, processed_dir, config=None, run_ids=None):
    meta_dir = Path(raw_dir) / "meta"
    ids = run_ids or sorted(p.stem for p in meta_dir.glob("*.json"))
    rows = [label_files(raw_dir, processed_dir, rid, config) for rid in ids]
    return pd.DataFrame(rows, columns=LABEL_COLUMNS)


def summarize(labels):
    lines = []
    if len(labels) == 0:
        return ["no runs labeled"]
    lab = labels.assign(healthy=((labels["hang"] == 0) & (labels["ambiguous"] == 0)).astype(int))
    g = lab.groupby("family")
    table = pd.DataFrame({
        "split": g["split"].first(),
        "runs": g.size(),
        "hang": g["hang"].sum(),
        "deadlock": g["deadlock"].sum(),
        "healthy": g["healthy"].sum(),
        "ambiguous": g["ambiguous"].sum(),
    })
    lines.append(table.to_string())
    amb = int(labels["ambiguous"].sum())
    lines.append("")
    lines.append("total runs={} hang={} deadlock={} ambiguous={} ({:.1f}%)".format(
        len(labels), int(labels["hang"].sum()), int(labels["deadlock"].sum()), amb,
        100.0 * amb / len(labels)))
    return lines


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--raw", default=str(ROOT / "data" / "raw"))
    ap.add_argument("--processed", default=str(ROOT / "data" / "processed"))
    ap.add_argument("--config", default=str(ROOT / "configs" / "phase2.json"))
    ap.add_argument("--out", default=None, help="default: <processed>/labels.csv")
    ap.add_argument("--summary", default=None, help="also write the summary to this file")
    ap.add_argument("run_ids", nargs="*")
    args = ap.parse_args(argv)

    config = json.loads(Path(args.config).read_text()) if Path(args.config).exists() else None
    labels = label_all(args.raw, args.processed, config, args.run_ids or None)
    out = Path(args.out) if args.out else Path(args.processed) / "labels.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    labels.to_csv(out, index=False)
    lines = summarize(labels)
    print("\n".join(lines))
    print("labels written to {}".format(out))
    if args.summary:
        Path(args.summary).parent.mkdir(parents=True, exist_ok=True)
        Path(args.summary).write_text("\n".join(lines) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
