#!/usr/bin/env python3
"""review_sample.py - pick runs for the phase-2 hand check and write results/review.md.

  python3 scripts/review_sample.py [--labels data/processed/labels.csv]
                                   [--raw data/raw] [--processed data/processed]
                                   [--n 10] [--seed 0] [--out results/review.md]

Stratified pick of N runs (default 10) across families and label classes:
at least 2 deadlocks, 2 non-mutex hangs, 3 healthy, and ambiguous runs if any
exist (up to 2); the rest is filled with families not yet represented. Within
a class, families that are not yet in the sample come first; ties are broken
by a seeded shuffle so the pick is reproducible.

For each run the report shows the label row, the last 15 Tier F events, the
last 3 Tier P samples per thread and an empty checkbox "label correct? [ ]"
for the reviewer. Phase-2 gate: all boxes checked, ambiguous < 5 % overall.
"""
import argparse
import random
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
QUOTAS = [("deadlock", 2), ("nonmutex_hang", 2), ("healthy", 3), ("ambiguous", 2)]


def label_class(r):
    if r["ambiguous"] == 1:
        return "ambiguous"
    if r["hang"] == 1:
        return "deadlock" if r["deadlock"] == 1 else "nonmutex_hang"
    return "healthy"


def pick(labels, n, seed):
    rng = random.Random(seed)
    labels = labels.copy()
    labels["cls"] = labels.apply(label_class, axis=1)
    order = list(labels.index)
    rng.shuffle(order)
    chosen, families = [], set()

    def take(cands, k):
        cands = [i for i in cands if i not in chosen]
        cands.sort(key=lambda i: labels.at[i, "family"] in families)  # stable: new families first
        for i in cands[:k]:
            chosen.append(i)
            families.add(labels.at[i, "family"])

    for cls, k in QUOTAS:
        take([i for i in order if labels.at[i, "cls"] == cls], min(k, n - len(chosen)))
    if len(chosen) < n:
        take(order, n - len(chosen))
    return labels.loc[chosen]


def existing_csv(path):
    """path (.csv) if it exists, else its .csv.gz sibling, else None (pandas reads both)."""
    path = Path(path)
    if path.exists():
        return path
    gz = path.with_name(path.name + ".gz")
    return gz if gz.exists() else None


def code_block(text):
    return "```\n" + text + "\n```"


def section(row, raw, processed):
    rid = row["run_id"]
    out = ["## {} ({}, {})".format(rid, row["family"], row["cls"]), ""]
    cols = ["family", "split", "config_id", "seed", "force", "exit_reason", "hang", "t0_ns", "deadlock",
            "ambiguous"]
    out.append("| " + " | ".join(cols) + " |")
    out.append("|" + "---|" * len(cols))
    out.append("| " + " | ".join(str(row[c]) for c in cols) + " |")
    out.append("")
    out.append("**reason:** " + str(row["reason"]))
    out.append("")

    fcsv = existing_csv(Path(processed) / "tierF" / (rid + ".csv"))
    pcsv = existing_csv(Path(raw) / "tierP" / (rid + ".csv"))
    t0 = None
    if fcsv is not None:
        f = pd.read_csv(fcsv, dtype={"event": str, "obj_addr": str})
        t0 = int(f["ts_ns"].min()) if len(f) else None
        tail = f.tail(15).copy()
        out.append("Last 15 Tier F events (t_ms relative to the first event):")
        if t0 is not None:
            tail.insert(0, "t_ms", ((tail["ts_ns"] - t0) / 1e6).round(3))
        out.append(code_block(tail.to_string(index=False)))
    else:
        out.append("_Tier F CSV missing_")
    out.append("")
    if pcsv is not None:
        p = pd.read_csv(pcsv, dtype={"state": str})
        last = p.sort_values(["tid", "ts_ns"]).groupby("tid").tail(3).copy()
        if t0 is not None:
            last.insert(0, "t_ms", ((last["ts_ns"] - t0) / 1e6).round(3))
        out.append("Last 3 Tier P samples per thread (syscall 202 = futex, 0 = read, "
                   "230 = clock_nanosleep, -1 = running):")
        out.append(code_block(last.to_string(index=False)))
    else:
        out.append("_Tier P CSV missing_")
    out.append("")
    out.append("**label correct? [ ]**   notes:")
    out.append("")
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description="Write results/review.md for the hand check.")
    ap.add_argument("--labels", default=str(ROOT / "data" / "processed" / "labels.csv"))
    ap.add_argument("--raw", default=str(ROOT / "data" / "raw"))
    ap.add_argument("--processed", default=str(ROOT / "data" / "processed"))
    ap.add_argument("--n", type=int, default=10)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", default=str(ROOT / "results" / "review.md"))
    args = ap.parse_args(argv)

    labels = pd.read_csv(args.labels, keep_default_na=False)
    if len(labels) == 0:
        print("review_sample: no labels")
        return 1
    sample = pick(labels, args.n, args.seed)
    amb = int((labels["ambiguous"] == 1).sum())
    lines = ["# LockPulse phase-2 label review", "",
             "{} runs sampled from {} labeled runs (ambiguous overall: {} = {:.1f}%; gate: < 5%).".format(
                 len(sample), len(labels), amb, 100.0 * amb / len(labels)),
             "Check each run against its traces and tick the box if the label is right.", "",
             "| run | class |", "|---|---|"]
    lines += ["| {} | {} |".format(r["run_id"], r["cls"]) for _, r in sample.iterrows()]
    lines.append("")
    for _, r in sample.iterrows():
        lines += section(r, args.raw, args.processed)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text("\n".join(lines) + "\n")
    print("review_sample: wrote {} ({} runs: {})".format(
        args.out, len(sample), ", ".join("{}={}".format(k, v) for k, v in sample["cls"].value_counts().items())))
    return 0


if __name__ == "__main__":
    sys.exit(main())
