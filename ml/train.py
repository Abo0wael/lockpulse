"""train.py - learned detectors M1-M3 on Tier P features (phase 3).

  M1 logistic regression  StandardScaler + LogisticRegression(class_weight=balanced)
  M2 random forest        RandomForestClassifier(class_weight=balanced_subsample)
  M3 gradient boosting    HistGradientBoostingClassifier(class_weight=balanced)

Training data: TRAIN-split runs only (ambiguous runs already excluded), every
TRAIN_STRIDE-th tick of each run (consecutive ticks are almost identical;
striding cuts fit time without losing runs or phases). Hyperparameters, the
window W and the alert threshold are chosen on VALIDATION with the run-level
rule in ml/evaluate.py (max detection rate s.t. false-alarm rate <= 5 %, then
lower median delay; final tie-break: higher window-level PR-AUC).
Random seeds are fixed (RANDOM_STATE). The test split is never loaded here.
"""
import itertools
import json
import time
from pathlib import Path

import numpy as np

from ml import evaluate as E
from ml import features as F

RANDOM_STATE = 0
TRAIN_STRIDE = 4
MODEL_GRIDS = {
    "M1": {"C": [0.01, 0.1, 1.0, 10.0]},
    "M2": {"max_depth": [6, 12, None], "min_samples_leaf": [5, 20]},
    "M3": {"learning_rate": [0.05, 0.1], "max_leaf_nodes": [15, 31]},
}
MODEL_NAMES = {"M1": "logistic regression", "M2": "random forest", "M3": "gradient boosting"}


def make_model(name, params):
    from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    if name == "M1":
        return make_pipeline(StandardScaler(), LogisticRegression(
            C=params["C"], class_weight="balanced", max_iter=5000, random_state=RANDOM_STATE))
    if name == "M2":
        return RandomForestClassifier(
            n_estimators=150, max_depth=params["max_depth"], min_samples_leaf=params["min_samples_leaf"],
            class_weight="balanced_subsample", n_jobs=-1, random_state=RANDOM_STATE)
    if name == "M3":
        return HistGradientBoostingClassifier(
            learning_rate=params["learning_rate"], max_leaf_nodes=params["max_leaf_nodes"], max_iter=200,
            class_weight="balanced", random_state=RANDOM_STATE)
    raise ValueError(name)


def grid(name):
    keys = sorted(MODEL_GRIDS[name])
    for values in itertools.product(*(MODEL_GRIDS[name][k] for k in keys)):
        yield dict(zip(keys, values))


def train_rows(df, stride=TRAIN_STRIDE):
    tr = df[df["split"] == "train"]
    assert set(tr["split"]) <= {"train"}
    return tr[tr.groupby("run_id", sort=False).cumcount() % stride == 0]


def val_run_scores(df_val, scores, labels_val):
    """RunScores per validation run from row-level scores."""
    lab = labels_val.set_index("run_id")
    runs = []
    df = df_val.assign(_score=scores)
    for rid, g in df.groupby("run_id", sort=True):
        r = lab.loc[rid]
        runs.append(E.RunScores(rid, r["family"], r["hang"], r["t0_ns"], g["ts_ns"].to_numpy(),
                                g["_score"].to_numpy()))
    return runs


def select_models(features_by_W, labels_val, verbose=True):
    """Fit every (model, W, hyperparameters) on train, choose on validation.

    Returns {model: {"W", "params", "threshold", "feasible", "metrics", "pr_auc",
    "model", "search": [per-candidate summary]}}."""
    chosen = {}
    for name in ("M1", "M2", "M3"):
        best, search = None, []
        for W, df in features_by_W.items():
            tr = train_rows(df)
            va = df[df["split"] == "validation"]
            X_tr, y_tr = tr[F.FEATURES].to_numpy(), tr["y"].to_numpy()
            X_va = va[F.FEATURES].to_numpy()
            for params in grid(name):
                t = time.monotonic()
                model = make_model(name, params).fit(X_tr, y_tr)
                s = model.predict_proba(X_va)[:, 1]
                runs = val_run_scores(va, s, labels_val)
                sw = E.sweep(runs, E.candidate_thresholds(s))
                pick, feasible = E.choose_threshold(sw)
                ap = E.pr_auc(va["y"].to_numpy(), s)
                cand = {"W": W, "params": params, "threshold": pick["threshold"], "feasible": feasible,
                        "metrics": {k: pick[k] for k in ("detection_rate", "delay_median_ms", "delay_p90_ms",
                                                         "fa_rate", "fa_healthy", "fa_early", "detected")},
                        "pr_auc": ap, "fit_s": round(time.monotonic() - t, 2)}
                search.append(cand)
                key = (feasible, pick["detection_rate"], -np.nan_to_num(pick["delay_median_ms"], nan=np.inf), ap)
                if best is None or key > best[0]:
                    best = (key, cand, model)
                if verbose:
                    print("  {} W={:<2} {:<45} det={:.3f} fa={:.3f} delay={:>6.0f}ms pr_auc={:.3f} ({:.1f}s)".format(
                        name, W, json.dumps(params), pick["detection_rate"], pick["fa_rate"],
                        np.nan_to_num(pick["delay_median_ms"], nan=-1), ap, cand["fit_s"]))
        _key, cand, model = best
        chosen[name] = dict(cand, model=model, search=search)
    return chosen


def save_models(chosen, out_dir):
    import joblib
    out = Path(out_dir) / "models"
    out.mkdir(parents=True, exist_ok=True)
    for name, c in chosen.items():
        joblib.dump(c["model"], out / "{}.joblib".format(name))
    return out
