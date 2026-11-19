"""phase4.py - regenerate every phase-4 table and figure from the dataset + frozen detectors.

  python -m ml.phase4 [--data DIR] [--features-dir data/processed] [--out results/phase4]

Steps (nothing is re-tuned on test; all choices come from validation):
  0. verify the freeze (results/phase4/frozen.json) - abort on any hash mismatch
  1. test evaluation of the 7 frozen detectors (+ the validation table, same code)
  2. ablations: feature groups (M2/M3) and sampling interval (M2/M3/B2)
  3. overhead table from the collect artifact's results/overhead*.csv (no new runs)
  4. figures (PNG) in <out>/figures/
The test evaluation was first run once on its own (results/phase4/test_run_utc.txt);
this runner regenerates it deterministically from the same frozen files.
"""
import argparse
import shutil
import sys
import time
from pathlib import Path

import pandas as pd

from ml import ablations as A
from ml import evaluate as E
from ml import features as F
from ml import freeze
from ml import phase3 as P3

ROOT = F.ROOT
TIMELINE_RUN = "sem_never_posted-c1-s01"   # a test hang without any mutex cycle


def overhead_table(data_dir, out):
    """Copy the collect artifact's overhead CSVs and build the phase-4 overhead table."""
    src = Path(data_dir).parent / "results"
    if not (src / "overhead.csv").exists():
        print("overhead: {} not found - skipped".format(src / "overhead.csv"))
        return None
    for name in ("overhead.csv", "overhead_runs.csv"):
        shutil.copyfile(src / name, out / name)
    ovh = pd.read_csv(out / "overhead.csv")
    runs = pd.read_csv(out / "overhead_runs.csv")
    cpu = runs.groupby(["family", "mode"])["sampler_cpu_pct_rusage"].agg(
        cpu_median="median", cpu_q1=lambda s: s.quantile(0.25), cpu_q3=lambda s: s.quantile(0.75))
    t = ovh.merge(cpu.reset_index(), on=["family", "mode"], how="left")
    t.to_csv(out / "overhead_table.csv", index=False, lineterminator="\n")
    lines = ["| family | mode | runs | bench ms median | bench ms IQR | slowdown vs untraced | lock ops/s median | "
             "launcher (sampler+watchdog) CPU % median [IQR] |", "|---|---|---:|---:|---:|---:|---:|---:|"]
    for r in t.itertuples():
        cpu_s = "-" if pd.isna(r.cpu_median) else "{:.1f} [{:.1f}-{:.1f}]".format(r.cpu_median, r.cpu_q1, r.cpu_q3)
        lines.append("| {} | {} | {} | {:.1f} | {:.1f} | {:.2f}x | {:,.0f} | {} |".format(
            r.family, r.mode, r.n, r.bench_ms_median, r.bench_ms_iqr, r.slowdown_vs_untraced,
            r.ops_per_s_median, cpu_s))
    md = ["# Overhead (fixed-work mode, 10 repetitions per mode)", "",
          "Source: collect run 44361187947, job `overhead` (scripts/overhead.py); copied here, no new runs.",
          "Modes: untraced = benchmark alone; P = /proc sampler only; F = LD_PRELOAD shim only; PF = both.",
          "CPU % is the launcher's own CPU (getrusage RUSAGE_SELF) over the run's wall time: the sampler in P/PF,",
          "only the watchdog in F. The /proc/self/stat tick-based column of overhead.csv is 0 throughout because",
          "these runs last ~30-60 ms, below the 10 ms tick resolution's useful range.", ""] + lines
    (out / "overhead_table.md").write_text("\n".join(md) + "\n", encoding="utf-8", newline="\n")
    return t


