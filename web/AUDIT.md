# Website audit — https://lockpulse-pearl.vercel.app/

Audited on 2026-11-24 against `main` at 6fb855f (the deployed build), before any fix.

**Method.** Each page (`/`, `/replay`, `/results`, `/why-syscall`, `/method`, and `/methodology`) was opened in
headless Microsoft Edge (Chromium, Playwright) at 1440, 1024 and 390 px. For each page and width the script:

- recorded console errors and warnings, page errors, failed requests and HTTP responses ≥ 400;
- scrolled through the page so reveal-on-scroll sections render;
- took a full-page screenshot and dumped `innerText`;
- flagged:
  - glued-word candidates (camelCase tokens, digits glued to words, very long lowercase tokens);
  - text under 11 px;
  - horizontal page overflow.

Every number on the site was then checked against `results/phase4/test_table.md`, `REPORT.md`,
`ablation_table.md` and `overhead_table.md`.

The screenshots taken before the fixes are in [audit/before/](audit/before/). Screenshots of the fixed build are in [audit/after/](audit/after/).

## Summary

| Check | Result |
|---|---|
| Console errors / page errors / failed requests | **none**, on every page at every width |
| Horizontal page overflow | **none** (wide tables scroll inside their own box) |
| Text under 11 px | **none** |
| Visibly glued words ("thesilence", "LockPulseLinux", "2026LockPulse") | **none visible**. Flagged tokens were real words (eBPF, vCPUs, LockPulse’s), plus two places where the copied/screen-reader text has no space (R5, W1). |
| Numbers vs. test table / report | **all match** (R7 lists the rounding and one display bug) |
| `/methodology` | **404**: the page lives at `/method` (the nav label says "Methodology") |

## Findings

Severity: **H** = wrong or missing content, **M** = misleading or hard to read, **L** = polish.

### /replay ([1440](audit/before/replay_1440.jpg), [390](audit/before/replay_390.jpg))

| # | Sev | Finding |
|---|---|---|
| P1 | H | The main visualization is missing. Thread state is a table for the current tick only; nothing shows the run over time (per-thread timeline, scores). |
| P2 | H | M1–M3 show "No per-tick score exported". The scores are exported in `public/data/runs/*.json` (697 values each for M1/M2/M3/B2 in dining_philosophers-c1-s01). The panel looks up `scores[det][tick]`. It shows the message whenever the value is `null`, which happens during the first 10 ticks (the feature window warm-up), and the default cursor is tick 0. B1/B3/B4 always show the message because they are rules without a score. |
| P3 | H | The timeline legend shows "Detector alert · 1985.0 ms" etc. **seven times with no detector name**. All markers are the same red, and the markers at 525/535/540 ms overlap into one dot. |
| P4 | M | "Selected recorded trace" prints the raw labeler reason with hex addresses: `2969 MUTEX_REQ(0x5e1d63c9f048); … deadlock cycle: 2969 -[0x5e1d63c9f048]-> 2970 …`. |
| P5 | M | Thresholds are printed with `toFixed(4)`: B2 reads "threshold 50.0000" (should be "50 ms"). M3 would read "1.0000" (actual value 0.9999936). |
| P6 | M | Delays and alert times have decimals ("delay 1505.8 ms", "Alert 539.9 ms", cursor "0.00 ms / 3479.90 ms"). |
| P7 | M | The run picker is one flat list of 41 runs in alphabetical order. It is not grouped by split and does not mark the test runs. At 390 px the option text is cut off. |
| P8 | M | The Thread state table shows "Syscall nr −1" instead of the syscall name. The names are in `index.json` → `syscallNames` (−1 = running). |
| P9 | L | The Detector signals list is cut at a fixed height (`max-h-80`), so M2 and M3 are hidden below an inner scroll at all widths. |
| P10 | L | At cursor 0 (the default), the wait-for graph, the event log and every score are empty. The page looks broken until the user scrubs. |
| P11 | L | The wait-for "graph" is a text list, not a drawing. (Kept as text, but it now shows "cycle: T… → … → T…".) |

### /results ([1440](audit/before/results_1440.jpg), [390](audit/before/results_390.jpg))

| # | Sev | Finding |
|---|---|---|
| R1 | M | The setting for M3 reads `threshold=1`. The frozen threshold is 0.9999936 (`frozen.json`). The string comes from the test table, which rounds to 4 decimals, so 0.999994 rounds to 1. |
| R2 | M | Delays have decimals ("1512.1 ms", "46.9 ms–69.4 ms"). B3 median reads "0.0 ms". The real value is 0.0003 ms, which is better shown as "<1 ms". |
| R3 | M | The per-family view lists **Blocked On Io** with "0/0 · —" bars for B2/M2/M3. blocked_on_io has no hangs, so detection is undefined. The point of that family is false alarms (B1 23, M1 15), and those are not shown. |
| R4 | L | Family names are title-cased by CSS: "Blocked On Io", "Sem Never Posted". |
| R5 | L | Badge and name have no space in the text ("B1fixed timeout" when copied or read by a screen reader). Visually it looks fine. |
| R6 | L | At 390 px the table's Setting column is clipped inside its scroll box (acceptable, but the model settings are long JSON). |
| R7 | — | Every number matches `test_table.md`: 91/91 for B1/B2/B4/M1–M3, 46/91 for B3. Medians 1512 / 69 / 0 / 1513 / 36 / 47 / 55 ms. p90 1525 / 83 / 0 / 1515 / 110 / 65 / 60 ms. False alarms 23 / 0 / 0 / 23 / 15 / 0 / 0. PR-AUC 0.918 / 0.998 / 0.991 / 0.999 / 0.999. 180 runs. The validation toggle matches `results/phase3`. |

