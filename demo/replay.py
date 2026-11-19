"""replay.py - replay a recorded LockPulse run tick by tick in the terminal.

  python -m demo.replay <run_id> [--speed 1.0] [--every-ms 100] [--data DIR]

Shows, as the run unfolds: thread states (R running, F futex, I sleep/IO,
B other blocked, . not alive), how many threads are in futex, the M3 score,
the B2 silence and an ALERT line the moment each detector fires (B3 also
names the threads in the mutex cycle). Ground truth (hang / t0 / deadlock)
is revealed only at the end, followed by each detector's outcome and delay.

Works on any OS: it replays the recorded Tier P + Tier F traces through the
frozen phase-3 detectors (hashes verified); nothing is executed.
--speed 1.0 is real time, 0.5 half speed, 0 = no waiting.
"""
import argparse
import sys
import time
from pathlib import Path

from ml import features as F
from ml.runview import DETECTOR_NAMES, DETECTORS, RunView, load_frozen

STATE_CHARS = {-1: ".", 0: "R", 1: "F", 2: "I", 3: "B"}


def fmt_ms(ns, start):
    return "{:7.0f} ms".format((ns - start) / 1e6)


def describe_outcome(view, d):
    kind, delay = view.outcome(d)
    alert = view.alerts[d]
    if kind == "detected":
        return "detected   delay {:+.1f} ms".format(delay)
    if kind == "fa_early":
        return "FALSE ALARM (early, {:.0f} ms before t0)".format((view.t0 - alert) / 1e6)
    if kind == "fa_healthy":
        return "FALSE ALARM at {} (run is healthy)".format(fmt_ms(alert, view.start).strip())
    if kind == "missed":
        return "missed (no alert)"
    return "quiet (correct: run is healthy)"


def replay(view, speed=1.0, every_ms=100.0, out=sys.stdout):
    w = out.write
    w("=" * 78 + "\n")
    w("LockPulse replay: {}   ({} split, {} threads seen, {} ticks of {:.0f} ms)\n".format(
        view.run_id, view.split, len(view.tids), len(view.ts), view.tick_ms))
    w("thresholds: B1 T={:.0f} ms | B2 T={:.0f} ms | B4 T={:.0f} ms | M1/M2/M3 > {:.4g}/{:.4g}/{:.4g} "
      "for 3 ticks | B3 cycle\n".format(view.thresholds["B1"], view.thresholds["B2"], view.thresholds["B4"],
                                       view.thresholds["M1"], view.thresholds["M2"], view.thresholds["M3"]))
    w("states: R running  F futex  I sleep/IO  B other blocked  . not alive\n")
    w("-" * 78 + "\n")
    pending = sorted((a, d) for d, a in view.alerts.items() if a is not None)
    last_print = -1e18
    t_wall = time.monotonic()
    for i, ts in enumerate(view.ts):
        if speed > 0:
            target = t_wall + (ts - view.ts[0]) / 1e9 / speed
            delay = target - time.monotonic()
            if delay > 0:
                time.sleep(delay)
        while pending and pending[0][0] <= ts:
            a, d = pending.pop(0)
            extra = ""
            if d == "B3":
                extra = "  mutex cycle among threads {}".format(" -> ".join(str(t) for t in view.cycle_tids))
            w("{}  *** ALERT {} ***{}\n".format(fmt_ms(a, view.start), DETECTOR_NAMES[d], extra))
        t_ms = (ts - view.start) / 1e6
        if t_ms - last_print >= every_ms or i == len(view.ts) - 1:
            last_print = t_ms
            states = "".join(STATE_CHARS[int(c)] for c in view.state[i])
            m3 = view.scores["M3"][i]
            w("{}  [{}]  futex {}/{}  M3 {}  B2 silence {:6.0f} ms\n".format(
                fmt_ms(ts, view.start), states, int(view.futex_count[i]), int(view.live[i]),
                "  -  " if m3 != m3 else "{:.3f}".format(m3), view.scores["B2"][i]))
        out.flush()
    w("-" * 78 + "\n")
    if view.hang:
        truth = "HANG{} at t0 = {} (last progress event)".format(" - DEADLOCK" if view.deadlock else " (no mutex cycle)",
                                                                fmt_ms(view.t0, view.start).strip())
    else:
        truth = "HEALTHY (the program finished normally)" if not view.ambiguous else "AMBIGUOUS (excluded)"
    w("ground truth: {}\n".format(truth))
    w("oracle: {}\n".format(view.reason[:150]))
    for d in DETECTORS:
        w("  {:<24} {}\n".format(DETECTOR_NAMES[d], describe_outcome(view, d)))
    w("=" * 78 + "\n")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Replay a recorded LockPulse run with the frozen detectors.")
    ap.add_argument("run_id")
    ap.add_argument("--speed", type=float, default=1.0, help="1.0 = real time, 0 = no waiting")
    ap.add_argument("--every-ms", type=float, default=100.0, help="status line every N ms of run time")
    ap.add_argument("--data", default=None, help="dataset root (default: data/collect1/.../data)")
    args = ap.parse_args(argv)
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(errors="replace")
        except (AttributeError, ValueError):
            pass
    data = Path(args.data) if args.data else F.default_data_dir()
    settings, models = load_frozen(verify=True)
    replay(RunView(data, args.run_id, settings, models), args.speed, args.every_ms)
    return 0


if __name__ == "__main__":
    sys.exit(main())
