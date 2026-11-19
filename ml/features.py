"""features.py - Tier P trailing-window features (phase 3).

Model inputs come from Tier P only. Per run, the sampler rows are aggregated
to one row per sampler tick (all threads at that tick), and features are
computed over a trailing window of the last W ticks (W in WINDOWS; 5 ms
ticks -> 50/100/200 ms). Every feature at tick i uses only samples with
ts <= ts[i] (causal: cumulative sums, forward fills, past indices only); a unit
test checks that appending future samples never changes earlier rows.

Per tick i (rows i < W are warm-up and skipped; ticks after the run's end_ns
are dropped):
  frac_S              mean over the window of the fraction of live threads in state S
  frac_futex          mean over the window of the fraction blocked in futex (syscall 202)
  frac_futex_whole    fraction of live threads in futex at every tick of the window
  frac_sleepio        mean over the window of the fraction in non-futex sleep/IO
                      syscalls (SLEEP_IO_SYSCALLS)
  cpu_util_sum        sum over threads of CPU time gained in the window / window
                      length (in CPUs; utime/stime are clock ticks, 10 ms each)
  cpu_util_max        the same for the busiest thread (0..1)
  vcsw_rate           voluntary context switches per second per live thread
  nvcsw_rate          involuntary context switches per second per live thread
  vcsw_rate_change    log1p(vcsw_rate) - log1p(vcsw_rate one window earlier)
  nvcsw_rate_change   the same for nvcsw_rate
  futex_silence_ms    longest current run of consecutive ticks any live thread has
                      spent in futex with no context switch, in ms
  live_threads        live thread count (zombies excluded)
  live_change         live_threads - live_threads one window earlier
Never used as features: family, config, seed, split, run duration, exit_reason,
anything from Tier F.

Label per tick: y = 1 if the tick time >= t0 (hang runs), else 0.

CLI: python -m ml.features [--data DIR] [--out data/processed] [--windows 10,20,40]
writes <out>/features_W{W}.csv.gz with run_id, family, split, ts_ns, y + FEATURES.
"""
import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
WINDOWS = (10, 20, 40)
FUTEX = 202
# non-futex sleeping / blocking-IO syscalls (x86-64 numbers)
SLEEP_IO_SYSCALLS = {
    0: "read", 1: "write", 7: "poll", 17: "pread64", 18: "pwrite64", 23: "select",
    35: "nanosleep", 43: "accept", 45: "recvfrom", 47: "recvmsg", 61: "wait4",
    230: "clock_nanosleep", 232: "epoll_wait", 270: "pselect6", 271: "ppoll",
    281: "epoll_pwait", 288: "accept4", 441: "epoll_pwait2",
}
GONE_STATES = ("Z", "X", "x")
FEATURES = [
    "frac_S", "frac_futex", "frac_futex_whole", "frac_sleepio",
    "cpu_util_sum", "cpu_util_max", "vcsw_rate", "nvcsw_rate",
    "vcsw_rate_change", "nvcsw_rate_change", "futex_silence_ms",
    "live_threads", "live_change",
]
ID_COLUMNS = ["run_id", "family", "split", "ts_ns", "y"]


# --------------------------------------------------------------------- data

def default_data_dir():
    """The collected dataset: data/collect1/lockpulse-data-all/data if present, else data/."""
    cand = ROOT / "data" / "collect1" / "lockpulse-data-all" / "data"
    return cand if (cand / "processed" / "labels.csv").exists() else ROOT / "data"


def existing_csv(path):
    path = Path(path)
    if path.exists():
        return path
    gz = path.with_name(path.name + ".gz")
    return gz if gz.exists() else None


def load_labels(data_dir):
    """labels.csv without ambiguous runs. Returns (labels, n_ambiguous_excluded)."""
    labels = pd.read_csv(Path(data_dir) / "processed" / "labels.csv", keep_default_na=False)
    amb = labels["ambiguous"].astype(int) == 1
    kept = labels[~amb].copy()
    kept["hang"] = kept["hang"].astype(int)
    kept["deadlock"] = kept["deadlock"].astype(int)
    kept["t0_ns"] = pd.to_numeric(kept["t0_ns"], errors="coerce")
    return kept.reset_index(drop=True), int(amb.sum())


def read_meta(data_dir, run_id):
    return json.loads((Path(data_dir) / "raw" / "meta" / (run_id + ".json")).read_text())


def read_tierp(data_dir, run_id):
    path = existing_csv(Path(data_dir) / "raw" / "tierP" / (run_id + ".csv"))
    if path is None:
        raise FileNotFoundError("Tier P CSV missing for " + run_id)
    return pd.read_csv(path, dtype={"state": str})