### / (landing) ([1440](audit/before/home_1440.jpg), [390](audit/before/home_390.jpg))

| # | Sev | Finding |
|---|---|---|
| L1 | L | Screen-reader-only text "success status:" appears twice in the deadlock illustration. It is an internal tone name, read aloud before "RUNNING · LOCK HELD". |
| L2 | — | Numbers match the report: 91/91 hang detections, 0 false alarms over 89 healthy runs, median delay 47–69 ms (M2 47, M3 55, B2 69), 13 families (7 hang, 6 healthy). |
| L3 | — | In the first full-page screenshots, sections lower on the page were blank at 390 px. A slow real scroll shows every section (no element is left at opacity 0). The blank sections came from the audit script scrolling too fast, not from the site. |

### /why-syscall ([1440](audit/before/why-syscall_1440.jpg))

| # | Sev | Finding |
|---|---|---|
| W1 | L | The ablation tabs have no space in the text ("M2Random forest", "M3Gradient boosting") when copied or read by a screen reader. |
| W2 | — | Numbers match `ablation_table.md`: 91/91 detected with syscall features, 0/91 without. |

### /method ([1440](audit/before/method_1440.jpg)) and /methodology

| # | Sev | Finding |
|---|---|---|
| M1 | M | `/methodology` returns 404. The page lives at `/method`, but the nav label and the README call it "Methodology". |
| M2 | — | Numbers match the report and the tables:<br>• runs: 359 train / 240 validation / 180 test, 780 collected, 779 analyzed (1 ambiguous);<br>• overhead (P / F / both): 1.15× / 1.78× / 1.73× on high_contention and 1.00× / 1.21× / 1.21× on prodcons_correct ([`overhead_table.md`](../results/phase4/overhead_table.md));<br>• the limitations text. |

### All pages

| # | Sev | Finding |
|---|---|---|
| A1 | — | The footer ("SYSTEM PROGRAMMING · LINUX · 2026" / "LOCKPULSE / ECU") and the "Research interface / Linux" + logo row are laid out as separate blocks. They are not glued visually at any width. |

## Fixes

| Finding | Fix |
|---|---|
| P1 | New per-thread timeline (canvas). One row per thread, one cell per 5 ms tick:<br>• running: green<br>• futex: red<br>• sleep/IO: blue<br>• other blocked: amber<br>• not alive: gray<br>It has a cursor line and a t0 marker, and the per-detector alert ticks sit on the same time axis. Click or drag on it to scrub. It stays in sync with the range scrubber and the keyboard controls. |
| P2 | Score chart below the timeline, on the same time axis:<br>• M3 probability with its frozen threshold (0.999994);<br>• B2 futex silence in ms with T = 50 ms;<br>• cursor line and t0 marker.<br>In the detector list:<br>• M1–M3 show their score, or "warming up (first 50 ms)";<br>• B2 shows its silence in ms;<br>• B1/B3/B4 say "rule, no score". |
| P3 | Each alert is labeled with its detector name, has its own color, and shows its time and delay. The alert markers are drawn on the timeline. |
| P4 | Readable summary:<br>• label;<br>• t0;<br>• blocked threads;<br>• for deadlocks, "cycle: T2969 → T2970 → … → T2969";<br>• for hangs, what the threads wait on.<br>The raw reason is behind a "details" toggle. |
| P5, P6 | Thresholds have units: "50 ms", "1500 ms", probabilities to 6 significant decimals. All delays and times are rounded to whole ms. |
| P7 | The run picker uses `<optgroup>` by split: test first (marked "held-out"), then validation, then train. Each option is family · config/seed · label. |
| P8 | The syscall column shows the name (futex, nanosleep, running, …). |
| P9 | The detector list shows all seven detectors with no inner scroll. |
| P10 | The page opens at the ground-truth onset of the selected run (or the middle of the run for healthy runs), so all panels are populated. `?run=` and `?t=` in the URL select a run and a time, so a view can be linked. |
| R1 | Model thresholds are shown at their frozen precision (0.99958, 0.99470, 0.999994). |
| R2 | Delays are rounded to whole ms. Sub-millisecond B3 delays read "<1 ms". |
| R3, R4 | blocked_on_io (healthy only) shows false alarms per detector instead of empty detection bars. Family names keep their underscores-to-spaces form without title case. |
| R5, W1 | Added the missing space in the badge and tab text. |
| L1 | The screen-reader text says "Status:". |
| M1 | `/methodology` redirects to `/method` (vercel.json). |
