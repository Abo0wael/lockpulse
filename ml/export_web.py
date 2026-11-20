"""export_web.py - data export for the LockPulse website.

  python -m ml.export_web [--out web/public/data]

Verifies the frozen phase-3 model hashes first (results/phase4/frozen.json), then
reads (never writes) the collected dataset in data/collect1 and the result tables
in results/phase3 and results/phase4. Writes static JSON to web/public/data/:
runs/<run_id>.json for ~40 curated runs (per-tick thread states, M1-M3 scores, B2
silence, alerts, Tier F events and wait-for graphs), plus index.json,
results_test.json, results_val.json, ablations.json, overhead.json and
benchmark.json (about 4 MB in total).
"""
import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from ml import baselines as B
from ml import features as F
from ml.runview import DETECTOR_NAMES, DETECTORS, RunView, load_frozen

ROOT = F.ROOT
RESULTS = ROOT / "results"
REPORT_RUNS = ["dining_philosophers-c1-s01", "sem_never_posted-c1-s01", "blocked_on_io-c1-s02",
               "sleeping_workers-c2-s06"]
PICKS = ["c1-s01", "c2-s02", "c4-s03"]           # 3 per family, varied configs (c4 = --force 0 for hangs)
STATE_CHARS = {-1: ".", 0: "R", 1: "F", 2: "I", 3: "B"}   # not alive, running, futex, sleep/IO, other blocked
EVENT_LOG_DEPTH = 12                              # events shown at the cursor
MAX_EVENT_SNAPSHOTS = 3000                        # graph snapshots per event up to this many, else per tick
WAIT_ENTER = {"MUTEX_REQ": "MUTEX_ACQ", "COND_WAIT_ENTER": "COND_WAIT_EXIT", "SEM_WAIT_ENTER": "SEM_WAIT_EXIT",
              "BARRIER_ENTER": "BARRIER_EXIT"}
SYSCALL_NAMES = {-3: "blocked (no syscall)", -2: "unreadable", -1: "running", 0: "read", 1: "write", 7: "poll",
                 17: "pread64", 23: "select", 35: "nanosleep", 61: "wait4", 202: "futex", 230: "clock_nanosleep",
                 232: "epoll_wait", 270: "pselect6", 271: "ppoll", 281: "epoll_pwait"}
FAMILY_INFO = {
    "two_lock_inversion": ("Deadlock", "Thread 1 holds lock A and waits for B; thread 2 holds B and waits for A."),
    "three_thread_cycle": ("Deadlock", "Three threads, three locks: A waits for B, B for C, C for A."),
    "dining_philosophers": ("Deadlock", "N philosophers each take the left fork, then wait for the right one."),
    "lost_wakeup": ("Hang", "A condition-variable signal is sent before the waiter waits, and the waiter has no predicate."),
    "prodcons_missing_signal": ("Hang", "The producer never signals the last item; consumers sleep forever."),
    "barrier_mismatch": ("Hang", "A barrier sized for N threads, but one thread leaves early."),
    "sem_never_posted": ("Hang", "Workers wait on a semaphore whose poster exits before posting."),
    "high_contention": ("Healthy", "16 threads keep one mutex about 90% busy; most are blocked in futex at any moment."),
    "long_critical_section": ("Healthy", "One thread holds a lock for 1-2.5 s of real work while the others wait."),
    "consistent_lock_order": ("Healthy", "Many locks, always taken in one global order: no cycle is possible."),
    "sleeping_workers": ("Healthy", "All threads sleep 1-2 s in nanosleep between two work phases."),
    "prodcons_correct": ("Healthy", "The same producer-consumer, with a predicate loop and a signal per item."),
    "blocked_on_io": ("Healthy", "Readers block in read() on a pipe whose writer pauses for 1-2 s."),
}


def rnd(x, nd=2):
    return None if x is None or (isinstance(x, float) and math.isnan(x)) else round(float(x), nd)


def score_list(s):
    """Model probabilities: 4 decimals normally, 7 near 1 (thresholds sit at 0.9996-0.999994)."""
    out = []
    for v in np.asarray(s, dtype=float):
        if v != v:
            out.append(None)
        elif v > 0.99:
            out.append(round(v, 7))
        else:
            out.append(round(v, 4))
    return out


