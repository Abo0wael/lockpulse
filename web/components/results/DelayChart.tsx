"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ResultRow } from "@/lib/types";

export default function DelayChart({ rows }: { rows: ResultRow[] }) {
  const reduceMotion = useReducedMotion();
  const values = rows.filter((row) => row.delayMedianMs != null);
  const max = Math.max(1, ...values.map((row) => row.delayP90Ms ?? row.delayMedianMs ?? 1));

  return (
    <section className="h-full rounded-2xl border border-border bg-surface/80 p-5 shadow-lg shadow-black/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.18em] text-primary">RESPONSE TIME</p>
          <h2 className="mt-1 font-semibold">Detection delay</h2>
          <p className="mt-1 text-sm text-muted">Median to 90th percentile; shorter is faster.</p>
        </div>
        <span className="rounded-lg border border-border bg-background px-2.5 py-2 font-mono text-[10px] text-muted">ms</span>
      </div>
      <div className="mt-6 space-y-5">
        {values.map((row, index) => {
          const median = row.delayMedianMs ?? 0;
          const p90 = row.delayP90Ms ?? median;
          return (
            <div key={row.detector}>
              <div className="mb-2 flex justify-between gap-3 text-xs">
                <span><b className="mr-2 font-mono text-secondary">{row.detector}</b>{row.name}</span>
                <span className="font-mono tabular-nums text-muted">{median.toFixed(1)} / {p90.toFixed(1)}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-background" title={`${row.name}: median ${median.toFixed(1)} ms; p90 ${p90.toFixed(1)} ms`}>
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-secondary shadow-[0_0_14px_rgba(56,189,248,0.25)]"
                  initial={reduceMotion ? false : { width: 0 }}
                  animate={{ width: `${Math.max(1, (p90 / max) * 100)}%` }}
                  transition={{ duration: reduceMotion ? 0 : 0.65, delay: reduceMotion ? 0 : index * 0.08, ease: "easeOut" }}
                ><span className="sr-only">Median {median} milliseconds</span></motion.div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