def run_timing(meta):
    """(end_ns, tick_ms, cpu_tick_ms) from run metadata."""
    tick_ms = float(meta.get("interval_ms") or 5)
    clk = (meta.get("launcher_cpu") or {}).get("clk_tck") or 100
    return int(meta["end_ns"]), tick_ms, 1000.0 / float(clk)


# ------------------------------------------------------- per-tick matrices

def thread_matrices(tierp, end_ns=None):
    """Tier P rows -> tick x thread matrices (ticks sorted, ts <= end_ns).

    Returns dict: ts (T,), present/S/futex/sleepio (T, N) bool,
    cpu/vcs/nvcs (T, N) float with NaN where the thread is not live."""
    df = tierp
    if end_ns is not None:
        df = df[df["ts_ns"] <= end_ns]
    df = df.drop_duplicates(["ts_ns", "tid"], keep="last")
    ts = np.sort(df["ts_ns"].unique())
    tids = np.sort(df["tid"].unique())
    T, N = len(ts), len(tids)
    ti = np.searchsorted(ts, df["ts_ns"].to_numpy())
    ci = np.searchsorted(tids, df["tid"].to_numpy())
    state = df["state"].astype(str).to_numpy()
    live = ~np.isin(state, GONE_STATES)
    sc = df["syscall_nr"].to_numpy()

    def bmat(values):
        a = np.zeros((T, N), dtype=bool)
        a[ti, ci] = values & live
        return a

    def fmat(values):
        a = np.full((T, N), np.nan)
        a[ti, ci] = np.where(live, values, np.nan)
        return a

    return {
        "ts": ts,
        "present": bmat(np.ones(len(df), dtype=bool)),
        "S": bmat(state == "S"),
        "futex": bmat(sc == FUTEX),
        "sleepio": bmat(np.isin(sc, list(SLEEP_IO_SYSCALLS))),
        "cpu": fmat((df["utime_ticks"] + df["stime_ticks"]).to_numpy(dtype=float)),
        "vcs": fmat(df["vcsw"].to_numpy(dtype=float)),
        "nvcs": fmat(df["nvcsw"].to_numpy(dtype=float)),
    }


def _ffill(a):
    return pd.DataFrame(a).ffill().to_numpy()


def _rolling_sum(a, W):
    """Sum of the last W rows (inclusive) along axis 0; shorter at the start."""
    c = np.cumsum(np.concatenate([np.zeros((1,) + a.shape[1:]), a], axis=0), axis=0)
    idx = np.arange(1, a.shape[0] + 1)
    lo = np.maximum(idx - W, 0)
    return c[idx] - c[lo]


def _base_index(T, W):
    i = np.arange(T)
    return np.maximum(i - W, 0)


def _window_delta(x, W):
    """Per-thread growth of a cumulative counter over the last W ticks.
    Threads born inside the window count from 0; non-live threads are NaN."""
    base = _ffill(x)[_base_index(x.shape[0], W)]
    base = np.where(np.isnan(base), 0.0, base)
    return np.clip(x - base, 0.0, None)


def _nansum_rows(a):
    return np.where(np.isnan(a), 0.0, a).sum(axis=1)


def _nanmax_rows(a):
    return np.where(np.isnan(a), 0.0, a).max(axis=1) if a.shape[1] else np.zeros(a.shape[0])


def futex_silence_streak(m):
    """Per tick: longest current streak (in ticks) of any live thread that is in
    futex and had no context switch since the previous tick."""
    cs = m["vcs"] + m["nvcs"]
    T = len(m["ts"])
    streak = np.zeros(m["present"].shape[1])
    out = np.zeros(T)
    for t in range(T):
        if t == 0:
            cond = np.zeros_like(streak, dtype=bool)
        else:
            same = (cs[t] == cs[t - 1])  # NaN compares False
            cond = m["futex"][t] & m["present"][t - 1] & same
        streak = np.where(cond, streak + 1, 0)
        live = m["present"][t]
        out[t] = streak[live].max() if live.any() else 0
    return out