def rle(values):
    """[[value, run_length], ...] for a per-tick sequence."""
    out = []
    for v in values:
        if out and out[-1][0] == v:
            out[-1][1] += 1
        else:
            out.append([v, 1])
    return out


def graph_state(owner, pending):
    held = sorted([o, t] for o, t in owner.items())
    wait = sorted([t, o, e.split("_")[0].lower()] for t, (e, o) in pending.items())
    edges = {t: owner.get(o) for t, (e, o) in pending.items() if e == "MUTEX_REQ" and owner.get(o) not in (None, t)}
    cycle = []
    for start in sorted(edges):
        seen, cur = [], start
        while cur in edges and cur not in seen:
            seen.append(cur)
            cur = edges[cur]
        if cur in seen:
            cycle = seen[seen.index(cur):]
            break
    return held, wait, cycle


def tierf_export(tierf, start, tick_ts):
    """Event log (only events that are among the last EVENT_LOG_DEPTH at some tick) and graph snapshots."""
    df = tierf.sort_values("ts_ns", kind="stable").reset_index(drop=True)
    ts = df["ts_ns"].to_numpy()
    ev = df["event"].to_numpy()
    tid = df["tid"].to_numpy()
    obj = df["obj_addr"].to_numpy()
    objs = sorted(set(obj))
    obj_idx = {o: i for i, o in enumerate(objs)}
    names = sorted(set(ev))
    ev_idx = {e: i for i, e in enumerate(names)}

    # events visible in the "last N" log at some tick
    ends = np.searchsorted(ts, tick_ts, side="right")
    keep = np.zeros(len(df), dtype=bool)
    for e in ends:
        keep[max(0, e - EVENT_LOG_DEPTH):e] = True
    events = [[rnd((ts[i] - start) / 1e6, 3), int(tid[i]), ev_idx[ev[i]], obj_idx[obj[i]]] for i in np.nonzero(keep)[0]]

    # graph snapshots: replay all events; record the graph whenever it changes
    owner, pending = {}, {}
    snaps, last = [], None
    change_ts = []
    for i in range(len(df)):
        t, e, o = int(tid[i]), ev[i], obj_idx[obj[i]]
        changed = False
        if e in WAIT_ENTER:
            pending[t] = (e, o)
            changed = True
        else:
            p = pending.get(t)
            if p is not None and (e == "ERROR" or WAIT_ENTER[p[0]] == e):
                del pending[t]
                changed = True
            if e == "MUTEX_ACQ":
                owner[o] = t
                changed = True
            elif e == "MUTEX_REL" and owner.get(o) == t:
                del owner[o]
                changed = True
        if changed:
            change_ts.append((i, graph_state(owner, pending)))
    per_event = len(change_ts) <= MAX_EVENT_SNAPSHOTS
    if per_event:
        for i, g in change_ts:
            if g != last:
                snaps.append([rnd((ts[i] - start) / 1e6, 3), g[0], g[1], g[2]])
                last = g
    else:
        # too many changes (e.g. high_contention): one snapshot per sampler tick, when it changed
        j = 0
        owner, pending = {}, {}
        for tk in tick_ts:
            while j < len(df) and ts[j] <= tk:
                t, e, o = int(tid[j]), ev[j], obj_idx[obj[j]]
                if e in WAIT_ENTER:
                    pending[t] = (e, o)
                else:
                    p = pending.get(t)
                    if p is not None and (e == "ERROR" or WAIT_ENTER[p[0]] == e):
                        del pending[t]
                    if e == "MUTEX_ACQ":
                        owner[o] = t
                    elif e == "MUTEX_REL" and owner.get(o) == t:
                        del owner[o]
                j += 1
            g = graph_state(owner, pending)
            if g != last:
                snaps.append([rnd((tk - start) / 1e6, 3), g[0], g[1], g[2]])
                last = g
    return {"eventNames": names, "objects": [str(o) for o in objs], "events": events,
            "eventsTotal": int(len(df)), "graphs": snaps, "graphGranularity": "event" if per_event else "tick"}