def ablation_markdown(table, out):
    def fmt(v, f="{:.0f}"):
        return "" if pd.isna(v) else f.format(v)
    lines = ["# Ablations (choices on validation, numbers on test)", "",
             "Feature groups: M2/M3 with the frozen W and hyperparameters, retrained on train with the",
             "group's features only, threshold re-chosen on validation by the phase-3 rule.",
             "Sampling interval: 5 ms ticks sub-sampled to 10/20 ms, features rebuilt with the same 100 ms",
             "window (W = 20/10/5 ticks), models retrained, threshold (B2: T) re-chosen on validation. The",
             "alert policy stays 3 consecutive ticks. 2 ms would need re-collection and is not included.", "",
             "| ablation | variant | detector | setting | val det | val FA | test detected | test delay median / p90 (ms) "
             "| test FA healthy + early | test FA rate | test PR-AUC |",
             "|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|"]
    for r in table.itertuples():
        lines.append("| {} | {} | {} | {} | {} | {} | {}/{} | {} / {} | {} + {} | {} | {} |".format(
            r.ablation, r.variant, r.detector, r.setting, fmt(r.val_detection_rate, "{:.2f}"),
            fmt(r.val_fa_rate, "{:.3f}"), r.detected, r.hang_runs, fmt(r.delay_median_ms), fmt(r.delay_p90_ms),
            r.fa_healthy, r.fa_early, fmt(r.fa_rate, "{:.3f}"), fmt(r.test_pr_auc, "{:.3f}")))
    (out / "ablation_table.md").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")


def run(data=None, features_dir=None, out=None):
    P3._utf8_stdout()
    t_start = time.monotonic()
    data = Path(data) if data else F.default_data_dir()
    features_dir = Path(features_dir) if features_dir else ROOT / "data" / "processed"
    out = Path(out) if out else ROOT / "results" / "phase4"
    out.mkdir(parents=True, exist_ok=True)
    (out / "figures").mkdir(exist_ok=True)
    timing = {}

    print("== 0. freeze ==")
    rec = freeze.verify()
    print("frozen files verified (settings commit {})".format(rec["settings_commit"][:12]))
    P3.ensure_features(data, features_dir, rebuild=False)

    print("== 1. evaluation of the frozen detectors (validation + test) ==")
    t = time.monotonic()
    val_table, _vt, _va = P3.evaluate_saved("validation", False, data, features_dir, out, quiet=True)
    test_table, test_tol, test_alerts = P3.evaluate_saved("test", True, data, features_dir, out, quiet=True)
    timing["evaluate_s"] = round(time.monotonic() - t, 1)
    print(E.format_markdown(test_table[test_table["scope"] == "overall"]))

    print("== 2. ablations ==")
    t = time.monotonic()
    labels, _n = F.load_labels(data)
    feats = P3.apply_label_splits({W: F.load_features(features_dir, W) for W in F.WINDOWS}, labels)
    settings, _models = __import__("ml.runview", fromlist=["load_frozen"]).load_frozen(verify=False)
    abl, abl_fam = A.run_ablations(data, feats, labels, settings)
    abl.to_csv(out / "ablation_table.csv", index=False, lineterminator="\n")
    abl_fam.to_csv(out / "ablation_per_family.csv", index=False, lineterminator="\n")
    ablation_markdown(abl, out)
    timing["ablations_s"] = round(time.monotonic() - t, 1)

    print("== 3. overhead ==")
    ovh = overhead_table(data, out)

    print("== 4. figures ==")
    t = time.monotonic()
    from ml import figures as FG
    from ml.runview import RunView, load_frozen
    FG.delay_boxplot(test_alerts, out / "figures" / "delay_by_detector_test.png")
    FG.false_alarm_bars(test_table, out / "figures" / "false_alarms_by_family_test.png")
    if ovh is not None:
        FG.overhead_bars(ovh, out / "figures" / "overhead_slowdown.png")
    settings, models = load_frozen(verify=False)
    FG.timeline(RunView(data, TIMELINE_RUN, settings, models), out / "figures" / "timeline_{}.png".format(TIMELINE_RUN))
    timing["figures_s"] = round(time.monotonic() - t, 1)
    timing["total_s"] = round(time.monotonic() - t_start, 1)
    print("figures: " + ", ".join(sorted(p.name for p in (out / "figures").glob("*.png"))))
    print("runtime: " + ", ".join("{}={}".format(k, v) for k, v in timing.items()))
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description="LockPulse phase 4: test evaluation, ablations, overhead, figures.")
    ap.add_argument("--data", default=None)
    ap.add_argument("--features-dir", default=None)
    ap.add_argument("--out", default=None)
    args = ap.parse_args(argv)
    return run(args.data, args.features_dir, args.out)


if __name__ == "__main__":
    sys.exit(main())
