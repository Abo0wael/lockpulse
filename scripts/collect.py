#!/usr/bin/env python3
"""collect.py - run a LockPulse configuration through lp-run (tier PF).

  python3 scripts/collect.py [--config configs/phase2.json] [--family NAME]...
                             [--configs c1,c2] [--seeds 1-15] [--raw data/raw]
                             [--processed data/processed] [--dry-run]

For every (family, config, seed) it runs lp-run with tier PF, tags the run
with split / config_id / kind / force, and converts the Tier F trace with
lp-dump into <processed>/tierF/<run_id>.csv.gz. Run ids are deterministic
(<family>-<config>-s<seed>), which makes collection resumable: a run whose
metadata already exists is skipped (only a missing Tier F CSV is re-derived).
Leftovers of an interrupted run (raw files without metadata) are moved to
<raw>/incomplete/ instead of being overwritten.

Prints a per-family summary at the end and writes it to
results/collect_<family|all>.txt. Exit status 1 if lp-run itself failed for
any run (benchmark outcomes such as watchdog kills are not failures).
"""
import argparse
import collections
import json
import shutil
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lpkit  # noqa: E402


def move_incomplete(raw_dir, run_id, p):
    moved = []
    dest = Path(raw_dir) / "incomplete"
    for key in ("tierP", "tierF_bin"):
        src = p[key]
        if src.exists():
            dest.mkdir(parents=True, exist_ok=True)
            target = dest / "{}.{}{}".format(run_id, int(time.time()), src.suffix)
            shutil.move(str(src), str(target))
            moved.append(target.name)
    return moved


def main(argv=None):
    ap = argparse.ArgumentParser(description="Collect LockPulse runs (tier PF).")
    ap.add_argument("--config", default=str(lpkit.PHASE2_CONFIG))
    ap.add_argument("--family", action="append", help="only this family (repeatable)")
    ap.add_argument("--configs", default=None, help="comma-separated config ids, e.g. c1,c4")
    ap.add_argument("--seeds", default=None, help="e.g. 1-15 or 1,2,3 (default: from config)")
    ap.add_argument("--raw", default=str(lpkit.DEFAULT_RAW))
    ap.add_argument("--processed", default=str(lpkit.DEFAULT_PROCESSED))
    ap.add_argument("--summary-out", default=None)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)

    cfg = lpkit.load_config(args.config)
    families = args.family or None
    if families:
        unknown = [f for f in families if f not in cfg["families"]]
        if unknown:
            ap.error("unknown family: " + ", ".join(unknown))
    config_ids = args.configs.split(",") if args.configs else None
    seeds = lpkit.parse_seed_spec(args.seeds) if args.seeds else None
    specs = list(lpkit.iter_specs(cfg, families, config_ids, seeds))
    print("collect: {} runs planned ({})".format(len(specs), ", ".join(families or ["all families"])))
    for line in lpkit.env_lines():
        print("  " + line)
    if args.dry_run:
        for s in specs:
            print(lpkit.run_id_for(s["family"], s["config_id"], s["seed"]))
        return 0

    per_family = collections.OrderedDict()
    launcher_failures = []
    t_start = time.monotonic()
    for i, spec in enumerate(specs, 1):
        run_id = lpkit.run_id_for(spec["family"], spec["config_id"], spec["seed"])
        p = lpkit.paths(args.raw, args.processed, run_id)
        fam = per_family.setdefault(spec["family"], {"split": spec["split"], "runs": 0, "skipped": 0,
                                                     "exit": collections.Counter(), "lp_fail": 0,
                                                     "dump_fail": 0})
        fam["runs"] += 1
        if p["meta"].exists():
            fam["skipped"] += 1
            status = "skip (exists)"
        else:
            moved = move_incomplete(args.raw, run_id, p)
            if moved:
                print("  {}: moved leftovers to incomplete/: {}".format(run_id, ", ".join(moved)))
            proc = lpkit.run_lp(spec, run_id, args.raw, tier="PF")
            if proc.returncode != 0 or not p["meta"].exists():
                fam["lp_fail"] += 1
                launcher_failures.append(run_id)
                print("[{}/{}] {}: lp-run FAILED rc={}: {}".format(i, len(specs), run_id, proc.returncode,
                                                                   proc.stderr.strip()[-300:]))
                continue
            status = "ran"

        meta = json.loads(p["meta"].read_text())
        fam["exit"][meta["exit_reason"]] += 1
        if lpkit.find_csv(p["tierF_csv"]) is None and p["tierF_bin"].exists():
            rc, err = lpkit.dump_tierf(p["tierF_bin"], p["tierF_csv"])
            if rc in (0, 3):
                lpkit.gzip_file(p["tierF_csv"])  # derived data is stored as <run_id>.csv.gz
            else:
                fam["dump_fail"] += 1
                print("  {}: lp-dump failed rc={}: {}".format(run_id, rc, err))
        print("[{}/{}] {} {} exit={} {:.0f} ms".format(i, len(specs), run_id, status, meta["exit_reason"],
                                                      meta.get("duration_ms", 0.0)))

    lines = ["", "== collect summary ({:.0f} s) ==".format(time.monotonic() - t_start)]
    lines.append("{:<26} {:<11} {:>5} {:>7} {:>7} {:>7}  exit reasons".format(
        "family", "split", "runs", "skipped", "lp_fail", "dumpfail"))
    for name, fam in per_family.items():
        reasons = ", ".join("{}={}".format(k, v) for k, v in sorted(fam["exit"].items()))
        lines.append("{:<26} {:<11} {:>5} {:>7} {:>7} {:>7}  {}".format(
            name, fam["split"], fam["runs"], fam["skipped"], fam["lp_fail"], fam["dump_fail"], reasons))
    if launcher_failures:
        lines.append("lp-run failed for: " + ", ".join(launcher_failures))
    print("\n".join(lines))

    out = Path(args.summary_out) if args.summary_out else (
        lpkit.ROOT / "results" / "collect_{}.txt".format(families[0] if families and len(families) == 1 else "all"))
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lpkit.env_lines() + lines) + "\n")
    return 1 if launcher_failures else 0


if __name__ == "__main__":
    sys.exit(main())