def export_run(data_dir, run_id, settings, models):
    v = RunView(data_dir, run_id, settings, models)
    tierp = F.read_tierp(data_dir, run_id)
    tierp = tierp[tierp["ts_ns"] <= int(v.meta["end_ns"])]
    sc = tierp.pivot_table(index="ts_ns", columns="tid", values="syscall_nr", aggfunc="last")
    sc = sc.reindex(index=v.ts, columns=v.tids)
    threads = []
    for j, t in enumerate(v.tids):
        col = sc.iloc[:, j].to_numpy()
        threads.append({"tid": int(t), "states": "".join(STATE_CHARS[int(c)] for c in v.state[:, j]),
                        "syscalls": rle([None if x != x else int(x) for x in col])})
    alerts = {d: rnd((a - v.start) / 1e6, 2) if a is not None else None for d, a in v.alerts.items()}
    outcomes = {}
    for d in DETECTORS:
        kind, delay = v.outcome(d)
        outcomes[d] = {"kind": kind, "delayMs": rnd(delay, 2)}
    tf = tierf_export(B.read_tierf(data_dir, run_id), v.start, v.ts)
    t_ms = (v.ts - v.start) / 1e6
    return {
        "runId": run_id, "family": v.family, "split": v.split,
        "truth": "deadlock" if v.deadlock else ("hang" if v.hang else "healthy"),
        "t0Ms": rnd((v.t0 - v.start) / 1e6, 2) if v.t0 is not None else None,
        "reason": v.reason, "tickMs": v.tick_ms, "nTicks": int(len(v.ts)),
        "tMs": [rnd(x, 1) for x in t_ms],
        "threads": threads, "futex": [int(x) for x in v.futex_count], "live": [int(x) for x in v.live],
        "scores": {"M1": score_list(v.scores["M1"]), "M2": score_list(v.scores["M2"]), "M3": score_list(v.scores["M3"]),
                   "B2": [int(round(x)) for x in v.scores["B2"]]},
        "thresholds": {k: (round(float(x), 7) if k.startswith("M") else round(float(x), 1))
                       for k, x in v.thresholds.items()},
        "alerts": alerts, "outcomes": outcomes, "cycleTids": [int(x) for x in v.cycle_tids],
        "tierF": tf,
    }


def curated_runs(labels):
    ok = labels[labels["ambiguous"].astype(int) == 0]
    ids = []
    for fam in sorted(ok["family"].unique()):
        fam_ids = set(ok.loc[ok["family"] == fam, "run_id"])
        for p in PICKS:
            rid = "{}-{}".format(fam, p)
            if rid not in fam_ids:   # fall back to the next seed of the same config
                cand = sorted(r for r in fam_ids if r.startswith("{}-{}".format(fam, p.split("-")[0])))
                rid = cand[0] if cand else None
            if rid and rid not in ids:
                ids.append(rid)
    for rid in REPORT_RUNS:
        if rid not in ids:
            ids.append(rid)
    return ids


def table_records(path):
    t = pd.read_csv(path)
    t["det"] = t["detector"].str.split().str[0]
    recs = []
    for r in t.itertuples(index=False):
        recs.append({"detector": r.det, "name": DETECTOR_NAMES[r.det][3:], "input": r.input, "setting": r.setting,
                     "scope": r.scope, "runs": int(r.runs), "hangRuns": int(r.hang_runs), "detected": int(r.detected),
                     "detectionRate": rnd(r.detection_rate, 4), "delayMedianMs": rnd(r.delay_median_ms, 3),
                     "delayP90Ms": rnd(r.delay_p90_ms, 3), "faHealthy": int(r.fa_healthy), "faEarly": int(r.fa_early),
                     "faRate": rnd(r.fa_rate, 4), "prAuc": rnd(r.pr_auc, 4)})
    return recs


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":"), allow_nan=False), encoding="utf-8", newline="\n")
    return path.stat().st_size


