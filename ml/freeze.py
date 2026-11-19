"""freeze.py - pin the phase-3 detectors before any test evaluation (phase 4).

  python -m ml.freeze write   # once: hash results/phase3 settings + models -> results/phase4/FROZEN.md / frozen.json
  python -m ml.freeze check   # verify the files on disk still match (phase 4 calls verify() before loading)

Phase 4 loads exactly the frozen files; any byte change aborts it.
"""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PHASE3 = ROOT / "results" / "phase3"
PHASE4 = ROOT / "results" / "phase4"
FROZEN_FILES = ["results/phase3/chosen.json", "results/phase3/models/M1.joblib",
                "results/phase3/models/M2.joblib", "results/phase3/models/M3.joblib"]


class FreezeError(SystemExit):
    pass


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def git(*args):
    return subprocess.run(["git", *args], cwd=str(ROOT), capture_output=True, text=True).stdout.strip()


def write():
    hashes = {f: sha256(ROOT / f) for f in FROZEN_FILES}
    settings_commit = git("log", "-1", "--format=%H", "--", "results/phase3/chosen.json")
    PHASE4.mkdir(parents=True, exist_ok=True)
    rec = {"settings_commit": settings_commit, "sha256": hashes}
    (PHASE4 / "frozen.json").write_text(json.dumps(rec, indent=2) + "\n", encoding="utf-8", newline="\n")
    md = ["# Frozen phase-3 detectors", "",
          "These files were frozen **before** any test-split evaluation. Phase 4 (`python -m ml.phase4`,",
          "`python -m ml.evaluate --split test --final`) verifies every hash below before loading, and",
          "aborts on any mismatch. No setting may be re-tuned after seeing test numbers.", "",
          "- Settings commit (last commit that touched `results/phase3/chosen.json`): `{}`".format(settings_commit),
          "- The models were added to git in the freeze commit that also adds this file. They are",
          "  byte-identical to a fresh `python -m ml.phase3` retrain (verified before freezing).", "",
          "| file | SHA-256 |", "|---|---|"]
    md += ["| `{}` | `{}` |".format(f, h) for f, h in hashes.items()]
    (PHASE4 / "FROZEN.md").write_text("\n".join(md) + "\n", encoding="utf-8", newline="\n")
    return rec


def verify():
    """Raise FreezeError unless every frozen file matches its recorded SHA-256."""
    path = PHASE4 / "frozen.json"
    if not path.exists():
        raise FreezeError("freeze: {} missing - run `python -m ml.freeze write` before phase 4".format(path))
    rec = json.loads(path.read_text(encoding="utf-8"))
    bad = []
    for f, h in rec["sha256"].items():
        p = ROOT / f
        if not p.exists():
            bad.append("{} (missing)".format(f))
        elif sha256(p) != h:
            bad.append("{} (hash differs)".format(f))
    if bad:
        raise FreezeError("freeze: frozen phase-3 files changed: " + ", ".join(bad))
    return rec


def compare(other_dir):
    """Check that a fresh phase-3 run in other_dir reproduces the frozen detectors:
    identical model bytes and identical chosen settings (runtime/versions may differ)."""
    rec = verify()
    other = Path(other_dir)
    bad = []
    for name in ("M1", "M2", "M3"):
        frozen = rec["sha256"]["results/phase3/models/{}.joblib".format(name)]
        got = sha256(other / "models" / "{}.joblib".format(name))
        if got != frozen:
            bad.append("{} model bytes differ".format(name))
    a = json.loads((PHASE3 / "chosen.json").read_text(encoding="utf-8"))["settings"]
    b = json.loads((other / "chosen.json").read_text(encoding="utf-8"))["settings"]
    if a != b:
        bad.append("chosen settings differ")
    if bad:
        raise FreezeError("freeze: the re-run in {} does not reproduce the frozen detectors: {}".format(
            other, "; ".join(bad)))
    print("re-run in {} reproduces the frozen detectors (models byte-identical, settings identical)".format(other))
    return rec


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    cmd = argv[0] if argv else "check"
    if cmd == "write":
        rec = write()
    elif cmd == "compare":
        rec = compare(argv[1])
    else:
        rec = verify()
    for f, h in rec["sha256"].items():
        print("{}  {}".format(h, f))
    print("settings commit {}: {}".format(rec["settings_commit"], "written" if cmd == "write" else "verified"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
