"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CircleCheck, OctagonAlert } from "lucide-react";

const groups = [
  {
    name: "Train",
    note: "Fit model weights",
    runs: "359 runs",
    hue: "text-primary",
    hang: ["two_lock_inversion", "lost_wakeup", "prodcons_missing_signal"],
    healthy: ["high_contention", "long_critical_section", "consistent_lock_order"],
  },
  {
    name: "Validation",
    note: "Choose windows & thresholds",
    runs: "240 runs",
    hue: "text-secondary",
    hang: ["three_thread_cycle", "barrier_mismatch"],
    healthy: ["prodcons_correct", "sleeping_workers"],
  },
  {
    name: "Held-out test",
    note: "Final evaluation only",
    runs: "180 runs",
    hue: "text-success",
    hang: ["dining_philosophers", "sem_never_posted"],
    healthy: ["blocked_on_io"],
  },
] as const;

export default function BenchmarkFamilies() {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <div>
      <div className="grid border-y border-border lg:grid-cols-3">
        {groups.map((group, index) => (
          <motion.section key={group.name} initial={reduceMotion ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: reduceMotion ? 0 : 0.36, delay: reduceMotion ? 0 : index * 0.08 }} className={`relative min-w-0 px-4 py-6 sm:px-6 sm:py-7 ${index > 0 ? "border-t border-border lg:border-l lg:border-t-0" : ""}`}>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-35" />
            <div className="flex items-start justify-between gap-3">
              <div><p className={`font-mono text-[10px] uppercase tracking-[0.18em] ${group.hue}`}>0{index + 1} / {group.name}</p><h3 className="mt-2 text-base font-semibold text-text">{group.note}</h3></div>
              <span className="shrink-0 font-mono text-[10px] text-muted">{group.runs}</span>
            </div>
            <div className="mt-6 space-y-5">
              <div><p className="mb-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.13em] text-danger"><OctagonAlert aria-hidden="true" size={12} />Hang families</p><ul className="space-y-1.5">{group.hang.map((family) => <li key={family} className="font-mono text-[11px] leading-5 text-text/85">{family}</li>)}</ul></div>
              <div className="border-t border-border pt-4"><p className="mb-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.13em] text-success"><CircleCheck aria-hidden="true" size={12} />Healthy hard negatives</p><ul className="space-y-1.5">{group.healthy.map((family) => <li key={family} className="font-mono text-[11px] leading-5 text-muted">{family}</li>)}</ul></div>
            </div>
            {index < groups.length - 1 && <ArrowRight aria-hidden="true" className="absolute -right-2.5 top-1/2 z-10 hidden bg-background text-muted lg:block" size={15} />}
          </motion.section>
        ))}
      </div>
      <div className="flex flex-col gap-2 border-b border-border bg-surface/40 px-4 py-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>13 families · 4 configurations × 15 seeds; hang families force c1–c3, c4 is scheduler-dependent</span>
        <span className="font-mono text-text">780 collected · 779 analyzed · 1 ambiguous excluded</span>
      </div>
      <p className="mt-3 text-[10px] leading-5 text-muted">The split is by family. Test scenarios are kept separate from model fitting and validation.</p>
    </div>
  );
}
