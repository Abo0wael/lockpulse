import type { ResultRow } from "@/lib/types";
import { formatMs, formatPercent } from "@/lib/utils";

export default function ResultsOverview({ rows }: { rows: ResultRow[] }) {
  const availableRates = rows.filter((row) => row.detectionRate != null);
  const bestRate = availableRates.reduce<ResultRow | undefined>((best, row) => !best || (row.detectionRate ?? -1) > (best.detectionRate ?? -1) ? row : best, undefined);
  const fastest = rows.filter((row) => row.delayMedianMs != null && row.detected > 0).reduce<ResultRow | undefined>((best, row) => !best || (row.delayMedianMs ?? Infinity) < (best.delayMedianMs ?? Infinity) ? row : best, undefined);
  const lowestFalseAlarms = rows.reduce<ResultRow | undefined>((best, row) => !best || row.faHealthy < best.faHealthy ? row : best, undefined);
  const cards = [
    { label: "Configurations", value: String(rows.length), detail: "aggregate detector rows" },
    { label: "Best observed rate", value: bestRate ? formatPercent(bestRate.detectionRate) : "—", detail: bestRate?.detector ?? "No rate reported" },
    { label: "Fewest healthy false alarms", value: lowestFalseAlarms ? String(lowestFalseAlarms.faHealthy) : "—", detail: lowestFalseAlarms?.detector ?? "No rows reported" },
    { label: "Fastest median delay", value: fastest ? formatMs(fastest.delayMedianMs, 1) : "—", detail: fastest?.detector ?? "No detection delay reported" },
  ];
  return (
    <section aria-label="Selected split summary" className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => <div key={card.label} className="bg-surface p-4 sm:p-5"><p className="text-xs font-medium text-muted">{card.label}</p><p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-text">{card.value}</p><p className="mt-1 text-xs text-secondary">{card.detail}</p></div>)}
    </section>
  );
}
