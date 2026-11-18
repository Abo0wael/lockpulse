"""Unit tests for ml/label.py on tiny hand-made traces.

Run: python3 -m unittest discover -s ml/tests -v   (from the repo root)
"""
import sys
import unittest
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import label  # noqa: E402

MAIN, T1, T2, T3 = 100, 101, 102, 103
A, B, M, N, C, S = "0xa", "0xb", "0x10", "0x20", "0xc0", "0x5e"
IMPLICIT = 65535


def tierf(*events):
    """events: (ts, tid, event, obj[, site])"""
    rows = []
    for e in events:
        ts, tid, ev, obj = e[:4]
        site = e[4] if len(e) > 4 else 0
        rows.append({"ts_ns": ts, "tid": tid, "event": ev, "obj_addr": obj, "wait_ns": 0, "site": site})
    return pd.DataFrame(rows, columns=["ts_ns", "tid", "event", "obj_addr", "wait_ns", "site"])


def tierp(ticks, threads):
    """threads: tid -> list of (state, cpu_ticks) per tick (None = thread absent)."""
    rows = []
    for i, ts in enumerate(ticks):
        for tid, seq in threads.items():
            if seq[i] is None:
                continue
            state, cpu = seq[i]
            rows.append({"ts_ns": ts, "tid": tid, "state": state, "utime_ticks": cpu, "stime_ticks": 0,
                         "vcsw": 0, "nvcsw": 0, "syscall_nr": 202})
    return pd.DataFrame(rows, columns=["ts_ns", "tid", "state", "utime_ticks", "stime_ticks", "vcsw",
                                       "nvcsw", "syscall_nr"])


def meta(exit_reason="watchdog_kill", **kw):
    m = {"run_id": "r1", "family": "fam", "seed": "1", "params": {"force": "1"},
         "tags": {"split": "train", "config_id": "c1"}, "exit_reason": exit_reason,
         "start_ns": 0, "exec_ns": 1, "tierF": {"overflow": False}}
    m.update(kw)
    return m


TICKS = [5, 20, 30, 40]


class DeadlockTest(unittest.TestCase):
    def test_two_lock_cycle(self):
        f = tierf((10, T1, "MUTEX_REQ", A), (10, T1, "MUTEX_ACQ", A),
                  (11, T2, "MUTEX_REQ", B), (11, T2, "MUTEX_ACQ", B),
                  (12, T1, "MUTEX_REQ", B), (13, T2, "MUTEX_REQ", A))
        p = tierp(TICKS, {MAIN: [("S", 3)] * 4, T1: [("R", 1), ("S", 2), ("S", 2), ("S", 2)],
                          T2: [("R", 1), ("S", 2), ("S", 2), ("S", 2)]})
        row = label.label_run(meta(), f, p)
        self.assertEqual(row["hang"], 1, row["reason"])
        self.assertEqual(row["deadlock"], 1, row["reason"])
        self.assertEqual(row["ambiguous"], 0)
        self.assertEqual(row["t0_ns"], 11)
        self.assertIn("deadlock cycle", row["reason"])
        self.assertEqual((row["split"], row["config_id"], row["seed"], row["force"]), ("train", "c1", 1, 1))

    def test_cycle_through_implicit_cond_ownership(self):
        # T1 re-acquires M inside cond_wait (implicit ACQ), then requests N;
        # T2 holds N and requests M.
        f = tierf((10, T1, "MUTEX_REQ", M), (10, T1, "MUTEX_ACQ", M),
                  (11, T1, "COND_WAIT_ENTER", C), (11, T1, "MUTEX_REL", M, IMPLICIT),
                  (12, T2, "MUTEX_REQ", N), (12, T2, "MUTEX_ACQ", N),
                  (13, T2, "COND_SIGNAL", C),
                  (14, T1, "MUTEX_ACQ", M, IMPLICIT), (14, T1, "COND_WAIT_EXIT", C),
                  (15, T1, "MUTEX_REQ", N), (16, T2, "MUTEX_REQ", M))
        p = tierp(TICKS, {T1: [("S", 1)] * 4, T2: [("S", 1)] * 4})
        row = label.label_run(meta(), f, p)
        self.assertEqual((row["hang"], row["deadlock"]), (1, 1), row["reason"])
        self.assertEqual(row["t0_ns"], 14)

    def test_waiting_on_held_mutex_without_cycle_is_not_deadlock(self):
        # T2 waits for A, held by T1 which is stuck in sem_wait: a hang, but no cycle.
        f = tierf((10, T1, "MUTEX_ACQ", A), (11, T1, "SEM_WAIT_ENTER", S),
                  (12, T2, "MUTEX_REQ", A))
        p = tierp(TICKS, {T1: [("S", 0)] * 4, T2: [("S", 0)] * 4})
        row = label.label_run(meta(), f, p)
        self.assertEqual((row["hang"], row["deadlock"], row["ambiguous"]), (1, 0, 0), row["reason"])


