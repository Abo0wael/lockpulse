import type { ResultRow } from "@/lib/types";
import { formatMs, formatPercent } from "@/lib/utils";

export default function DetectorComparison({ rows }: { rows: ResultRow[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface" aria-labelledby="detector-comparison-title">
      <div className="border-b border-border px-4 py-3 sm:px-5"><h2 id="detector-comparison-title" className="font-semibold">Overall detector comparison</h2><p className="mt-1 text-xs text-muted">Aggregate rows from the selected evaluation split.</p></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="bg-elevated text-muted"><tr>{["Detector", "Input", "Setting", "Detected", "Rate", "Median delay", "False alarms", "PR-AUC"].map((label) => <th key={label} scope="col" className="px-3 py-2.5 font-medium sm:px-4">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-border/70">
            {rows.map((row) => <tr key={`${row.detector}-${row.setting}`} className="hover:bg-elevated/50">
              <th scope="row" className="whitespace-nowrap px-3 py-3 font-mono font-semibold text-text sm:px-4">{row.detector}<span className="ml-1.5 font-sans font-normal text-muted">{row.name}</span></th>
              <td className="px-3 py-3 text-muted sm:px-4">{row.input}</td><td className="px-3 py-3 font-mono text-muted sm:px-4">{row.setting}</td>
              <td className="whitespace-nowrap px-3 py-3 font-mono text-text sm:px-4">{row.detected}/{row.hangRuns}</td><td className="px-3 py-3 font-mono text-text sm:px-4">{formatPercent(row.detectionRate)}</td>
              <td className="whitespace-nowrap px-3 py-3 font-mono text-muted sm:px-4">{formatMs(row.delayMedianMs, 1)}</td><td className="px-3 py-3 font-mono text-muted sm:px-4">{row.faHealthy}</td><td className="px-3 py-3 font-mono text-muted sm:px-4">{formatPercent(row.prAuc)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}
