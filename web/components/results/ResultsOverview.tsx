"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Activity, Clock3, Layers3, ShieldCheck } from "lucide-react";
import type { ResultRow } from "@/lib/types";
import { formatMs } from "@/lib/utils";

const icons = [Activity, ShieldCheck, Clock3, Layers3];

export default function ResultsOverview({ rows }: { rows: ResultRow[] }) {
  const reduceMotion = useReducedMotion();
  const main = rows.filter((r) => ["B2", "M2", "M3"].includes(r.detector));
  const hangs = main[0]?.hangRuns ?? 0;
  const detected = main.length ? Math.min(...main.map((r) => r.detected)) : 0;
  const falseAlarms = main.length ? Math.max(...main.map((r) => r.faHealthy)) : 0;
  const delays = main.map((r) => r.delayMedianMs).filter((v): v is number => v != null);
  const median = delays.length ? `${formatMs(Math.min(...delays))}–${formatMs(Math.max(...delays))}` : "—";
  const cards = [
    { label: "Held-out hangs detected", value: `${detected}/${hangs}`, detail: "B2 and frozen ML models" },
    { label: "False alarms", value: String(falseAlarms), detail: "Across held-out healthy runs" },
    { label: "Median detection delay", value: median, detail: "B2, M2 and M3" },
    { label: "Benchmark runs", value: String(rows.find((r) => r.scope === "overall")?.runs ?? "—"), detail: "Across all families" },
  ];

  return (
    <dl className="lp-results-metric-grid" aria-label="Summary benchmark metrics">
      {cards.map((card, index) => {
        const Icon = icons[index];
        return (
          <motion.div
            key={card.label}
            whileHover={reduceMotion ? undefined : { y: -2 }}
            transition={{ duration: 0.18 }}
            className={`group min-w-0 border-b border-border px-4 py-5 transition-colors hover:bg-elevated/45 sm:px-6 sm:py-6 xl:border-b-0 xl:border-r xl:px-7 ${index % 2 === 0 ? "border-r" : ""} ${index === 3 ? "xl:border-r-0" : ""}`}
          >
            <div className="flex items-center justify-between gap-3">
              <dt className="text-sm font-semibold leading-5 text-muted">{card.label}</dt>
              <Icon aria-hidden="true" size={17} className="shrink-0 text-secondary" />
            </div>
            <dd className="mt-5 lp-results-metric-value font-bold text-text">{card.value}</dd>
            <dd className="mt-3 text-sm leading-6 text-muted">{card.detail}</dd>
          </motion.div>
        );
      })}
    </dl>
  );
}
