"""Unit tests for ml/features.py on small synthetic Tier P traces (no real data).

Run: python3 -m unittest discover -s ml/tests -v   (from the repo root)
"""
import sys
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from ml import features as F  # noqa: E402

TICK_NS = 5_000_000


def synth_tierp(n_ticks=120, n_threads=4, hang_at=70, seed=0, t_start=1_000_000_000):
    """Healthy-looking activity, then from tick `hang_at` every thread is blocked
    in futex with frozen counters. Thread 3 is born at tick 5, thread 2 exits at 100."""
    rng = np.random.default_rng(seed)
    rows = []
    cpu = np.zeros(n_threads)
    vcs = np.zeros(n_threads)
    nvcs = np.zeros(n_threads)
    for t in range(n_ticks):
        ts = t_start + t * TICK_NS
        for tid in range(n_threads):
            if tid == 3 and t < 5:
                continue
            if tid == 2 and t >= 100:
                continue
            if t < hang_at:
                running = rng.random() < 0.5
                cpu[tid] += rng.integers(0, 2) if running else 0
                vcs[tid] += rng.integers(0, 3)
                nvcs[tid] += rng.integers(0, 2)
                state, sc = ("R", -1) if running else ("S", rng.choice([202, 0, 230]))
            else:
                state, sc = "S", 202
            rows.append((ts, 100 + tid, state, int(cpu[tid]), 0, int(vcs[tid]), int(nvcs[tid]), int(sc)))
    return pd.DataFrame(rows, columns=["ts_ns", "tid", "state", "utime_ticks", "stime_ticks", "vcsw", "nvcsw",
                                       "syscall_nr"])


class LeakageTest(unittest.TestCase):
    def test_appending_future_rows_never_changes_earlier_rows(self):
        full = synth_tierp(n_ticks=150, seed=1)
        ticks = np.sort(full["ts_ns"].unique())
        for W in F.WINDOWS:
            ref = F.run_features(full, W)
            for cut in (W + 1, 60, 70, 71, 99, 101, 149):
                part = F.run_features(full[full["ts_ns"] <= ticks[cut]], W)
                self.assertGreater(len(part), 0)
                head = ref[ref["ts_ns"] <= ticks[cut]].reset_index(drop=True)
                pd.testing.assert_frame_equal(part, head, check_exact=False, rtol=1e-12, atol=1e-12,
                                              obj="W={} cut={}".format(W, cut))

    def test_features_ignore_row_order(self):
        df = synth_tierp(seed=2)
        a = F.run_features(df, 20)
        b = F.run_features(df.sample(frac=1.0, random_state=3), 20)
        pd.testing.assert_frame_equal(a, b)


class WarmupAndEndTest(unittest.TestCase):
    def test_first_w_ticks_are_skipped(self):
        df = synth_tierp(n_ticks=90)
        ticks = np.sort(df["ts_ns"].unique())
        for W in F.WINDOWS:
            f = F.run_features(df, W)
            self.assertEqual(len(f), len(ticks) - W)
            self.assertEqual(int(f["ts_ns"].iloc[0]), int(ticks[W]))

    def test_ticks_after_end_are_dropped(self):
        df = synth_tierp(n_ticks=90)
        ticks = np.sort(df["ts_ns"].unique())
        f = F.run_features(df, 10, end_ns=int(ticks[50]))
        self.assertEqual(int(f["ts_ns"].max()), int(ticks[50]))

    def test_short_run_gives_no_rows(self):
        f = F.run_features(synth_tierp(n_ticks=8), 10)
        self.assertEqual(len(f), 0)
        self.assertEqual(list(f.columns), ["ts_ns"] + F.FEATURES)


class LabelTest(unittest.TestCase):
    def test_y_is_one_from_t0_on_for_hang_runs(self):
        ts = np.arange(10) * 5
        self.assertEqual(F.tick_labels(ts, 1, 20).tolist(), [0, 0, 0, 0, 1, 1, 1, 1, 1, 1])
        self.assertEqual(F.tick_labels(ts, 0, float("nan")).sum(), 0)
        self.assertEqual(F.tick_labels(ts, 0, 20).sum(), 0)  # healthy runs never positive


class ValueTest(unittest.TestCase):
    def test_hang_phase_values(self):
        df = synth_tierp(n_ticks=150, hang_at=70)
        W = 10
        f = F.run_features(df, W).set_index("ts_ns")
        ticks = np.sort(df["ts_ns"].unique())
        late = f.loc[ticks[90]]  # 20 ticks into the hang, before thread 2 exits
        self.assertEqual(late["frac_futex"], 1.0)
        self.assertEqual(late["frac_futex_whole"], 1.0)
        self.assertEqual(late["frac_S"], 1.0)
        self.assertEqual(late["cpu_util_sum"], 0.0)
        self.assertEqual(late["vcsw_rate"], 0.0)
        self.assertEqual(late["live_threads"], 4)
        # every thread is silent in futex from tick 70 on: ticks 70..90 = 21 ticks; a thread
        # may already have been silent in futex before the hang, so this is a lower bound
        self.assertGreaterEqual(late["futex_silence_ms"], (90 - 70 + 1) * 5.0)
        self.assertLessEqual(late["futex_silence_ms"], 91 * 5.0)
        after_exit = f.loc[ticks[105]]
        self.assertEqual(after_exit["live_threads"], 3)
        self.assertEqual(after_exit["live_change"], -1)

    def test_no_feature_uses_metadata(self):
        for bad in ("family", "config_id", "seed", "split", "exit_reason", "duration_ms", "run_id"):
            self.assertNotIn(bad, F.FEATURES)


if __name__ == "__main__":
    unittest.main()
