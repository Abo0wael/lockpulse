"""evaluate.py - alert policy, run-level metrics and the threshold rule (phase 3).

Alert policy (models and B1/B2/B4 alike): a run raises its FIRST alert at the
first tick where the score has been >= threshold for K=3 consecutive ticks.
Only the first alert counts (the detector is advisory; it warns once):
  * healthy run:  any alert                          -> false alarm
  * hang run:     first alert before t0 - TOL         -> false alarm ("early"), not detected
                  first alert at/after t0 - TOL       -> detected, delay = alert - t0
                  no alert                            -> missed
TOL = one sampler tick (5 ms), for every detector: t0 (the last Tier F
progress event) can trail the actual onset by a few microseconds when a
bystander thread logs one last progress event, so an alert up to one tick
before t0 is on time. Delays can therefore be slightly negative (>= -5 ms).
B3 has no score; its alert time comes straight from the Tier F replay.

Run-level metrics: detection rate = detected / hang runs; delay median and
p90 (ms, detected hang runs); false alarms = healthy runs alerted + hang runs
alerted early; false-alarm rate = false alarms / all runs.

Threshold rule (every detector with a threshold): maximise the detection rate
subject to false-alarm rate <= 5 % of the runs; tie-break by lower median
delay, then by the larger threshold. If no threshold meets the 5 % bound, the
one with the lowest false-alarm rate is taken (and flagged infeasible).

The TEST split is off limits in phase 3: check_split() refuses it unless the
caller passes final=True (phase 4 only); nothing in phase 3 does.
"""
import argparse
import sys

import numpy as np
import pandas as pd

K_CONSECUTIVE = 3
MAX_FA_RATE = 0.05
ONSET_TOLERANCE_NS = 5_000_000  # one 5 ms sampler tick


class TestSplitRefused(SystemExit):
    pass


def check_split(split, final=False):
    if split == "test" and not final:
        raise TestSplitRefused("evaluate: split=test is reserved for the final phase-4 evaluation "
                               "(pass --final there); phase 3 uses validation only")
    return split


# ------------------------------------------------------------ alert policy

def sustained(scores, k=K_CONSECUTIVE):
    """m[i] = min(scores[i-k+1..i]); -inf for the first k-1 ticks."""
    s = np.asarray(scores, dtype=float)
    out = np.full(len(s), -np.inf)
    if len(s) >= k:
        win = np.lib.stride_tricks.sliding_window_view(s, k)
        out[k - 1:] = win.min(axis=1)
    return out


def first_alert_ns(ts, scores, threshold, k=K_CONSECUTIVE):
    """Timestamp of the first alert under the K-consecutive policy, or None."""
    m = sustained(scores, k)
    hit = np.nonzero(m >= threshold)[0]
    return int(np.asarray(ts)[hit[0]]) if len(hit) else None


class RunScores:
    """Per-run scores prepared for fast threshold sweeps."""

    def __init__(self, run_id, family, hang, t0_ns, ts, scores, k=K_CONSECUTIVE):
        self.run_id, self.family, self.hang = run_id, family, int(hang)
        self.t0 = int(t0_ns) if self.hang else None
        self.ts = np.asarray(ts, dtype=np.int64)
        self.cummax = np.maximum.accumulate(sustained(scores, k)) if len(self.ts) else np.array([])

    def alert_ns(self, thresholds):
        """First alert time per threshold (int64 array; -1 = no alert)."""
        thr = np.atleast_1d(np.asarray(thresholds, dtype=float))
        if len(self.cummax) == 0:
            return np.full(len(thr), -1, dtype=np.int64)
        idx = np.searchsorted(self.cummax, thr, side="left")
        out = np.full(len(thr), -1, dtype=np.int64)
        ok = idx < len(self.cummax)
        out[ok] = self.ts[idx[ok]]
        return out


def _missing(v):
    return v is None or (isinstance(v, float) and np.isnan(v))


def outcome(hang, t0, alert, tol_ns=ONSET_TOLERANCE_NS):
    """('fa_healthy' | 'ok_healthy' | 'fa_early' | 'detected' | 'missed', delay_ms).
    alert/t0 may be None or NaN (as they come back from a DataFrame) for 'none'."""
    alert = None if _missing(alert) else int(alert)
    hang = int(hang)
    if hang:
        t0 = int(t0)
    if not hang:
        return ("fa_healthy", None) if alert is not None else ("ok_healthy", None)
    if alert is None:
        return "missed", None
    if alert < t0 - tol_ns:
        return "fa_early", None
    return "detected", (alert - t0) / 1e6


