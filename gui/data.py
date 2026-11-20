"""Read-only data access for the LockPulse Explorer GUI.

Everything comes from the collected dataset (data/collect1), the frozen phase-3
detectors (results/phase3, hashes verified) and the result tables in results/.
Nothing is trained, tuned or written here.
"""
from pathlib import Path

import numpy as np
import pandas as pd

from ml import baselines as B
from ml import features as F
from ml.runview import DETECTOR_NAMES, DETECTORS, RunView, load_frozen

ROOT = F.ROOT
RESULTS = ROOT / "results"

SYSCALL_NAMES = {
    -3: "blocked (no syscall)", -2: "unreadable", -1: "running", 0: "read", 1: "write", 7: "poll", 17: "pread64",
    23: "select", 35: "nanosleep", 61: "wait4", 202: "futex", 230: "clock_nanosleep", 232: "epoll_wait",
    270: "pselect6", 271: "ppoll", 281: "epoll_pwait",
}
STATE_NAMES = {-1: "not alive", 0: "running", 1: "futex", 2: "sleep / IO", 3: "other blocked"}
WAIT_ENTER = {"MUTEX_REQ": "MUTEX_ACQ", "COND_WAIT_ENTER": "COND_WAIT_EXIT", "SEM_WAIT_ENTER": "SEM_WAIT_EXIT",
              "BARRIER_ENTER": "BARRIER_EXIT"}


def data_dir():
    return F.default_data_dir()


def labels():
    """All runs with their label (ambiguous ones included, marked)."""
    lab = pd.read_csv(data_dir() / "processed" / "labels.csv", keep_default_na=False)
    lab["hang"] = lab["hang"].astype(int)
    lab["deadlock"] = lab["deadlock"].astype(int)
    lab["ambiguous"] = lab["ambiguous"].astype(int)
    lab["t0_ns"] = pd.to_numeric(lab["t0_ns"], errors="coerce")
    lab["truth"] = np.where(lab["ambiguous"] == 1, "ambiguous",
                            np.where(lab["deadlock"] == 1, "deadlock", np.where(lab["hang"] == 1, "hang", "healthy")))
    return lab


def frozen():
    """(settings, models) of the frozen phase-3 detectors; verifies the freeze hashes."""
    return load_frozen(verify=True)


def syscall_name(nr):
    nr = int(nr)
    return SYSCALL_NAMES.get(nr, "syscall {}".format(nr))


def run_data(run_id, settings, models):
    """Everything the replay page needs for one run, as plain picklable objects."""
    v = RunView(data_dir(), run_id, settings, models)
    tierp = F.read_tierp(data_dir(), run_id)
    end_ns = int(v.meta["end_ns"])
    tierp = tierp[tierp["ts_ns"] <= end_ns]
    sc = tierp.pivot_table(index="ts_ns", columns="tid", values="syscall_nr", aggfunc="last")
    sc = sc.reindex(index=v.ts, columns=v.tids)
    tierf = B.read_tierf(data_dir(), run_id).sort_values("ts_ns", kind="stable").reset_index(drop=True)
    return {
        "run_id": run_id, "family": v.family, "split": v.split, "hang": v.hang, "deadlock": v.deadlock,
        "ambiguous": v.ambiguous, "t0": v.t0, "reason": v.reason, "start": v.start, "tick_ms": v.tick_ms,
        "ts": v.ts, "t_ms": (v.ts - v.start) / 1e6, "tids": v.tids, "state": v.state,
        "syscall": sc.to_numpy(), "futex_count": v.futex_count, "live": v.live,
        "scores": {k: np.asarray(s) for k, s in v.scores.items()}, "thresholds": dict(v.thresholds),
        "alerts": dict(v.alerts), "cycle_tids": list(v.cycle_tids),
        "outcomes": {d: v.outcome(d) for d in DETECTORS}, "tierf": tierf,
    }


def tick_index(rd, t_ms):
    """Index of the last tick at or before t_ms."""
    return int(max(0, np.searchsorted(rd["t_ms"], t_ms, side="right") - 1))


