"""Unit tests for ml/baselines.py (B1-B4) on synthetic traces."""
import sys
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from ml import baselines as B  # noqa: E402
from ml import features as F  # noqa: E402

T1, T2, T3 = 101, 102, 103


def tierf(*events):
    return pd.DataFrame([{"ts_ns": e[0], "tid": e[1], "event": e[2], "obj_addr": e[3]} for e in events])


class B3CycleTest(unittest.TestCase):
    def test_two_lock_cycle_alerts_at_closing_req(self):
        f = tierf((10, T1, "MUTEX_ACQ", "A"), (11, T2, "MUTEX_ACQ", "B"),
                  (12, T1, "MUTEX_REQ", "B"), (13, T2, "MUTEX_REQ", "A"))
        self.assertEqual(B.b3_alert_ns(f), 13)

    def test_three_way_cycle(self):
        f = tierf((1, T1, "MUTEX_ACQ", "L0"), (2, T2, "MUTEX_ACQ", "L1"), (3, T3, "MUTEX_ACQ", "L2"),
                  (4, T1, "MUTEX_REQ", "L1"), (5, T2, "MUTEX_REQ", "L2"), (6, T3, "MUTEX_REQ", "L0"))
        self.assertEqual(B.b3_alert_ns(f), 6)

    def test_implicit_cond_events_keep_ownership_right(self):
        # T1 waits on a condvar (implicit REL of M), T2 takes M and signals; T1 re-acquires M
        # implicitly, then T1 wants N held by T2, and T2 wants M -> cycle at T2's REQ.
        f = tierf((1, T1, "MUTEX_ACQ", "M"), (2, T1, "COND_WAIT_ENTER", "C"), (2, T1, "MUTEX_REL", "M"),
                  (3, T2, "MUTEX_ACQ", "M"), (4, T2, "COND_SIGNAL", "C"), (5, T2, "MUTEX_REL", "M"),
                  (6, T2, "MUTEX_ACQ", "N"), (7, T1, "MUTEX_ACQ", "M"), (7, T1, "COND_WAIT_EXIT", "C"),
                  (8, T1, "MUTEX_REQ", "N"), (9, T2, "MUTEX_REQ", "M"))
        self.assertEqual(B.b3_alert_ns(f), 9)

    def test_without_implicit_release_no_false_cycle(self):
        # While T1 sits in cond_wait it does NOT own M (implicit REL), so T2 can take M: no cycle.
        f = tierf((1, T1, "MUTEX_ACQ", "M"), (2, T1, "COND_WAIT_ENTER", "C"), (2, T1, "MUTEX_REL", "M"),
                  (3, T2, "MUTEX_ACQ", "N"), (4, T2, "MUTEX_REQ", "M"), (4, T2, "MUTEX_ACQ", "M"),
                  (5, T3, "MUTEX_REQ", "N"))
        self.assertIsNone(B.b3_alert_ns(f))

    def test_chain_and_error_are_not_cycles(self):
        f = tierf((1, T1, "MUTEX_ACQ", "A"), (2, T2, "MUTEX_REQ", "A"), (3, T2, "ERROR", "A"),
                  (4, T2, "MUTEX_ACQ", "B"), (5, T1, "MUTEX_REQ", "B"))
        self.assertIsNone(B.b3_alert_ns(f))  # T2's request on A ended with ERROR

    def test_non_mutex_hang_is_invisible(self):
        f = tierf((1, T1, "BARRIER_ENTER", "b"), (2, T2, "SEM_WAIT_ENTER", "s"))
        self.assertIsNone(B.b3_alert_ns(f))


def mats_from(rows):
    df = pd.DataFrame(rows, columns=["ts_ns", "tid", "state", "utime_ticks", "stime_ticks", "vcsw", "nvcsw",
                                     "syscall_nr"])
    return F.thread_matrices(df)


MS = 1_000_000


class SilenceScoreTest(unittest.TestCase):
    def test_b1_counts_time_without_cpu_growth(self):
        rows = []
        for i, cpu in enumerate([0, 1, 2, 2, 2, 2, 3]):
            rows.append((i * 5 * MS, 1, "R", cpu, 0, 0, 0, -1))
        s = B.b1_scores(mats_from(rows))
        self.assertEqual(s.tolist(), [0, 0, 0, 5, 10, 15, 0])

    def test_b2_needs_every_thread_in_futex_without_switches(self):
        rows = []
        for i in range(6):
            rows.append((i * 5 * MS, 1, "S", 0, 0, 3, 0, 202))
            # thread 2 is in read() until tick 3, then futex
            rows.append((i * 5 * MS, 2, "S", 0, 0, 7, 1, 0 if i < 3 else 202))
        s = B.b2_scores(mats_from(rows))
        self.assertEqual(s.tolist(), [0, 0, 0, 5, 10, 15])

    def test_b2_resets_on_context_switch(self):
        vcsw = [4, 4, 4, 5, 5, 5]  # one voluntary switch at tick 3
        rows = [(i * 5 * MS, 1, "S", 0, 0, vcsw[i], 0, 202) for i in range(6)]
        s = B.b2_scores(mats_from(rows))
        self.assertEqual(s.tolist(), [0, 5, 10, 0, 5, 10])

    def test_b4_ms_since_last_progress(self):
        f = tierf((2 * MS, T1, "MUTEX_ACQ", "A"), (7 * MS, T1, "MUTEX_REQ", "B"))  # REQ is not progress
        ts = np.array([0, 5, 10, 20]) * MS
        self.assertEqual(B.b4_scores(ts, f, start_ns=0).tolist(), [0, 3, 8, 18])


if __name__ == "__main__":
    unittest.main()
