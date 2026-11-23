import type { RunData } from "@/lib/types";
import { DETECTOR_ORDER, DETECTORS, detectorColor, formatProbability, formatThreshold, tickAt } from "@/lib/replay";
import { formatMs } from "@/lib/utils";

interface DetectorPanelProps { run: RunData; timeMs: number }

const OUTCOMES: Record<string, string> = {
  detected: "detected",
  missed: "missed",
  late: "late",
  fa_healthy: "false alarm",
  fa_early: "early alarm",
  ok_healthy: "no alarm (correct)",
};

export default function DetectorPanel({ run, timeMs }: DetectorPanelProps) {
  const tick = tickAt(run.tMs, timeMs);
  const detectorIds = DETECTOR_ORDER.filter((d) => d in run.outcomes);
  return (
    <section className="lp-panel-interactive overflow-hidden rounded-2xl border border-border bg-surface" aria-labelledby="detector-panel-title">
      <div className="border-b border-border px-4 py-3 sm:px-5"><h2 id="detector-panel-title" className="font-semibold">Detector signals</h2><p className="mt-1 text-xs text-muted">Score at the cursor, frozen threshold, first alert and outcome.</p></div>
      <div className="divide-y divide-border/70">
        {detectorIds.map((detector) => {
          const meta = DETECTORS[detector];
          const series = run.scores[detector];
          const score = series?.[tick];
          const threshold = run.thresholds[detector];
          const alert = run.alerts[detector];
          const outcome = run.outcomes[detector];
          let scoreText: string;
          if (detector === "B3") scoreText = "rule on the Tier F wait-for graph · alerts on a lock cycle";
          else if (meta?.rule || !series) scoreText = `rule, no score · fires after ${formatThreshold(detector, threshold)}`;
          else if (score == null) scoreText = `warming up (first 50 ms) · threshold ${formatThreshold(detector, threshold)}`;
          else if (detector === "B2") scoreText = `silence ${formatMs(score)} · T = ${formatThreshold(detector, threshold)}`;
          else scoreText = `score ${formatProbability(score)} · threshold ${formatThreshold(detector, threshold)}`;
          const above = score != null && threshold != null && score >= threshold;
          return <div key={detector} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 sm:px-5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium"><b className="font-mono font-semibold" style={{ color: detectorColor(detector) }}>{detector}</b> <span className="font-normal text-muted">{meta?.name ?? "detector"}</span></p>
              <p className={`mt-0.5 text-xs ${above ? "text-danger" : "text-muted"}`}>{scoreText}</p>
            </div>
            <div className="text-right">
              <p className={`text-xs font-medium ${alert != null && alert <= timeMs ? "text-danger" : "text-muted"}`}>{alert != null ? `alert ${formatMs(alert)}` : "no alert"}</p>
              <p className="mt-0.5 text-xs text-muted">{outcome ? OUTCOMES[outcome.kind] ?? outcome.kind : ""}{outcome?.delayMs != null && ` · delay ${formatMs(outcome.delayMs)}`}</p>
            </div>
          </div>;
        })}
      </div>
    </section>
  );
}
