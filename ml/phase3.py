"""phase3.py - end-to-end phase-3 runner: features -> baselines -> train -> evaluate.

  python -m ml.phase3 [--data DIR] [--features-dir data/processed] [--out results/phase3]
                      [--rebuild-features]

Uses TRAIN runs to fit M1-M3 and VALIDATION runs for every choice (window W,
hyperparameters, alert thresholds, baseline T) and for the reported table.
The TEST split is never used: features are built for it (cheap, same code) but
no model, threshold or table touches it, and evaluate refuses it without
--final (phase 4).

Outputs in --out:
  validation_table.csv / .md   all 7 detectors, overall and per validation family
  chosen.json                  every chosen setting (+ excluded runs, versions)
  model_search.csv             every (model, W, hyperparameters) candidate on validation
  baseline_sweeps.csv          B1/B2/B4 metrics for every T in the grid
  feature_importance.csv       permutation importance (validation, average precision) for M2/M3
  models/M1.joblib ...         fitted models
"""
import argparse
import json
import platform
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

from ml import baselines as B
from ml import evaluate as E
from ml import features as F
from ml import train as T

ROOT = F.ROOT
PR_AUC_W = max(F.WINDOWS)  # common tick set for window-level PR-AUC: ticks >= max(W)


def _utf8_stdout():
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(errors="replace")
        except (AttributeError, ValueError):
            pass


def ensure_features(data, features_dir, rebuild):
    missing = [W for W in F.WINDOWS if not (Path(features_dir) / "features_W{}.csv.gz".format(W)).exists()]
    if rebuild or missing:
        F.build_features(data, features_dir, F.WINDOWS)
    else:
        print("features: using existing {}/features_W{{{}}}.csv.gz (--rebuild-features to recompute)".format(
            features_dir, ",".join(str(w) for w in F.WINDOWS)))
    return {W: F.load_features(features_dir, W) for W in F.WINDOWS}


def apply_label_splits(feats, labels):
    """labels.csv is the authority for split (it follows configs/phase2.json); cached
    feature files may predate a split change."""
    split_of = labels.set_index("run_id")["split"]
    for W, df in feats.items():
        s = df["run_id"].map(split_of)
        if s.isna().any():
            raise SystemExit("features_W{} has runs that are not in labels.csv: {}".format(
                W, sorted(df.loc[s.isna(), "run_id"].unique())[:5]))
        df["split"] = s.to_numpy()
    return feats


def baseline_runscores(base, labels, key):
    lab = labels.set_index("run_id")
    runs = []
    for rid, (ticks, _b3) in base.items():
        r = lab.loc[rid]
        runs.append(E.RunScores(rid, r["family"], r["hang"], r["t0_ns"], ticks["ts_ns"].to_numpy(),
                                ticks[key].to_numpy()))
    return runs


def choose_baselines(base, labels):
    """T for B1/B2/B4 on the given (validation) runs. Returns (settings, sweeps DataFrame)."""
    settings, sweeps = {}, []
    for key in ("B1", "B2", "B4"):
        sw = E.sweep(baseline_runscores(base, labels, key), B.T_GRID_MS)
        pick, feasible = E.choose_threshold(sw)
        settings[key] = {"T_ms": pick["threshold"], "feasible": feasible}
        sw.insert(0, "detector", key)
        sweeps.append(sw)
    return settings, pd.concat(sweeps, ignore_index=True)


