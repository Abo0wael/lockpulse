import type { RunData } from "@/lib/types";
import { formatMs } from "@/lib/utils";

interface DetectorPanelProps { run: RunData; timeMs: number }

export default function DetectorPanel({ run, timeMs }: DetectorPanelProps) {
  const names: Record<string, string> = {
    B1: "fixed timeout", B2: "futex silence", B3: "wait-for graph", B4: "progress watchdog",
    M1: "logistic regression", M2: "random forest", M3: "gradient boosting",
  };
  const detectorIds = Object.keys(run.outcomes);
  return (
    <section className="lp-panel-interactive overflow-hidden rounded-2xl border border-border bg-surface" aria-labelledby="detector-panel-title">
      <div className="border-b border-border px-4 py-3 sm:px-5"><h2 id="detector-panel-title" className="font-semibold">Detector signals</h2><p className="mt-1 text-xs text-muted">Scores and first alerts from the exported run.</p></div>
      <div className="max-h-80 divide-y divide-border/70 overflow-auto">
        {detectorIds.map((detector) => {
          const score = run.scores[detector]?.[run.tMs.findIndex((time) => time >= timeMs)];
          const threshold = run.thresholds[detector];
          const alert = run.alerts[detector];
          const outcome = run.outcomes[detector];
          return <div key={detector} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 sm:px-5">
            <div className="min-w-0"><p className="truncate text-sm font-medium">{detector} <span className="font-normal text-muted">{names[detector] ?? "detector"}</span></p><p className="mt-0.5 text-xs text-muted">{score == null ? "No per-tick score exported" : `Score ${score.toFixed(4)}${threshold == null ? "" : ` · threshold ${threshold.toFixed(4)}`}`}</p></div>
            <div className="text-right"><p className={`text-xs font-medium ${alert != null && alert <= timeMs ? "text-danger" : "text-muted"}`}>{alert != null ? `Alert ${formatMs(alert, 1)}` : outcome?.kind ?? "No alert"}</p>{outcome?.delayMs != null && <p className="mt-0.5 text-[11px] text-muted">delay {formatMs(outcome.delayMs, 1)}</p>}</div>
          </div>;
        })}
      </div>
    </section>
  );
}
