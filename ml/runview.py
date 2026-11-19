"""runview.py - one recorded run, re-scored tick by tick with the frozen detectors.

Used by the phase-4 timeline figure and by `python -m demo.replay`. Everything
comes from the recorded traces (Tier P + Tier F) and the frozen phase-3
settings/models in results/phase3 (hashes verified unless verify=False), so it
works on any OS; no target program is run.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

from ml import baselines as B
from ml import evaluate as E
from ml import features as F

ROOT = F.ROOT
DETECTORS = ["B1", "B2", "B3", "B4", "M1", "M2", "M3"]
DETECTOR_NAMES = {"B1": "B1 fixed timeout", "B2": "B2 futex silence", "B3": "B3 wait-for graph",
                  "B4": "B4 progress watchdog", "M1": "M1 logistic regression", "M2": "M2 random forest",
                  "M3": "M3 gradient boosting"}
# per-thread state category for display: 0 running, 1 futex, 2 sleep/IO, 3 other blocked
STATE_CODES = {0: "run", 1: "futex", 2: "sleep/IO", 3: "blocked"}


def load_frozen(models_dir=None, verify=True):
    import joblib
    if verify:
        from ml import freeze
        freeze.verify()
    models_dir = Path(models_dir) if models_dir else ROOT / "results" / "phase3"
    settings = json.loads((models_dir / "chosen.json").read_text())["settings"]
    models = {n: joblib.load(models_dir / "models" / "{}.joblib".format(n)) for n in ("M1", "M2", "M3")}
    return settings, models


def b3_cycle(tierf):
    """(alert_ns, [tids in the cycle]) for the first wait-for cycle, or (None, [])."""
    alert = B.b3_alert_ns(tierf)
    if alert is None:
        return None, []
    df = tierf[tierf["ts_ns"] <= alert].sort_values("ts_ns", kind="stable")
    owner, waiting = {}, {}
    for tid, ev, obj in zip(df["tid"].to_numpy(), df["event"].to_numpy(), df["obj_addr"].to_numpy()):
        tid = int(tid)
        if ev == "MUTEX_REQ":
            waiting[tid] = obj
        elif ev == "MUTEX_ACQ":
            owner[obj] = tid
            waiting.pop(tid, None)
        elif ev == "MUTEX_REL" and owner.get(obj) == tid:
            del owner[obj]
        elif ev == "ERROR":
            waiting.pop(tid, None)
    last = int(df["tid"].iloc[-1])
    cyc, cur = [last], owner.get(waiting.get(last))
    while cur is not None and cur != last and cur not in cyc:
        cyc.append(cur)
        cur = owner.get(waiting.get(cur))
    return alert, cyc


class RunView:
    def __init__(self, data_dir, run_id, settings, models):
        self.run_id = run_id
        labels = pd.read_csv(Path(data_dir) / "processed" / "labels.csv", keep_default_na=False)
        lab = labels.set_index("run_id").loc[run_id]
        self.family, self.split = lab["family"], lab["split"]
        self.hang, self.deadlock, self.ambiguous = int(lab["hang"]), int(lab["deadlock"]), int(lab["ambiguous"])
        self.t0 = int(lab["t0_ns"]) if self.hang else None
        self.reason = lab["reason"]
        meta = F.read_meta(data_dir, run_id)
        self.meta = meta
        end_ns, tick_ms, cpu_tick_ms = F.run_timing(meta)
        self.tick_ms = tick_ms
        self.mats = F.thread_matrices(F.read_tierp(data_dir, run_id), end_ns)
        m = self.mats
        self.ts = m["ts"]
        self.start = int(self.ts[0])
        tierf = B.read_tierf(data_dir, run_id)
        start_ns = int(meta.get("exec_ns") or meta["start_ns"])

        cat = np.full(m["present"].shape, -1)
        cat[m["present"]] = 3
        cat[m["present"] & ~m["S"]] = 0
        cat[m["sleepio"]] = 2
        cat[m["futex"]] = 1
        self.state = cat                                   # ticks x threads, -1 = not alive
        self.futex_count = m["futex"].sum(axis=1)
        self.live = m["present"].sum(axis=1)

        self.scores = {"B1": B.b1_scores(m), "B2": B.b2_scores(m), "B4": B.b4_scores(self.ts, tierf, start_ns)}
        self.thresholds = {k: settings[k]["T_ms"] for k in ("B1", "B2", "B4")}
        for name in ("M1", "M2", "M3"):
            W = settings[name]["W"]
            f = F.run_features(None, W, tick_ms, cpu_tick_ms, mats=m)
            s = np.full(len(self.ts), np.nan)
            if len(f):
                s[np.searchsorted(self.ts, f["ts_ns"].to_numpy())] = \
                    models[name].predict_proba(f[F.FEATURES].to_numpy())[:, 1]
            self.scores[name] = s
            self.thresholds[name] = settings[name]["threshold"]
        self.alerts = {}
        for k in ("B1", "B2", "B4", "M1", "M2", "M3"):
            s = np.nan_to_num(self.scores[k], nan=-np.inf)
            self.alerts[k] = E.first_alert_ns(self.ts, s, self.thresholds[k])
        self.alerts["B3"], self.cycle_tids = b3_cycle(tierf)
        self.tids = [int(t) for t in m["tids"]]

    def outcome(self, det):
        return E.outcome(self.hang, self.t0, self.alerts[det])

    def rel_ms(self, ns):
        return None if ns is None else (ns - self.start) / 1e6
