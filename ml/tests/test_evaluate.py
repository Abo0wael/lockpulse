"""Unit tests for the alert policy, run outcomes, threshold rule and test-split guard."""
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from ml import evaluate as E  # noqa: E402


class AlertPolicyTest(unittest.TestCase):
    def test_needs_three_consecutive_ticks(self):
        ts = np.arange(8) * 10
        s = [0, 1, 1, 0, 1, 1, 1, 1]
        self.assertEqual(E.first_alert_ns(ts, s, 1.0), 60)  # ticks 4,5,6 -> alert at tick 6
        self.assertIsNone(E.first_alert_ns(ts, [1, 1, 0, 1, 1, 0, 1, 1], 1.0))

    def test_runscores_matches_first_alert(self):
        rng = np.random.default_rng(0)
        ts = np.arange(200) * 5
        s = rng.random(200)
        r = E.RunScores("r", "f", 0, None, ts, s)
        for th in (0.1, 0.5, 0.9, 0.99, 2.0):
            a = r.alert_ns([th])[0]
            ref = E.first_alert_ns(ts, s, th)
            self.assertEqual(None if a < 0 else int(a), ref)


class OutcomeTest(unittest.TestCase):
    def test_outcomes(self):
        self.assertEqual(E.outcome(0, None, None), ("ok_healthy", None))
        self.assertEqual(E.outcome(0, None, 5), ("fa_healthy", None))
        self.assertEqual(E.outcome(1, 100, None), ("missed", None))
        self.assertEqual(E.outcome(1, 100, 99), ("fa_early", None))
        self.assertEqual(E.outcome(1, 100_000_000, 150_000_000), ("detected", 50.0))

    def test_nan_from_dataframes_means_no_alert(self):
        self.assertEqual(E.outcome(0, float("nan"), float("nan"))[0], "ok_healthy")
        self.assertEqual(E.outcome(1, 100.0, float("nan"))[0], "missed")

    def test_metrics(self):
        m = E.metrics_from_alerts([(1, 0, 10_000_000), (1, 0, 30_000_000), (1, 50, 10), (0, None, None),
                                   (0, None, 7)])
        self.assertEqual((m["runs"], m["hang_runs"], m["detected"], m["fa_early"], m["fa_healthy"]), (5, 3, 2, 1, 1))
        self.assertAlmostEqual(m["detection_rate"], 2 / 3)
        self.assertAlmostEqual(m["fa_rate"], 2 / 5)
        self.assertAlmostEqual(m["delay_median_ms"], 20.0)


class ThresholdRuleTest(unittest.TestCase):
    def table(self, rows):
        import pandas as pd
        return pd.DataFrame(rows, columns=["threshold", "detection_rate", "delay_median_ms", "fa_rate"])

    def test_max_detection_under_fa_bound(self):
        t = self.table([(0.1, 1.00, 10, 0.20), (0.5, 0.90, 30, 0.04), (0.7, 0.80, 20, 0.0)])
        pick, feasible = E.choose_threshold(t)
        self.assertTrue(feasible)
        self.assertEqual(pick["threshold"], 0.5)

    def test_tie_break_lower_median_delay(self):
        t = self.table([(0.5, 0.9, 40, 0.01), (0.6, 0.9, 25, 0.02), (0.7, 0.9, 25, 0.0)])
        pick, _ = E.choose_threshold(t)
        self.assertEqual(pick["threshold"], 0.7)  # equal delay -> larger threshold

    def test_fa_bound_is_inclusive(self):
        pick, feasible = E.choose_threshold(self.table([(0.5, 0.9, 40, 0.05), (0.2, 1.0, 10, 0.051)]))
        self.assertTrue(feasible)
        self.assertEqual(pick["threshold"], 0.5)

    def test_infeasible_takes_lowest_fa(self):
        pick, feasible = E.choose_threshold(self.table([(0.5, 0.9, 40, 0.30), (0.9, 0.2, 80, 0.10)]))
        self.assertFalse(feasible)
        self.assertEqual(pick["threshold"], 0.9)


class SplitGuardTest(unittest.TestCase):
    def test_test_split_refused_without_final(self):
        with self.assertRaises(SystemExit):
            E.check_split("test")
        self.assertEqual(E.check_split("test", final=True), "test")
        self.assertEqual(E.check_split("validation"), "validation")

    def test_cli_refuses_test(self):
        with self.assertRaises(SystemExit):
            E.main(["--split", "test"])


if __name__ == "__main__":
    unittest.main()
