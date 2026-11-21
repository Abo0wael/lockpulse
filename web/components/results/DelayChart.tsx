import type { ResultRow } from "@/lib/types";
import { formatMs } from "@/lib/utils";

export default function DelayChart({ rows }: { rows: ResultRow[] }) {
  const plotted = rows.filter((row) => row.delayMedianMs != null && row.detected > 0);
  const maxDelay = Math.max(1, ...plotted.map((row) => row.delayMedianMs ?? 0));
  return (
    <figure className="rounded-xl border border-border bg-surface p-4 sm:p-5" aria-labelledby="delay-chart-title">
      <h2 id="delay-chart-title" className="font-semibold">Median detection delay</h2>
      <p className="mt-1 text-xs text-muted">Configurations with a reported detection delay in the selected split.</p>
      {plotted.length === 0 ? <p className="mt-5 rounded-lg border border-dashed border-border p-4 text-sm text-muted">No detection delays are reported for this split.</p> : <div role="img" aria-label={`Median detection delay by detector across ${plotted.length} configurations`} className="mt-5 space-y-4">
        {plotted.map((row) => {
          const delay = row.delayMedianMs ?? 0;
          return <div key={`${row.detector}-${row.setting}`} className="grid grid-cols-[3.5rem_minmax(0,1fr)_4.5rem] items-center gap-3 text-xs">
            <span className="font-mono text-secondary">{row.detector}</span>
            <div className="h-2.5 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-gradient-to-r from-primary to-sky" style={{ width: `${Math.max(2, (delay / maxDelay) * 100)}%` }} /></div>
            <span className="text-right font-mono text-text">{formatMs(delay, 1)}</span>
          </div>;
        })}
      </div>}
      <figcaption className="mt-4 border-t border-border pt-3 text-[11px] leading-5 text-muted">Bars are scaled to the largest displayed median in this split. They represent exported benchmark measurements.</figcaption>
    </figure>
  );
}