def run_features(tierp, W, tick_ms=5.0, cpu_tick_ms=10.0, end_ns=None, mats=None):
    """Feature rows (ts_ns + FEATURES) for one run; warm-up rows (i < W) skipped."""
    m = mats if mats is not None else thread_matrices(tierp, end_ns)
    ts = m["ts"]
    T = len(ts)
    if T <= W:
        return pd.DataFrame(columns=["ts_ns"] + FEATURES)
    present = m["present"]
    live = present.sum(axis=1).astype(float)
    denom = np.maximum(live, 1.0)
    base = _base_index(T, W)
    span = np.maximum(np.arange(T) - base, 1)            # ticks covered by the window
    span_s = span * tick_ms / 1000.0
    n_in = np.minimum(np.arange(T) + 1, W)               # ticks inside the window

    def wmean(per_tick):
        return _rolling_sum(per_tick[:, None], W)[:, 0] / n_in

    frac_S = wmean((m["S"]).sum(axis=1) / denom)
    frac_futex = wmean(m["futex"].sum(axis=1) / denom)
    frac_sleepio = wmean(m["sleepio"].sum(axis=1) / denom)
    whole = (_rolling_sum(m["futex"].astype(float), W) >= n_in[:, None]) & present
    frac_futex_whole = whole.sum(axis=1) / denom

    dcpu = _window_delta(m["cpu"], W) * cpu_tick_ms      # ms of CPU per thread
    cpu_util_sum = _nansum_rows(dcpu) / (span * tick_ms)
    cpu_util_max = _nanmax_rows(dcpu) / (span * tick_ms)

    vcsw_rate = _nansum_rows(_window_delta(m["vcs"], W)) / span_s / denom
    nvcsw_rate = _nansum_rows(_window_delta(m["nvcs"], W)) / span_s / denom
    vcsw_change = np.log1p(vcsw_rate) - np.log1p(vcsw_rate[base])
    nvcsw_change = np.log1p(nvcsw_rate) - np.log1p(nvcsw_rate[base])

    silence_ms = futex_silence_streak(m) * tick_ms
    live_change = live - live[base]

    out = pd.DataFrame({
        "ts_ns": ts, "frac_S": frac_S, "frac_futex": frac_futex,
        "frac_futex_whole": frac_futex_whole, "frac_sleepio": frac_sleepio,
        "cpu_util_sum": cpu_util_sum, "cpu_util_max": cpu_util_max,
        "vcsw_rate": vcsw_rate, "nvcsw_rate": nvcsw_rate,
        "vcsw_rate_change": vcsw_change, "nvcsw_rate_change": nvcsw_change,
        "futex_silence_ms": silence_ms, "live_threads": live, "live_change": live_change,
    })
    return out.iloc[W:].reset_index(drop=True)


def tick_labels(ts, hang, t0_ns):
    """y = 1 for ticks at or after t0 in hang runs, else 0."""
    ts = np.asarray(ts)
    if int(hang) == 1 and t0_ns == t0_ns and t0_ns is not None:
        return (ts >= int(t0_ns)).astype(np.int8)
    return np.zeros(len(ts), dtype=np.int8)


# ------------------------------------------------------------ dataset level

def build_features(data_dir, out_dir, windows=WINDOWS, verbose=True):
    """Compute features for every non-ambiguous run and write features_W{W}.csv.gz."""
    labels, n_amb = load_labels(data_dir)
    if verbose:
        print("features: {} runs ({} ambiguous excluded), windows {}".format(len(labels), n_amb, list(windows)))
    parts = {W: [] for W in windows}
    t_start = time.monotonic()
    for k, r in enumerate(labels.itertuples(index=False), 1):
        meta = read_meta(data_dir, r.run_id)
        end_ns, tick_ms, cpu_tick_ms = run_timing(meta)
        mats = thread_matrices(read_tierp(data_dir, r.run_id), end_ns)
        for W in windows:
            f = run_features(None, W, tick_ms, cpu_tick_ms, mats=mats)
            f.insert(0, "y", tick_labels(f["ts_ns"].to_numpy(), r.hang, r.t0_ns))
            f.insert(0, "split", r.split)
            f.insert(0, "family", r.family)
            f.insert(0, "run_id", r.run_id)
            parts[W].append(f)
        if verbose and k % 100 == 0:
            print("  {}/{} runs ({:.0f} s)".format(k, len(labels), time.monotonic() - t_start))
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = {}
    for W in windows:
        df = pd.concat(parts[W], ignore_index=True)
        paths[W] = out_dir / "features_W{}.csv.gz".format(W)
        df.to_csv(paths[W], index=False, float_format="%.6g")
        if verbose:
            bal = df.groupby("split")["y"].agg(rows="size", positive="sum")
            bal["pos_frac"] = (bal["positive"] / bal["rows"]).round(3)
            print("  W={} ({} ms): {} rows -> {}".format(W, W * 5, len(df), paths[W].name))
            print("    " + bal.to_string().replace("\n", "\n    "))
    return paths, n_amb


def load_features(features_dir, W):
    return pd.read_csv(Path(features_dir) / "features_W{}.csv.gz".format(W))


def main(argv=None):
    ap = argparse.ArgumentParser(description="Build Tier P window features.")
    ap.add_argument("--data", default=None, help="dataset root with raw/ and processed/ (default: auto)")
    ap.add_argument("--out", default=str(ROOT / "data" / "processed"))
    ap.add_argument("--windows", default=",".join(str(w) for w in WINDOWS))
    args = ap.parse_args(argv)
    data = Path(args.data) if args.data else default_data_dir()
    build_features(data, args.out, [int(w) for w in args.windows.split(",")])
    return 0


if __name__ == "__main__":
    sys.exit(main())
