"""lpkit - shared helpers for the LockPulse run scripts (stdlib only).

Used by collect.py, overhead.py and check_phase2.py: config loading, run
enumeration, launching lp-run, converting Tier F traces with lp-dump.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
LP_RUN = BUILD / "lp-run"
LP_DUMP = BUILD / "lp-dump"
DEFAULT_RAW = ROOT / "data" / "raw"
DEFAULT_PROCESSED = ROOT / "data" / "processed"
PHASE2_CONFIG = ROOT / "configs" / "phase2.json"


def load_config(path=PHASE2_CONFIG):
    return json.loads(Path(path).read_text())


def config_seeds(cfg):
    s = cfg["seeds"]
    if isinstance(s, dict):
        return list(range(int(s["first"]), int(s["last"]) + 1))
    return [int(x) for x in s]


def parse_seed_spec(spec):
    """'1-15' or '1,3,5' or '7' -> list of ints."""
    out = []
    for part in str(spec).split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            lo, hi = part.split("-", 1)
            out.extend(range(int(lo), int(hi) + 1))
        else:
            out.append(int(part))
    return out


def bench_argv(binary, params, seed):
    args = [str(ROOT / binary)]
    for key, val in params.items():
        args += ["--" + key.replace("_", "-"), str(val)]
    args += ["--seed", str(seed)]
    return args


def run_id_for(family, config_id, seed, prefix=""):
    rid = "{}-{}-s{:02d}".format(family, config_id, int(seed))
    return prefix + rid if prefix else rid


def iter_specs(cfg, families=None, config_ids=None, seeds=None):
    """Yield one dict per (family, config, seed) in config order."""
    defaults = cfg["defaults"]
    seed_list = seeds if seeds is not None else config_seeds(cfg)
    for family, fam in cfg["families"].items():
        if families and family not in families:
            continue
        for conf in fam["configs"]:
            if config_ids and conf["id"] not in config_ids:
                continue
            for seed in seed_list:
                yield {
                    "family": family,
                    "config_id": conf["id"],
                    "seed": int(seed),
                    "split": fam["split"],
                    "kind": fam["kind"],
                    "hang_type": fam.get("hang_type", ""),
                    "binary": fam["binary"],
                    "params": dict(conf["params"]),
                    "interval_ms": fam.get("interval_ms", defaults["interval_ms"]),
                    "watchdog_ms": fam.get("watchdog_ms", defaults["watchdog_ms"]),
                    "max_ms": fam.get("max_ms", defaults["max_ms"]),
                }


def paths(raw_dir, processed_dir, run_id):
    raw_dir, processed_dir = Path(raw_dir), Path(processed_dir)
    return {
        "meta": raw_dir / "meta" / (run_id + ".json"),
        "tierP": raw_dir / "tierP" / (run_id + ".csv"),
        "tierF_bin": raw_dir / "tierF" / (run_id + ".bin"),
        "tierF_csv": processed_dir / "tierF" / (run_id + ".csv"),
    }


def run_lp(spec, run_id, raw_dir, tier="PF", timeout_extra_s=60):
    """Run one benchmark under lp-run. Returns CompletedProcess (text)."""
    tags = ["split=" + spec["split"], "config_id=" + spec["config_id"], "kind=" + spec["kind"]]
    if "force" in spec["params"]:
        tags.append("force={}".format(spec["params"]["force"]))
    cmd = [str(LP_RUN), "--family", spec["family"], "--run-id", run_id, "--tier", tier,
           "--interval-ms", str(spec["interval_ms"]), "--watchdog-ms", str(spec["watchdog_ms"]),
           "--max-ms", str(spec["max_ms"]), "--data-dir", str(raw_dir)]
    for t in tags:
        cmd += ["--tag", t]
    cmd += ["--"] + bench_argv(spec["binary"], spec["params"], spec["seed"])
    return subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True,
                          timeout=spec["max_ms"] / 1000.0 + timeout_extra_s)


def dump_tierf(bin_path, csv_path):
    """lp-dump bin -> csv. Returns (returncode, stderr). 3 = overflow (CSV still written)."""
    csv_path = Path(csv_path)
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = csv_path.with_suffix(".csv.tmp")
    with open(tmp, "w") as fh:
        p = subprocess.run([str(LP_DUMP), str(bin_path)], stdout=fh, stderr=subprocess.PIPE, text=True)
    if p.returncode in (0, 3):
        tmp.replace(csv_path)
    else:
        tmp.unlink()
    return p.returncode, p.stderr.strip()


def parse_elapsed_ns(text):
    for line in (text or "").splitlines():
        if line.startswith("elapsed_ns="):
            try:
                return int(line.split("=", 1)[1])
            except ValueError:
                return None
    return None


def first_line(cmd):
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        text = (out.stdout or out.stderr).strip()
        return text.splitlines()[0] if text else "(no output)"
    except (OSError, subprocess.SubprocessError) as exc:
        return "unavailable ({})".format(exc)


def env_lines():
    import sys
    lines = ["uname : " + first_line(["uname", "-a"]),
             "gcc   : " + first_line(["gcc", "--version"]),
             "glibc : " + first_line(["ldd", "--version"])]
    try:
        import pandas
        lines.append("python: {}  pandas: {}".format(sys.version.split()[0], pandas.__version__))
    except ImportError:
        lines.append("python: {}  pandas: missing".format(sys.version.split()[0]))
    return lines


def make_all():
    return subprocess.run(["make", "all"], cwd=str(ROOT), capture_output=True, text=True)