def detector_table(split, labels, feats, base, settings, models):
    """Run-level + PR-AUC table for all 7 detectors on one split."""
    E.check_split(split, final=(split == "test" and settings.get("_final", False)))
    lab = labels.set_index("run_id")
    pr_rows = feats[PR_AUC_W]
    pr_rows = pr_rows[pr_rows["split"] == split][["run_id", "family", "ts_ns", "y"]]
    rows, tol_rows, alert_log = [], [], []

    def add(detector, tier, setting, alert_rows, pr_scores=None):
        pr = {}
        if pr_scores is not None:
            d = pr_rows.assign(_s=pr_scores)
            pr["overall"] = E.pr_auc(d["y"], d["_s"])
            for fam, g in d.groupby("family"):
                pr[fam] = E.pr_auc(g["y"], g["_s"])
        for a in alert_rows:
            kind, delay = E.outcome(a["hang"], a["t0"], a["alert"])
            alert_log.append({"detector": detector.split()[0], "run_id": a["run_id"], "family": a["family"],
                              "hang": a["hang"], "t0_ns": a["t0"], "alert_ns": a["alert"], "outcome": kind,
                              "delay_ms": delay})
        strict = {m["scope"]: m for m in E.per_family_metrics(alert_rows, tol_ns=0)}
        for m in E.per_family_metrics(alert_rows):
            s0 = strict[m["scope"]]
            tol_rows.append({"detector": detector, "scope": m["scope"], "hang_runs": m["hang_runs"],
                             "detected_with_tolerance": m["detected"], "detected_strict": s0["detected"],
                             "fa_early_with_tolerance": m["fa_early"], "fa_early_strict": s0["fa_early"],
                             "detections_changed": m["detected"] - s0["detected"]})
            rows.append(dict(detector=detector, input=tier, setting=setting, pr_auc=pr.get(m["scope"], np.nan), **m))

    def alerts_from(runs, threshold):
        return [{"run_id": r.run_id, "family": r.family, "hang": r.hang, "t0": r.t0,
                 "alert": (lambda a: None if a < 0 else int(a))(r.alert_ns([threshold])[0])} for r in runs]

    # baselines
    tick_scores = pd.concat([t.assign(run_id=rid) for rid, (t, _) in base.items()], ignore_index=True)
    merged = pr_rows.merge(tick_scores, on=["run_id", "ts_ns"], how="left")
    for key, label in (("B1", "B1 fixed timeout"), ("B2", "B2 futex silence")):
        th = settings[key]["T_ms"]
        add(label, "Tier P", "T={:.0f} ms".format(th), alerts_from(baseline_runscores(base, labels, key), th),
            merged[key].to_numpy())
    b3 = [{"run_id": rid, "family": lab.loc[rid, "family"], "hang": int(lab.loc[rid, "hang"]),
           "t0": int(lab.loc[rid, "t0_ns"]) if int(lab.loc[rid, "hang"]) else None, "alert": a}
          for rid, (_t, a) in base.items()]
    add("B3 wait-for graph", "Tier F", "no threshold (cycle at MUTEX_REQ)", b3)
    th = settings["B4"]["T_ms"]
    add("B4 progress watchdog", "Tier F", "T={:.0f} ms".format(th),
        alerts_from(baseline_runscores(base, labels, "B4"), th))

    # models
    for name in ("M1", "M2", "M3"):
        s = settings[name]
        df = feats[s["W"]]
        df = df[df["split"] == split]
        scores = models[name].predict_proba(df[F.FEATURES].to_numpy())[:, 1]
        runs = T.val_run_scores(df, scores, labels)
        sc = df[["run_id", "ts_ns"]].assign(_s=scores)
        pr_s = pr_rows.merge(sc, on=["run_id", "ts_ns"], how="left")["_s"].to_numpy()
        setting = "W={} ({} ms), {}, threshold={:.4g}".format(s["W"], s["W"] * 5, json.dumps(s["params"]),
                                                              s["threshold"])
        add("{} {}".format(name, T.MODEL_NAMES[name]), "Tier P", setting, alerts_from(runs, s["threshold"]), pr_s)

    table = pd.DataFrame(rows)[E.TABLE_COLUMNS]
    return table, pd.DataFrame(tol_rows), pd.DataFrame(alert_log)


def feature_importance(settings, models, feats, split="validation", n_rows=20000):
    from sklearn.inspection import permutation_importance
    out = []
    for name in ("M2", "M3"):
        df = feats[settings[name]["W"]]
        df = df[df["split"] == split]
        if len(df) > n_rows:
            df = df.sample(n_rows, random_state=T.RANDOM_STATE)
        r = permutation_importance(models[name], df[F.FEATURES].to_numpy(), df["y"].to_numpy(),
                                   scoring="average_precision", n_repeats=5, random_state=T.RANDOM_STATE,
                                   n_jobs=-1)
        for f, m, sd in zip(F.FEATURES, r.importances_mean, r.importances_std):
            out.append({"model": name, "W": settings[name]["W"], "feature": f,
                        "importance_mean": m, "importance_std": sd})
    fi = pd.DataFrame(out)
    return fi.sort_values(["model", "importance_mean"], ascending=[True, False])


def write_tables(table, out, split, header_lines):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    table.to_csv(out / "{}_table.csv".format(split), index=False, float_format="%.4f", lineterminator="\n")
    md = ["# LockPulse phase 3 - {} results".format(split), ""] + header_lines + ["", E.format_markdown(table), ""]
    (out / "{}_table.md".format(split)).write_text("\n".join(md), encoding="utf-8", newline="\n")


