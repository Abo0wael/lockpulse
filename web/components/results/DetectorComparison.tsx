import type { ResultRow } from "@/lib/types";
import { formatMs, formatPercent } from "@/lib/utils";

const headings = ["Detector", "Input", "Setting", "Detected hangs", "Median delay", "False alarms", "PR-AUC"];

export default function DetectorComparison({ rows }: { rows: ResultRow[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface/80 shadow-xl shadow-black/10">
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-secondary">OVERALL COMPARISON</p>
        <h2 className="mt-1 font-semibold">Detector performance</h2>
        <p className="mt-1 text-sm text-muted">Overall results on the selected split. Family rows are available below.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-background/70 text-[10px] uppercase tracking-[0.14em] text-muted">
            <tr>{headings.map((heading) => <th key={heading} className="px-4 py-3 font-semibold first:pl-5 last:pr-5">{heading}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.detector}-${row.setting}`} className="border-t border-border/70 transition-colors hover:bg-black/[0.035]">
                <td className="px-4 py-3.5 font-semibold first:pl-5"><span className="mr-2 rounded-md border border-secondary/20 bg-secondary/5 px-2 py-1 font-mono text-xs text-secondary">{row.detector}</span>{row.name}</td>
                <td className="px-4 py-3.5 text-muted">{row.input}</td>
                <td className="px-4 py-3.5 font-mono text-xs text-muted">{row.setting}</td>
                <td className="px-4 py-3.5 tabular-nums">{row.detected}/{row.hangRuns} <span className="text-xs text-muted">({formatPercent(row.detectionRate)})</span></td>
                <td className="px-4 py-3.5 font-mono text-xs tabular-nums">{formatMs(row.delayMedianMs)}</td>
                <td className="px-4 py-3.5 tabular-nums">{row.faHealthy}</td>
                <td className="px-4 py-3.5 font-mono text-xs tabular-nums" title={row.prAuc == null ? "Not defined for this row" : `Precision-recall area: ${row.prAuc}`}>{row.prAuc?.toFixed(4) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
