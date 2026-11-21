"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BrainCircuit, GitBranch, Gauge, Radio } from "lucide-react";

const detectors = [
  { id: "B1", tier: "P", family: "Baseline rule", method: "CPU silence", description: "CPU time across live threads has not increased for the selected threshold.", icon: Gauge },
  { id: "B2", tier: "P", family: "Baseline rule", method: "Futex silence", description: "Every live thread remains in futex without a context switch for the threshold.", icon: Radio },
  { id: "B3", tier: "F", family: "Graph baseline", method: "Wait-for cycle", description: "Alerts when a mutex request closes a wait-for cycle; it cannot detect hangs without a mutex cycle.", icon: GitBranch },
  { id: "B4", tier: "F", family: "Baseline rule", method: "Progress watchdog", description: "Alerts after the configured interval without a Tier F progress event.", icon: Gauge },
  { id: "M1", tier: "P", family: "ML model", method: "Logistic regression", description: "A linear classifier over sampled Tier P feature windows.", icon: BrainCircuit },
  { id: "M2", tier: "P", family: "ML model", method: "Random forest", description: "An ensemble of decision trees over sampled Tier P feature windows.", icon: BrainCircuit },
  { id: "M3", tier: "P", family: "ML model", method: "Histogram gradient boosting", description: "A boosted tree model over sampled Tier P feature windows.", icon: BrainCircuit },
] as const;

type Filter = "all" | "P" | "F";

export default function DetectorOverview() {
  const [filter, setFilter] = useState<Filter>("all");
  const reduceMotion = useReducedMotion() ?? false;
  const visible = detectors.filter((detector) => filter === "all" || detector.tier === filter);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <p className="max-w-xl text-sm leading-6 text-muted">Tier P powers the sampled rules and all ML models. Tier F is reserved for trace-derived rules and the graph baseline.</p>
        <div role="group" aria-label="Filter detectors by telemetry tier" className="flex border border-border bg-surface/50 p-1">
          {([{ key: "all", label: "All" }, { key: "P", label: "Tier P" }, { key: "F", label: "Tier F" }] as const).map((item) => <button key={item.key} type="button" aria-pressed={filter === item.key} onClick={() => setFilter(item.key)} className={`min-h-9 px-3 font-mono text-[10px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${filter === item.key ? "bg-primary/15 text-text" : "text-muted hover:text-text"}`}>{item.label}</button>)}
        </div>
      </div>
      <div className="overflow-hidden border-y border-border">
        <div className="hidden grid-cols-[62px_90px_1.05fr_1fr_1.7fr] gap-4 bg-[#0c0f16] px-4 py-3 font-mono text-[9px] uppercase tracking-[0.14em] text-muted md:grid md:px-5"><span>ID</span><span>Source</span><span>Class</span><span>Detector</span><span>Decision signal</span></div>
        <div aria-live="polite" className="divide-y divide-border">
          {visible.map((detector, index) => {
            const Icon = detector.icon;
            const tierP = detector.tier === "P";
            return (
              <motion.article key={detector.id} initial={reduceMotion ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduceMotion ? 0 : 0.22, delay: reduceMotion ? 0 : index * 0.035 }} className="grid gap-3 px-4 py-4 transition-colors hover:bg-white/[0.02] sm:px-5 md:grid-cols-[62px_90px_1.05fr_1fr_1.7fr] md:items-center md:gap-4">
                <span className="flex items-center gap-2 font-mono text-xs font-semibold text-primary"><Icon aria-hidden="true" className="md:hidden" size={14} />{detector.id}</span>
                <span className={`w-fit border px-2 py-1 font-mono text-[9px] uppercase tracking-wider ${tierP ? "border-primary/25 bg-primary/[0.06] text-primary" : "border-secondary/25 bg-secondary/[0.06] text-secondary"}`}>Tier {detector.tier}</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">{detector.family}</span>
                <span className="text-sm font-semibold text-text">{detector.method}</span>
                <span className="text-xs leading-5 text-muted">{detector.description}</span>
              </motion.article>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-[10px] leading-5 text-muted">ML inputs never include Tier F events. B3 uses the full synchronization trace and is a mutex-cycle baseline, not a general hang oracle.</p>
    </div>
  );
}
