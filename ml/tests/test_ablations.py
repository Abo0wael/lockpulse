"""Unit tests for the phase-4 ablation helpers (numpy + pandas only)."""
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from ml import ablations as A  # noqa: E402
from ml import features as F  # noqa: E402
from ml.tests.test_features import synth_tierp  # noqa: E402


class FeatureGroupTest(unittest.TestCase):
    def test_groups_are_subsets_and_drop_what_they_say(self):
        for name, cols in A.FEATURE_GROUPS.items():
            self.assertTrue(set(cols) <= set(F.FEATURES), name)
        self.assertEqual(A.FEATURE_GROUPS["all"], F.FEATURES)
        self.assertFalse(set(A.SYSCALL_FEATURES) & set(A.FEATURE_GROUPS["no_syscall"]))
        self.assertFalse(set(A.CTXSW_FEATURES) & set(A.FEATURE_GROUPS["no_ctxsw"]))
        self.assertEqual(set(A.FEATURE_GROUPS["state_cpu"]), {"frac_S", "cpu_util_sum", "cpu_util_max"})


class IntervalTest(unittest.TestCase):
    def test_subsample_keeps_every_nth_tick_and_all_threads(self):
        m = F.thread_matrices(synth_tierp(n_ticks=100))
        s = A._subsample(m, 4)
        self.assertEqual(len(s["ts"]), 25)
        np.testing.assert_array_equal(s["ts"], m["ts"][::4])
        np.testing.assert_array_equal(s["tids"], m["tids"])
        self.assertEqual(s["present"].shape, (25, len(m["tids"])))

    def test_same_window_duration_in_ms(self):
        for ms in A.INTERVAL_STEPS:
            self.assertEqual((A.INTERVAL_WINDOW_MS // ms) * ms, A.INTERVAL_WINDOW_MS)


if __name__ == "__main__":
    unittest.main()