def tierf_state(tierf, until_ns):
    """Replay Tier F up to until_ns: (owner {mutex: tid}, pending {tid: (event, obj)}, cycle [tids])."""
    df = tierf[tierf["ts_ns"] <= until_ns]
    owner, pending = {}, {}
    for tid, ev, obj in zip(df["tid"].to_numpy(), df["event"].to_numpy(), df["obj_addr"].to_numpy()):
        tid = int(tid)
        if ev in WAIT_ENTER:
            pending[tid] = (ev, obj)
            continue
        p = pending.get(tid)
        if p is not None and (ev == "ERROR" or WAIT_ENTER[p[0]] == ev):
            del pending[tid]
        if ev == "MUTEX_ACQ":
            owner[obj] = tid
        elif ev == "MUTEX_REL" and owner.get(obj) == tid:
            del owner[obj]
    # wait-for cycle among pending MUTEX_REQs
    edges = {t: owner.get(o) for t, (e, o) in pending.items() if e == "MUTEX_REQ" and owner.get(o) not in (None, t)}
    cycle = []
    for start in edges:
        seen, cur = [], start
        while cur in edges and cur not in seen:
            seen.append(cur)
            cur = edges[cur]
        if cur in seen:
            cycle = seen[seen.index(cur):]
            break
    return owner, pending, cycle


def wait_for_dot(owner, pending, cycle, colors):
    """Graphviz DOT: threads (boxes) and sync objects (ellipses); holds / waits edges; cycle in red."""
    cyc = set(cycle)
    objs = set(owner) | {o for _e, o in pending.values()}
    threads = set(owner.values()) | set(pending)
    layout = 'layout=circo; mindist=0.6;' if cycle else 'rankdir=LR;'   # a cycle reads best as a ring
    lines = ['digraph G {', 'bgcolor="transparent"; ' + layout,
             'node [fontname="Helvetica", fontsize=11, fontcolor="#e6edf3", color="#30363d", style=filled, '
             'fillcolor="#161b22"]; edge [fontname="Helvetica", fontsize=9];']
    for t in sorted(threads):
        col = colors["red"] if t in cyc else "#8b949e"
        lines.append('"t{0}" [label="thread {0}", shape=box, color="{1}", penwidth=2];'.format(t, col))
    kinds = {}
    for e, o in pending.values():
        kinds[o] = e.split("_")[0].lower()
    for o in sorted(objs):
        kind = "mutex" if o in owner or kinds.get(o) == "mutex" else kinds.get(o, "obj")
        lines.append('"o{0}" [label="{1} ..{3}", shape=ellipse, color="{2}"];'.format(
            o, kind, colors["amber"] if kind == "mutex" else colors["blue"], str(o)[-4:]))
    for o, t in owner.items():
        lines.append('"o{0}" -> "t{1}" [label="held by", color="{2}", fontcolor="{2}"];'.format(o, t, colors["green"]))
    for t, (e, o) in pending.items():
        in_cycle = t in cyc and e == "MUTEX_REQ"
        col = colors["red"] if in_cycle else (colors["amber"] if e == "MUTEX_REQ" else colors["blue"])
        style = "solid" if e == "MUTEX_REQ" else "dashed"
        lab = "waits" if e == "MUTEX_REQ" else e.replace("_ENTER", "").lower().replace("_", " ")
        lines.append('"t{0}" -> "o{1}" [label="{2}", color="{3}", fontcolor="{3}", style={4}, penwidth={5}];'.format(
            t, o, lab, col, style, 2.5 if in_cycle else 1.2))
    if not objs:
        lines.append('empty [label="no lock held, no thread waiting", shape=plaintext, style="", fontcolor="#8b949e"];')
    lines.append("}")
    return "\n".join(lines)


def result_table(split):
    path = RESULTS / ("phase4" if split == "test" else "phase3") / "{}_table.csv".format(split)
    t = pd.read_csv(path)
    t["det"] = t["detector"].str.split().str[0]
    return t


def ablation_table():
    return pd.read_csv(RESULTS / "phase4" / "ablation_table.csv")


def overhead():
    """(summary per family/mode, per-run bench_ms) from results/phase4."""
    return pd.read_csv(RESULTS / "phase4" / "overhead_table.csv"), pd.read_csv(RESULTS / "phase4" / "overhead_runs.csv")


__all__ = ["DETECTORS", "DETECTOR_NAMES", "STATE_NAMES"]