def versions():
    import sklearn
    return {"python": platform.python_version(), "numpy": np.__version__, "pandas": pd.__version__,
            "scikit-learn": sklearn.__version__, "platform": platform.platform()}


def run(data=None, features_dir=None, out=None, rebuild=False):
    _utf8_stdout()
    t_start = time.monotonic()
    data = Path(data) if data else F.default_data_dir()
    features_dir = Path(features_dir) if features_dir else ROOT / "data" / "processed"
    out = Path(out) if out else ROOT / "results" / "phase3"
    print("phase3: data={}".format(data))

    print("== 1. features ==")
    feats = ensure_features(data, features_dir, rebuild)
    labels, n_amb = F.load_labels(data)
    feats = apply_label_splits(feats, labels)
    val = labels[labels["split"] == "validation"].reset_index(drop=True)
    counts = labels.groupby("split").size().to_dict()
    print("runs used: {} (ambiguous excluded: {}); validation: {} runs in {}".format(
        counts, n_amb, len(val), sorted(val["family"].unique())))
    timing = {"features_s": round(time.monotonic() - t_start, 1)}

    print("== 2. baselines (validation) ==")
    t = time.monotonic()
    base = B.compute_baselines(data, val)
    bset, sweeps = choose_baselines(base, val)
    for k, v in bset.items():
        print("  {}: T={:.0f} ms{}".format(k, v["T_ms"], "" if v["feasible"] else " (no T meets the 5% bound)"))
    timing["baselines_s"] = round(time.monotonic() - t, 1)

    print("== 3. train M1-M3 (train split), choose on validation ==")
    t = time.monotonic()
    chosen = T.select_models(feats, val)
    T.save_models(chosen, out)
    timing["train_s"] = round(time.monotonic() - t, 1)

    print("== 4. evaluate (validation) ==")
    t = time.monotonic()
    settings = dict(bset)
    models = {}
    for name, c in chosen.items():
        settings[name] = {k: c[k] for k in ("W", "params", "threshold", "feasible")}
        models[name] = c["model"]
    table, tol_effect, _alerts = detector_table("validation", labels, feats, base, settings, models)
    fi = feature_importance(settings, models, feats)
    timing["evaluate_s"] = round(time.monotonic() - t, 1)
    timing["total_s"] = round(time.monotonic() - t_start, 1)

    out.mkdir(parents=True, exist_ok=True)
    meta = {
        "split_used_for_choices": "validation", "train_split": "train", "test_split_used": False,
        "runs_per_split": counts, "ambiguous_excluded": n_amb,
        "validation_families": sorted(val["family"].unique()),
        "alert_policy": "first tick where the score has been >= threshold for {} consecutive ticks".format(
            E.K_CONSECUTIVE),
        "threshold_rule": "max detection rate s.t. false-alarm rate <= {:.0%}; tie-break lower median delay".format(
            E.MAX_FA_RATE),
        "onset_tolerance_ms": E.ONSET_TOLERANCE_NS / 1e6,
        "features": F.FEATURES, "windows": list(F.WINDOWS), "train_stride": T.TRAIN_STRIDE,
        "random_state": T.RANDOM_STATE, "baseline_T_grid_ms": list(B.T_GRID_MS),
        "settings": settings, "versions": versions(), "runtime_s": timing,
    }
    (out / "chosen.json").write_text(json.dumps(meta, indent=2, default=float), encoding="utf-8", newline="\n")
    pd.DataFrame([dict(model=n, **{k: v for k, v in c.items() if k != "metrics"}, **c["metrics"])
                  for n, ch in chosen.items() for c in ch["search"]]).to_csv(out / "model_search.csv", index=False, lineterminator="\n")
    sweeps.to_csv(out / "baseline_sweeps.csv", index=False, lineterminator="\n")
    fi.to_csv(out / "feature_importance.csv", index=False, lineterminator="\n")
    tol_effect.to_csv(out / "validation_tolerance_effect.csv", index=False, lineterminator="\n")
    header = ["Split: validation ({}). Runs: {}; ambiguous excluded: {}.".format(
                  ", ".join(meta["validation_families"]), counts.get("validation"), n_amb),
              "Alert policy: {}. Threshold rule: {}. An alert is on time if it comes at or after t0 - {:.0f} ms "
              "(one sampler tick); validation_tolerance_effect.csv shows what that changes.".format(
                  meta["alert_policy"], meta["threshold_rule"], E.ONSET_TOLERANCE_NS / 1e6),
              "PR-AUC: window-level over validation ticks >= {} (common tick set); blank where a family "
              "has one class or the detector has no continuous score.".format(PR_AUC_W)]
    write_tables(table, out, "validation", header)

    print("")
    print(E.format_markdown(table))
    print("")
    te = tol_effect[tol_effect["scope"] == "overall"]
    print("onset tolerance ({:.0f} ms) - detections changed vs strict t0 (overall):".format(E.ONSET_TOLERANCE_NS / 1e6))
    print(te[["detector", "detected_strict", "detected_with_tolerance", "detections_changed",
              "fa_early_strict", "fa_early_with_tolerance"]].to_string(index=False))
    print("")
    print("runtime: " + ", ".join("{}={}".format(k, v) for k, v in timing.items()))
    print("outputs: {}".format(out))
    return table


