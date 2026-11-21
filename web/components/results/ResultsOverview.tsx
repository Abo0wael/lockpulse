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
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card, index) => {
        const Icon = icons[index];
        return (
          <motion.article
            key={card.label}
            whileHover={reduceMotion ? undefined : { y: -4 }}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
            className="group relative overflow-hidden rounded-2xl border border-border bg-surface/80 p-5 shadow-lg shadow-black/10"
          >
            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-secondary/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted">{card.label}</p>
                <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-text sm:text-3xl">{card.value}</p>
              </div>
              <span className="rounded-xl border border-border bg-background p-2.5 text-secondary transition-colors group-hover:border-secondary/30 group-hover:bg-secondary/5"><Icon aria-hidden="true" size={18} /></span>
            </div>
            <p className="mt-3 border-t border-border pt-3 text-xs text-muted">{card.detail}</p>
          </motion.article>
        );
      })}
    </div>
  );
}
