"""ablations.py - phase-4 ablations: feature groups and sampling interval.

Choices are made exactly as in phase 3 (fit on TRAIN, alert threshold / T by
the validation rule); the numbers reported are on TEST. Hyperparameters of
M2/M3 are the frozen phase-3 ones, so only the ablated factor changes.

1. Feature groups (M2, M3; frozen W and hyperparameters):
     all          every feature
     no_syscall   without features derived from /proc/<tid>/syscall
     no_ctxsw     without context-switch features
     state_cpu    only thread state + CPU features
2. Sampling interval (M2, M3, B2): 5 ms ticks sub-sampled to every 2nd / 4th
   tick (10 / 20 ms). Features are rebuilt with the SAME window duration in ms
   (100 ms: W = 20 / 10 / 5 ticks; 100 ms is the shortest common window that
   is a whole number of ticks at all three intervals, so the 5 ms row is
   retrained at W = 20, not the frozen W = 10). The alert policy stays
   "3 consecutive ticks", so coarser sampling also costs alert latency. The
   onset tolerance stays 5 ms. A 2 ms interval would need re-collection and is
   not included.
"""
import time

import numpy as np
import pandas as pd

from ml import baselines as B
from ml import evaluate as E
from ml import features as F
from ml import train as T

SYSCALL_FEATURES = ["frac_futex", "frac_futex_whole", "frac_sleepio", "futex_silence_ms"]
CTXSW_FEATURES = ["vcsw_rate", "nvcsw_rate", "vcsw_rate_change", "nvcsw_rate_change", "futex_silence_ms"]
FEATURE_GROUPS = {
    "all": list(F.FEATURES),
    "no_syscall": [f for f in F.FEATURES if f not in SYSCALL_FEATURES],
    "no_ctxsw": [f for f in F.FEATURES if f not in CTXSW_FEATURES],
    "state_cpu": ["frac_S", "cpu_util_sum", "cpu_util_max"],
}
INTERVAL_STEPS = {5: 1, 10: 2, 20: 4}   # interval ms -> keep every n-th 5 ms tick
INTERVAL_WINDOW_MS = 100


def _alerts(runs, threshold):
    out = []
    for r in runs:
        a = r.alert_ns([threshold])[0]
        out.append({"family": r.family, "hang": r.hang, "t0": r.t0, "alert": None if a < 0 else int(a)})
    return out


def _runs_from_rows(df, scores, labels):
    return T.val_run_scores(df, scores, labels)


def fit_choose_report(name, params, cols, df, labels):
    """Fit on train rows, choose threshold on validation, report test. Returns (summary, per-family)."""
    tr = T.train_rows(df)
    va = df[df["split"] == "validation"]
    te = df[df["split"] == "test"]
    model = T.make_model(name, params).fit(tr[cols].to_numpy(), tr["y"].to_numpy())
    s_va = model.predict_proba(va[cols].to_numpy())[:, 1]
    pick, feasible = E.choose_threshold(E.sweep(_runs_from_rows(va, s_va, labels), E.candidate_thresholds(s_va)))
    th = pick["threshold"]
    s_te = model.predict_proba(te[cols].to_numpy())[:, 1]
    per_fam = E.per_family_metrics(_alerts(_runs_from_rows(te, s_te, labels), th))
    summary = dict(per_fam[0], threshold=th, feasible=feasible, val_detection_rate=pick["detection_rate"],
                   val_fa_rate=pick["fa_rate"], val_delay_median_ms=pick["delay_median_ms"],
                   test_pr_auc=E.pr_auc(te["y"].to_numpy(), s_te))
    return summary, per_fam


def feature_group_ablation(feats, labels, settings, verbose=True):
    rows, fam_rows = [], []
    for name in ("M2", "M3"):
        W, params = settings[name]["W"], settings[name]["params"]
        for group, cols in FEATURE_GROUPS.items():
            t = time.monotonic()
            summ, fam = fit_choose_report(name, params, cols, feats[W], labels)
            base = {"ablation": "features", "variant": group, "detector": name,
                    "setting": "W={} ({} ms), {} features".format(W, W * 5, len(cols))}
            rows.append(dict(base, **summ))
            fam_rows += [dict(base, **m) for m in fam]
            if verbose:
                print("  {} {:<10} test det={:.3f} fa={:.3f} delay={:.0f} ms ({:.1f}s)".format(
                    name, group, summ["detection_rate"], summ["fa_rate"],
                    np.nan_to_num(summ["delay_median_ms"], nan=-1), time.monotonic() - t))
    return rows, fam_rows


def _subsample(m, step):
    """Keep every step-th tick (rows); per-thread arrays such as tids are kept as is."""
    return {k: (v if k == "tids" else v[::step]) for k, v in m.items()}