def evaluate_saved(split="validation", final=False, data=None, features_dir=None, out=None, models_dir=None,
                   quiet=False):
    """Evaluate the saved phase-3 detectors on a split (test needs final=True).

    Settings and models come from models_dir (default results/phase3). With
    final=True the freeze record (results/phase4/frozen.json) is verified first,
    so only the frozen files can be evaluated on test; output then defaults to
    results/phase4. Returns (table, tolerance-effect table)."""
    import joblib
    E.check_split(split, final)
    _utf8_stdout()
    models_dir = Path(models_dir) if models_dir else ROOT / "results" / "phase3"
    if final:
        from ml import freeze
        rec = freeze.verify()
        print("freeze verified (settings commit {})".format(rec["settings_commit"][:12]))
    data = Path(data) if data else F.default_data_dir()
    features_dir = Path(features_dir) if features_dir else ROOT / "data" / "processed"
    out = Path(out) if out else (ROOT / "results" / ("phase4" if final else "phase3"))
    meta = json.loads((models_dir / "chosen.json").read_text())
    settings = meta["settings"]
    settings["_final"] = final
    models = {n: joblib.load(models_dir / "models" / "{}.joblib".format(n)) for n in ("M1", "M2", "M3")}
    feats = {W: F.load_features(features_dir, W) for W in F.WINDOWS}
    labels, n_amb = F.load_labels(data)
    feats = apply_label_splits(feats, labels)
    lab = labels[labels["split"] == split].reset_index(drop=True)
    base = B.compute_baselines(data, lab)
    table, tol_effect, alerts = detector_table(split, labels, feats, base, settings, models)
    out.mkdir(parents=True, exist_ok=True)
    tol_effect.to_csv(out / "{}_tolerance_effect.csv".format(split), index=False, lineterminator="\n")
    fams = ", ".join(sorted(lab["family"].unique()))
    header = ["Split: {} ({}). Runs: {}; ambiguous excluded (all splits): {}.".format(split, fams, len(lab), n_amb),
              "Settings and models: {} (picked on validation{}).".format(
                  models_dir.relative_to(ROOT) if models_dir.is_relative_to(ROOT) else models_dir,
                  "; frozen, hashes verified" if final else ""),
              "Alert policy: first tick where the score has been >= threshold for {} consecutive ticks; an alert "
              "is on time if it comes at or after t0 - {:.0f} ms.".format(E.K_CONSECUTIVE,
                                                                       E.ONSET_TOLERANCE_NS / 1e6)]
    if split == "train":
        header.append("DIAGNOSTIC ONLY: M1-M3 were fitted on these runs (in-sample scores); the rules B1-B4 "
                      "were not. Nothing in this table was used for any choice.")
    write_tables(table, out, split, header)
    if not quiet:
        print(E.format_markdown(table))
    alerts.to_csv(out / "{}_alerts.csv".format(split), index=False, lineterminator=chr(10))
    return table, tol_effect, alerts


def main(argv=None):
    ap = argparse.ArgumentParser(description="LockPulse phase 3: features -> baselines -> train -> evaluate.")
    ap.add_argument("--data", default=None)
    ap.add_argument("--features-dir", default=None)
    ap.add_argument("--out", default=None)
    ap.add_argument("--rebuild-features", action="store_true")
    args = ap.parse_args(argv)
    run(args.data, args.features_dir, args.out, args.rebuild_features)
    return 0


if __name__ == "__main__":
    sys.exit(main())