def metrics_from_alerts(rows, tol_ns=ONSET_TOLERANCE_NS):
    """rows: iterable of (hang, t0, alert_ns or None). Returns a metrics dict."""
    n = n_hang = det = fa_h = fa_e = 0
    delays = []
    for hang, t0, alert in rows:
        n += 1
        n_hang += int(bool(hang))
        kind, delay = outcome(hang, t0, alert, tol_ns)
        if kind == "detected":
            det += 1
            delays.append(delay)
        elif kind == "fa_healthy":
            fa_h += 1
        elif kind == "fa_early":
            fa_e += 1
    d = np.array(delays)
    return {
        "runs": n, "hang_runs": n_hang, "healthy_runs": n - n_hang, "detected": det,
        "detection_rate": det / n_hang if n_hang else float("nan"),
        "delay_median_ms": float(np.median(d)) if len(d) else float("nan"),
        "delay_p90_ms": float(np.percentile(d, 90)) if len(d) else float("nan"),
        "fa_healthy": fa_h, "fa_early": fa_e,
        "fa_rate": (fa_h + fa_e) / n if n else float("nan"),
    }


def sweep(runs, thresholds, tol_ns=ONSET_TOLERANCE_NS):
    """Metrics for every threshold over a list of RunScores (vectorised per run)."""
    thresholds = np.asarray(thresholds, dtype=float)
    alerts = np.stack([r.alert_ns(thresholds) for r in runs]) if runs else np.zeros((0, len(thresholds)))
    out = []
    for j, th in enumerate(thresholds):
        rows = [(r.hang, r.t0, None if alerts[i, j] < 0 else int(alerts[i, j])) for i, r in enumerate(runs)]
        m = metrics_from_alerts(rows, tol_ns)
        m["threshold"] = float(th)
        out.append(m)
    return pd.DataFrame(out)


def choose_threshold(table, max_fa=MAX_FA_RATE):
    """Apply the threshold rule to a sweep() table. Returns (row as dict, feasible)."""
    t = table.copy()
    t["_delay"] = t["delay_median_ms"].fillna(np.inf)
    feas = t[t["fa_rate"] <= max_fa + 1e-12]
    if len(feas):
        best = feas.sort_values(["detection_rate", "_delay", "threshold"],
                                ascending=[False, True, False], kind="stable").iloc[0]
        return best.drop("_delay").to_dict(), True
    best = t.sort_values(["fa_rate", "detection_rate", "_delay"],
                         ascending=[True, False, True], kind="stable").iloc[0]
    return best.drop("_delay").to_dict(), False


def candidate_thresholds(scores, n=200):
    """Quantile grid over pooled scores (for continuous model scores)."""
    s = np.asarray(scores, dtype=float)
    s = s[np.isfinite(s)]
    if len(s) == 0:
        return np.array([0.5])
    q = np.unique(np.quantile(s, np.linspace(0.0, 1.0, n)))
    return np.unique(np.concatenate([q, [np.nextafter(s.max(), np.inf)]]))


# ------------------------------------------------------------ reporting

def per_family_metrics(alert_rows, tol_ns=ONSET_TOLERANCE_NS):
    """alert_rows: list of dicts with family, hang, t0, alert. Overall + per family."""
    def triples(rows):
        return [(r["hang"], r["t0"], r["alert"]) for r in rows]  # plain Python: no NaN coercion

    res = [dict(scope="overall", **metrics_from_alerts(triples(alert_rows), tol_ns))]
    for fam in sorted({r["family"] for r in alert_rows}):
        res.append(dict(scope=fam, **metrics_from_alerts(triples([r for r in alert_rows if r["family"] == fam]),
                                                         tol_ns)))
    return res


def pr_auc(y, scores):
    from sklearn.metrics import average_precision_score  # only needed when reporting
    y = np.asarray(y)
    if y.min() == y.max():
        return float("nan")
    return float(average_precision_score(y, np.nan_to_num(np.asarray(scores, dtype=float), nan=0.0)))


TABLE_COLUMNS = ["detector", "input", "setting", "scope", "runs", "hang_runs", "detected",
                 "detection_rate", "delay_median_ms", "delay_p90_ms", "fa_healthy", "fa_early",
                 "fa_rate", "pr_auc"]


def format_markdown(table):
    t = table.copy()
    for c in ("detection_rate", "fa_rate", "pr_auc"):
        t[c] = t[c].map(lambda v: "" if pd.isna(v) else "{:.3f}".format(v))
    for c in ("delay_median_ms", "delay_p90_ms"):
        t[c] = t[c].map(lambda v: "" if pd.isna(v) else "{:.0f}".format(v))
    cols = list(t.columns)
    lines = ["| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
    for _, r in t.iterrows():
        lines.append("| " + " | ".join(str(r[c]) for c in cols) + " |")
    return "\n".join(lines)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Evaluate saved phase-3 detectors on a split.")
    ap.add_argument("--split", default="validation", choices=["train", "validation", "test"])
    ap.add_argument("--final", action="store_true", help="phase 4 only: allow split=test")
    ap.add_argument("--data", default=None)
    ap.add_argument("--features-dir", default=None)
    ap.add_argument("--out", default=None, help="default: results/phase4 with --final, else results/phase3")
    ap.add_argument("--models-dir", default=None, help="settings + models (default: results/phase3)")
    args = ap.parse_args(argv)
    check_split(args.split, args.final)
    from ml import phase3  # late import: phase3 imports this module
    phase3.evaluate_saved(args.split, args.final, args.data, args.features_dir, args.out, args.models_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