class LostWakeupTest(unittest.TestCase):
    def test_waiter_pending_in_cond_wait(self):
        f = tierf((10, T1, "MUTEX_ACQ", M), (11, T1, "COND_SIGNAL", C), (12, T1, "MUTEX_REL", M),
                  (20, T2, "MUTEX_REQ", M), (20, T2, "MUTEX_ACQ", M),
                  (21, T2, "COND_WAIT_ENTER", C), (21, T2, "MUTEX_REL", M, IMPLICIT))
        # T1 (signaler) has exited: absent from the last samples
        p = tierp(TICKS, {MAIN: [("S", 2)] * 4, T1: [("R", 1), None, None, None],
                          T2: [("R", 1), ("S", 1), ("S", 1), ("S", 1)]})
        row = label.label_run(meta(), f, p)
        self.assertEqual((row["hang"], row["deadlock"], row["ambiguous"]), (1, 0, 0), row["reason"])
        self.assertEqual(row["t0_ns"], 21)  # the implicit REL is the last progress event
        self.assertIn("COND_WAIT_ENTER", row["reason"])

    def test_main_never_seen_by_shim_uses_tier_p(self):
        f = tierf((10, T1, "BARRIER_ENTER", "0xba"))
        p = tierp(TICKS, {MAIN: [("S", 2)] * 4, T1: [("S", 0)] * 4})
        row = label.label_run(meta(), f, p)
        self.assertEqual(row["hang"], 1, row["reason"])
        self.assertIn("{} P:S no-cpu".format(MAIN), row["reason"])


class HealthyTest(unittest.TestCase):
    def test_exited_ok(self):
        row = label.label_run(meta("exited_ok"), tierf((10, T1, "MUTEX_ACQ", A)), None)
        self.assertEqual((row["hang"], row["deadlock"], row["ambiguous"]), (0, 0, 0))
        self.assertEqual(row["t0_ns"], "")


class AmbiguousTest(unittest.TestCase):
    def test_running_thread_after_t0(self):
        f = tierf((10, T1, "MUTEX_ACQ", A), (11, T1, "MUTEX_REL", A))
        p = tierp(TICKS, {T1: [("S", 0)] * 4, T3: [("R", 5), ("R", 9), ("R", 14), ("R", 20)]})
        row = label.label_run(meta(), f, p)
        self.assertEqual((row["hang"], row["ambiguous"]), (0, 1), row["reason"])
        self.assertIn(str(T3), row["reason"])

    def test_error_closes_pending_wait(self):
        # sem_timedwait timed out (ERROR): T1 is no longer blocked in Tier F, and Tier P shows CPU use.
        f = tierf((10, T1, "SEM_WAIT_ENTER", S), (20, T1, "ERROR", S), (21, T1, "MUTEX_ACQ", A))
        p = tierp(TICKS, {T1: [("S", 0), ("R", 1), ("R", 3), ("R", 6)]})
        row = label.label_run(meta(), f, p)
        self.assertEqual(row["ambiguous"], 1, row["reason"])

    def test_max_time_kill(self):
        row = label.label_run(meta("max_time_kill"), tierf((10, T1, "MUTEX_ACQ", A)), tierp([5], {T1: [("R", 1)]}))
        self.assertEqual((row["hang"], row["ambiguous"]), (0, 1))

    def test_signaled(self):
        row = label.label_run(meta("signaled(11)"), None, None)
        self.assertEqual(row["ambiguous"], 1)

    def test_overflow(self):
        row = label.label_run(meta("exited_ok", tierF={"overflow": True, "overflow_flags": 1}), None, None)
        self.assertEqual((row["hang"], row["ambiguous"]), (0, 1))
        self.assertIn("overflow", row["reason"])

    def test_missing_tier_f(self):
        row = label.label_run(meta(), None, tierp([5], {T1: [("S", 0)]}))
        self.assertEqual(row["ambiguous"], 1)


class CycleTest(unittest.TestCase):
    def test_find_cycle_three_way(self):
        st = label.TraceState()
        st.owner = {"L0": 1, "L1": 2, "L2": 3}
        st.pending = {1: ("MUTEX_REQ", "L1", 0), 2: ("MUTEX_REQ", "L2", 0), 3: ("MUTEX_REQ", "L0", 0),
                      4: ("MUTEX_REQ", "L0", 0)}
        cyc = label.find_cycle(st)
        self.assertIsNotNone(cyc)
        self.assertEqual(sorted(t for t, _ in cyc), [1, 2, 3])

    def test_no_cycle_for_chain(self):
        st = label.TraceState()
        st.owner = {"L0": 1}
        st.pending = {2: ("MUTEX_REQ", "L0", 0), 3: ("SEM_WAIT_ENTER", "S", 0)}
        self.assertIsNone(label.find_cycle(st))


if __name__ == "__main__":
    unittest.main()
