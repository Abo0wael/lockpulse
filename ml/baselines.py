"""baselines.py - rule-based detectors B1-B4 (phase 3).

All four produce a per-run alert time and use the same alert policy as the
models (see ml/evaluate.py): a per-tick score must stay at or above the
threshold for K=3 consecutive Tier P ticks.

  B1 fixed timeout (Tier P)    score = ms since the total CPU time of all live
                                threads last increased (utime+stime, 10 ms ticks).
  B2 futex silence (Tier P)    score = ms for which every live thread has been
                                in futex (syscall 202) with no context switch.
  B3 wait-for graph (Tier F)   alert at the first MUTEX_REQ that closes a cycle
                                in the mutex ownership graph (owners from
                                MUTEX_ACQ/REL incl. the implicit cond-wait
                                REL/ACQ). No threshold. Exact for mutex
                                deadlocks, blind to every other hang.
  B4 progress watchdog (Tier F) score = ms since the last Tier F progress event
                                (same set as the phase-2 watchdog / ml/label.py).
B1, B2 and B4 are evaluated on the run's Tier P tick grid; their threshold T
comes from T_GRID_MS and is chosen on validation (ml/evaluate.choose_threshold).
"""
from pathlib import Path

import numpy as np
import pandas as pd

from ml import features as F

T_GRID_MS = (50, 100, 200, 300, 500, 750, 1000, 1500, 2000)
# keep in sync with runtime/tracebuf.h lp_is_progress() and ml/label.py
PROGRESS_EVENTS = frozenset({
    "MUTEX_ACQ", "MUTEX_REL", "COND_SIGNAL", "COND_BROADCAST", "COND_WAIT_EXIT",
    "SEM_POST", "SEM_WAIT_EXIT", "BARRIER_EXIT",
})
WAIT_EXIT = {"MUTEX_REQ": "MUTEX_ACQ", "COND_WAIT_ENTER": "COND_WAIT_EXIT",
             "SEM_WAIT_ENTER": "SEM_WAIT_EXIT", "BARRIER_ENTER": "BARRIER_EXIT"}


def read_tierf(data_dir, run_id):
    path = F.existing_csv(Path(data_dir) / "processed" / "tierF" / (run_id + ".csv"))
    if path is None:
        raise FileNotFoundError("Tier F CSV missing for " + run_id)
    return pd.read_csv(path, usecols=["ts_ns", "tid", "event", "obj_addr"],
                       dtype={"event": str, "obj_addr": str})


def _accumulate_silence(ts, quiet):
    """ms since the condition `quiet` became continuously true (0 when false)."""
    out = np.zeros(len(ts))
    gap = np.diff(ts, prepend=ts[:1]) / 1e6 if len(ts) else ts
    for i in range(1, len(ts)):
        out[i] = out[i - 1] + gap[i] if quiet[i] else 0.0
    return out


def b1_scores(m):
    """B1: ms since the summed CPU time of all live threads last increased."""
    cpu = m["cpu"]
    d = cpu[1:] - cpu[:-1]                      # NaN where the thread is new or gone
    grew = np.concatenate([[True], (np.where(np.isnan(d), 0.0, d) > 0).any(axis=1)])
    return _accumulate_silence(m["ts"], ~grew)


def b2_scores(m):
    """B2: ms for which every live thread has sat in futex with no context switch."""
    cs = m["vcs"] + m["nvcs"]
    pres = m["present"]
    ok = np.zeros(len(m["ts"]), dtype=bool)
    if len(ok) > 1:
        same = (cs[1:] == cs[:-1]) & pres[:-1]  # new threads count as a change
        cond = (m["futex"][1:] & same) | ~pres[1:]
        ok[1:] = cond.all(axis=1) & pres[1:].any(axis=1)
    return _accumulate_silence(m["ts"], ok)


def b4_scores(ts, tierf, start_ns):
    """B4: ms since the last Tier F progress event at or before each tick."""
    ts = np.asarray(ts)
    prog = np.sort(tierf.loc[tierf["event"].isin(PROGRESS_EVENTS), "ts_ns"].to_numpy())
    idx = np.searchsorted(prog, ts, side="right") - 1
    last = np.where(idx >= 0, prog[np.maximum(idx, 0)] if len(prog) else start_ns, start_ns)
    return np.maximum(ts - last, 0) / 1e6


def b3_alert_ns(tierf):
    """B3: timestamp of the first MUTEX_REQ that closes a wait-for cycle, or None.

    Ownership comes from MUTEX_ACQ / MUTEX_REL (explicit and the implicit ones
    logged inside pthread_cond_wait). A thread waits on a mutex from its
    MUTEX_REQ until MUTEX_ACQ or ERROR."""
    df = tierf.sort_values("ts_ns", kind="stable")
    owner, waiting = {}, {}
    for ts, tid, ev, obj in zip(df["ts_ns"].to_numpy(), df["tid"].to_numpy(),
                                df["event"].to_numpy(), df["obj_addr"].to_numpy()):
        tid = int(tid)
        if ev == "MUTEX_REQ":
            waiting[tid] = obj
            cur, seen = tid, set()
            while cur not in seen:
                seen.add(cur)
                m = waiting.get(cur)
                holder = owner.get(m) if m is not None else None
                if holder is None:
                    break
                if holder == tid:
                    return int(ts)
                cur = holder
        elif ev == "MUTEX_ACQ":
            owner[obj] = tid
            waiting.pop(tid, None)
        elif ev == "MUTEX_REL":
            if owner.get(obj) == tid:
                del owner[obj]
        elif ev == "ERROR":
            waiting.pop(tid, None)
    return None


def run_baselines(data_dir, run_id):
    """Per-tick B1/B2/B4 scores (ms) on the Tier P tick grid + the B3 alert time."""
    meta = F.read_meta(data_dir, run_id)
    end_ns, _tick_ms, _cpu = F.run_timing(meta)
    m = F.thread_matrices(F.read_tierp(data_dir, run_id), end_ns)
    tierf = read_tierf(data_dir, run_id)
    start = int(meta.get("exec_ns") or meta["start_ns"])
    ticks = pd.DataFrame({"ts_ns": m["ts"], "B1": b1_scores(m), "B2": b2_scores(m),
                          "B4": b4_scores(m["ts"], tierf, start)})
    return ticks, b3_alert_ns(tierf)


def compute_baselines(data_dir, labels):
    """{run_id: (ticks DataFrame, b3_alert_ns)} for the given label rows."""
    return {r.run_id: run_baselines(data_dir, r.run_id) for r in labels.itertuples(index=False)}