def main(argv=None):
    ap = argparse.ArgumentParser(description="Export static JSON for the LockPulse website.")
    ap.add_argument("--out", default=str(ROOT / "web" / "public" / "data"))
    args = ap.parse_args(argv)
    out = Path(args.out)
    data_dir = F.default_data_dir()
    settings, models = load_frozen(verify=True)
    print("frozen detectors verified; data:", data_dir)
    labels = pd.read_csv(data_dir / "processed" / "labels.csv", keep_default_na=False)

    sizes = {}
    index = []
    for rid in curated_runs(labels):
        run = export_run(data_dir, rid, settings, models)
        sizes["runs/" + rid] = write_json(out / "runs" / (rid + ".json"), run)
        index.append({"runId": rid, "family": run["family"], "split": run["split"], "truth": run["truth"],
                      "t0Ms": run["t0Ms"], "threads": len(run["threads"]), "durationMs": run["tMs"][-1],
                      "config": rid.split("-")[-2], "seed": int(rid.split("-s")[-1]),
                      "bytes": sizes["runs/" + rid]})
        print("  {:<34} {:>8} bytes  ticks={} threads={} events={}/{} graphs={} ({})".format(
            rid, sizes["runs/" + rid], run["nTicks"], len(run["threads"]), len(run["tierF"]["events"]),
            run["tierF"]["eventsTotal"], len(run["tierF"]["graphs"]), run["tierF"]["graphGranularity"]))
    sizes["index"] = write_json(out / "index.json", {"runs": index, "default": "dining_philosophers-c1-s01",
                                                     "detectors": DETECTOR_NAMES,
                                                     "syscallNames": {str(k): v for k, v in SYSCALL_NAMES.items()}})
    sizes["results_test"] = write_json(out / "results_test.json",
                                       {"split": "test", "rows": table_records(RESULTS / "phase4" / "test_table.csv")})
    sizes["results_val"] = write_json(out / "results_val.json", {
        "split": "validation", "rows": table_records(RESULTS / "phase3" / "validation_table.csv")})
    ab = pd.read_csv(RESULTS / "phase4" / "ablation_table.csv")
    sizes["ablations"] = write_json(out / "ablations.json", {"rows": [
        {"ablation": r.ablation, "variant": r.variant, "detector": r.detector, "setting": r.setting,
         "detected": int(r.detected), "hangRuns": int(r.hang_runs), "delayMedianMs": rnd(r.delay_median_ms, 2),
         "delayP90Ms": rnd(r.delay_p90_ms, 2), "faHealthy": int(r.fa_healthy), "faEarly": int(r.fa_early),
         "prAuc": rnd(r.test_pr_auc, 4), "valFaRate": rnd(r.val_fa_rate, 4)} for r in ab.itertuples(index=False)]})
    ovh = pd.read_csv(RESULTS / "phase4" / "overhead_table.csv")
    runs_o = pd.read_csv(RESULTS / "phase4" / "overhead_runs.csv")
    ov = []
    for r in ovh.itertuples(index=False):
        base = float(ovh[(ovh["family"] == r.family) & (ovh["mode"] == "untraced")]["bench_ms_median"].iloc[0])
        b = runs_o[(runs_o["family"] == r.family) & (runs_o["mode"] == r.mode)]["bench_ms"] / base
        ov.append({"family": r.family, "mode": r.mode, "n": int(r.n), "benchMsMedian": rnd(r.bench_ms_median, 2),
                   "slowdown": rnd(b.median(), 4), "q1": rnd(b.quantile(0.25), 4), "q3": rnd(b.quantile(0.75), 4),
                   "opsPerSec": rnd(r.ops_per_s_median, 0), "cpuPct": rnd(r.cpu_median, 2)})
    sizes["overhead"] = write_json(out / "overhead.json", {"rows": ov})
    ok = labels.copy()
    ok["hang"] = ok["hang"].astype(int)
    ok["ambiguous"] = ok["ambiguous"].astype(int)
    ok["deadlock"] = ok["deadlock"].astype(int)
    fams = []
    for fam, (kind, desc) in FAMILY_INFO.items():
        g = ok[ok["family"] == fam]
        fams.append({"family": fam, "kind": kind, "description": desc, "split": g["split"].iloc[0], "runs": int(len(g)),
                     "hang": int(((g["hang"] == 1) & (g["ambiguous"] == 0)).sum()),
                     "deadlock": int(g["deadlock"].sum()),
                     "healthy": int(((g["hang"] == 0) & (g["ambiguous"] == 0)).sum()),
                     "ambiguous": int(g["ambiguous"].sum())})
    sizes["benchmark"] = write_json(out / "benchmark.json", {"families": fams})
    total = sum(sizes.values())
    print("files: {}  total {:.2f} MB".format(len(sizes), total / 1e6))
    if total > 10e6:
        print("WARNING: export exceeds 10 MB")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
