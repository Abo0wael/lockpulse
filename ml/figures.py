"""figures.py - phase-4 figures (matplotlib, PNG)."""
import numpy as np
import pandas as pd

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.colors import ListedColormap  # noqa: E402

from ml.runview import DETECTOR_NAMES, DETECTORS  # noqa: E402

COLORS = {"B1": "#9e9e9e", "B2": "#1f77b4", "B3": "#8c564b", "B4": "#7f7f7f",
          "M1": "#ff7f0e", "M2": "#2ca02c", "M3": "#d62728"}
DELAY_FLOOR_MS = 0.01


def delay_boxplot(alerts, path, split="test"):
    det = alerts[alerts["outcome"] == "detected"]
    data, labels, notes = [], [], []
    for d in DETECTORS:
        x = det.loc[det["detector"] == d, "delay_ms"].astype(float).to_numpy()
        data.append(np.maximum(x, DELAY_FLOOR_MS) if len(x) else np.array([np.nan]))
        n_hang = int((alerts["detector"] == d).sum() and alerts.loc[alerts["detector"] == d, "hang"].sum())
        labels.append("{}\n{}/{}".format(d, len(x), n_hang))
    fig, ax = plt.subplots(figsize=(8, 4.2))
    bp = ax.boxplot(data, tick_labels=labels, showfliers=True, patch_artist=True, widths=0.6)
    for patch, d in zip(bp["boxes"], DETECTORS):
        patch.set_facecolor(COLORS[d])
        patch.set_alpha(0.55)
    ax.set_yscale("log")
    ax.set_ylabel("detection delay (ms, log scale)")
    ax.set_title("Detection delay per detector ({} split; detected hang runs)".format(split))
    ax.text(0.01, 0.02, "delays below {} ms (B3, alerts within the 5 ms onset tolerance) drawn at {} ms; "
                        "x labels: detected/hang runs".format(DELAY_FLOOR_MS, DELAY_FLOOR_MS),
            transform=ax.transAxes, fontsize=7, color="#555")
    ax.grid(axis="y", which="both", alpha=0.3)
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def false_alarm_bars(table, path, split="test"):
    t = table[table["scope"] != "overall"].copy()
    t["det"] = t["detector"].str.split().str[0]
    t["fa"] = t["fa_healthy"] + t["fa_early"]
    fams = sorted(t["scope"].unique())
    fig, ax = plt.subplots(figsize=(8, 4.2))
    width = 0.8 / len(DETECTORS)
    x = np.arange(len(fams))
    for i, d in enumerate(DETECTORS):
        vals = [int(t[(t["det"] == d) & (t["scope"] == f)]["fa"].sum()) for f in fams]
        bars = ax.bar(x + (i - (len(DETECTORS) - 1) / 2) * width, vals, width, label=DETECTOR_NAMES[d],
                      color=COLORS[d])
        for b, v in zip(bars, vals):
            if v:
                ax.text(b.get_x() + b.get_width() / 2, v + 0.3, str(v), ha="center", fontsize=7)
    runs = [int(t[(t["scope"] == f)]["runs"].iloc[0]) for f in fams]
    ax.set_xticks(x, ["{}\n({} runs)".format(f, n) for f, n in zip(fams, runs)])
    ax.set_ylabel("false alarms (healthy + early)")
    ax.set_title("False alarms per detector and family ({} split)".format(split))
    ax.legend(fontsize=7, ncol=2)
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def overhead_bars(ovh, path):
    o = ovh[ovh["mode"] != "untraced"]
    fams = list(dict.fromkeys(o["family"]))
    modes = ["P", "F", "PF"]
    fig, ax = plt.subplots(figsize=(7, 3.8))
    x = np.arange(len(fams))
    width = 0.25
    colors = {"P": "#1f77b4", "F": "#d62728", "PF": "#9467bd"}
    for i, mode in enumerate(modes):
        vals = [float(o[(o["family"] == f) & (o["mode"] == mode)]["slowdown_vs_untraced"].iloc[0]) for f in fams]
        bars = ax.bar(x + (i - 1) * width, vals, width, label={"P": "Tier P (sampler)", "F": "Tier F (shim)",
                                                                "PF": "both"}[mode], color=colors[mode])
        for b, v in zip(bars, vals):
            ax.text(b.get_x() + b.get_width() / 2, v + 0.02, "{:.2f}x".format(v), ha="center", fontsize=8)
    ax.axhline(1.0, color="black", lw=0.8)
    ax.set_xticks(x, fams)
    ax.set_ylabel("slowdown vs untraced (median bench time)")
    ax.set_title("Telemetry overhead per tier (fixed-work runs, 10 reps)")
    ax.legend(fontsize=8)
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def timeline(view, path):
    """Per-thread state over time, M3 score and B2 silence under it, t0 and alerts marked."""
    t_ms = (view.ts - view.start) / 1e6
    fig, axes = plt.subplots(3, 1, figsize=(10, 6.2), sharex=True,
                             gridspec_kw={"height_ratios": [max(2, len(view.tids) * 0.45), 1.3, 1.3]})
    ax = axes[0]
    cmap = ListedColormap(["white", "#2ca02c", "#d62728", "#1f77b4", "#bdbdbd"])  # -1 gone, run, futex, sleep, other
    img = view.state.T + 1
    ax.imshow(img, aspect="auto", interpolation="nearest", cmap=cmap, vmin=0, vmax=4,
              extent=[t_ms[0], t_ms[-1], len(view.tids) - 0.5, -0.5])
    ax.set_yticks(range(len(view.tids)), [str(t) for t in view.tids], fontsize=7)
    ax.set_ylabel("thread (tid)")
    from matplotlib.patches import Patch
    ax.legend(handles=[Patch(color="#2ca02c", label="running"), Patch(color="#d62728", label="futex"),
                       Patch(color="#1f77b4", label="sleep / IO"), Patch(color="#bdbdbd", label="other blocked"),
                       Patch(facecolor="white", edgecolor="#999", label="not alive")],
              fontsize=7, loc="upper left", ncol=5)
    truth = "hang (deadlock)" if view.deadlock else ("hang" if view.hang else "healthy")
    ax.set_title("{}  [{} split, ground truth: {}]".format(view.run_id, view.split, truth), fontsize=10)

    axes[1].plot(t_ms, view.scores["M3"], color=COLORS["M3"], lw=1)
    axes[1].axhline(view.thresholds["M3"], color=COLORS["M3"], ls=":", lw=1)
    axes[1].set_ylabel("M3 score")
    axes[1].set_ylim(-0.05, 1.05)
    axes[2].plot(t_ms, view.scores["B2"], color=COLORS["B2"], lw=1)
    axes[2].axhline(view.thresholds["B2"], color=COLORS["B2"], ls=":", lw=1)
    axes[2].set_ylabel("B2 silence (ms)")
    axes[2].set_xlabel("time since first sample (ms)")

    for a in axes:
        if view.t0 is not None:
            a.axvline((view.t0 - view.start) / 1e6, color="black", lw=1.5)
    ymax = axes[0].get_ylim()
    for d in DETECTORS:
        al = view.alerts.get(d)
        if al is None:
            continue
        x = (al - view.start) / 1e6
        for a in axes:
            a.axvline(x, color=COLORS[d], ls="--", lw=0.9)
    handles = [plt.Line2D([], [], color="black", lw=1.5, label="t0 (oracle)")]
    for d in DETECTORS:
        al = view.alerts.get(d)
        lab = "{}: {}".format(d, "no alert" if al is None else "{:+.0f} ms vs t0".format(
            (al - view.t0) / 1e6) if view.t0 is not None else "alert")
        handles.append(plt.Line2D([], [], color=COLORS[d], ls="--", label=lab))
    axes[2].legend(handles=handles, fontsize=7, loc="upper left", ncol=4)
    del ymax
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)