def interval_datasets(data_dir, labels, verbose=True):
    """{interval_ms: (features DataFrame, {run_id: B2 ticks DataFrame} for val+test)}."""
    feats = {ms: [] for ms in INTERVAL_STEPS}
    b2 = {ms: {} for ms in INTERVAL_STEPS}
    t = time.monotonic()
    for k, r in enumerate(labels.itertuples(index=False), 1):
        meta = F.read_meta(data_dir, r.run_id)
        end_ns, tick_ms, cpu_tick_ms = F.run_timing(meta)
        full = F.thread_matrices(F.read_tierp(data_dir, r.run_id), end_ns)
        for ms, step in INTERVAL_STEPS.items():
            m = _subsample(full, step)
            W = INTERVAL_WINDOW_MS // ms
            f = F.run_features(None, W, tick_ms * step, cpu_tick_ms, mats=m)
            f.insert(0, "y", F.tick_labels(f["ts_ns"].to_numpy(), r.hang, r.t0_ns))
            f.insert(0, "split", r.split)
            f.insert(0, "family", r.family)
            f.insert(0, "run_id", r.run_id)
            feats[ms].append(f)
            if r.split in ("validation", "test"):
                b2[ms][r.run_id] = pd.DataFrame({"ts_ns": m["ts"], "B2": B.b2_scores(m)})
        if verbose and k % 200 == 0:
            print("  interval features: {}/{} runs ({:.0f} s)".format(k, len(labels), time.monotonic() - t))
    return {ms: (pd.concat(feats[ms], ignore_index=True), b2[ms]) for ms in INTERVAL_STEPS}


def _b2_runs(ticks_by_run, labels, split):
    lab = labels.set_index("run_id")
    runs = []
    for rid, ticks in ticks_by_run.items():
        r = lab.loc[rid]
        if r["split"] != split:
            continue
        runs.append(E.RunScores(rid, r["family"], r["hang"], r["t0_ns"], ticks["ts_ns"].to_numpy(),
                                ticks["B2"].to_numpy()))
    return runs


def interval_ablation(data_dir, labels, settings, verbose=True):
    rows, fam_rows = [], []
    data = interval_datasets(data_dir, labels, verbose)
    for ms, (df, b2) in data.items():
        W = INTERVAL_WINDOW_MS // ms
        base_info = {"ablation": "interval", "variant": "{} ms".format(ms)}
        for name in ("M2", "M3"):
            summ, fam = fit_choose_report(name, settings[name]["params"], F.FEATURES, df, labels)
            base = dict(base_info, detector=name, setting="W={} ticks ({} ms)".format(W, INTERVAL_WINDOW_MS))
            rows.append(dict(base, **summ))
            fam_rows += [dict(base, **m) for m in fam]
        sw = E.sweep(_b2_runs(b2, labels, "validation"), B.T_GRID_MS)
        pick, feasible = E.choose_threshold(sw)
        fam = E.per_family_metrics(_alerts(_b2_runs(b2, labels, "test"), pick["threshold"]))
        base = dict(base_info, detector="B2", setting="T={:.0f} ms".format(pick["threshold"]))
        rows.append(dict(base, **fam[0], threshold=pick["threshold"], feasible=feasible,
                         val_detection_rate=pick["detection_rate"], val_fa_rate=pick["fa_rate"],
                         val_delay_median_ms=pick["delay_median_ms"], test_pr_auc=np.nan))
        fam_rows += [dict(base, **m) for m in fam]
        if verbose:
            for r in rows[-3:]:
                print("  {:>5} {} test det={:.3f} fa={:.3f} delay={:.0f} ms".format(
                    r["variant"], r["detector"], r["detection_rate"], r["fa_rate"],
                    np.nan_to_num(r["delay_median_ms"], nan=-1)))
    return rows, fam_rows


ABLATION_COLUMNS = ["ablation", "variant", "detector", "setting", "threshold", "feasible", "val_detection_rate",
                    "val_fa_rate", "val_delay_median_ms", "runs", "hang_runs", "detected", "detection_rate",
                    "delay_median_ms", "delay_p90_ms", "fa_healthy", "fa_early", "fa_rate", "test_pr_auc"]


def run_ablations(data_dir, feats, labels, settings, verbose=True):
    if verbose:
        print("ablation 1: feature groups (M2, M3)")
    r1, f1 = feature_group_ablation(feats, labels, settings, verbose)
    if verbose:
        print("ablation 2: sampling interval (M2, M3, B2)")
    r2, f2 = interval_ablation(data_dir, labels, settings, verbose)
    table = pd.DataFrame(r1 + r2)[ABLATION_COLUMNS]
    per_family = pd.DataFrame(f1 + f2)
    return table, per_family
