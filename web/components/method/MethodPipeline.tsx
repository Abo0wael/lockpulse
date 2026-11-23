"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Activity, ArrowRight, Database, GitBranch, Layers3, ScanLine } from "lucide-react";

export default function MethodPipeline() {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <figure className="lp-panel relative overflow-hidden rounded-2xl border border-border bg-surface">
      <figcaption className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
        <div><p className="lp-kicker text-secondary">System map / experiment flow</p><p className="mt-2 text-base font-semibold text-text">Two evidence paths, one held-out evaluation</p></div>
        <span className="font-mono text-[11px] text-muted">5 ms sampling · 13 families</span>
      </figcaption>
      <div className="grid gap-0 lg:grid-cols-[170px_1fr]">
        <div className="flex items-center gap-3 border-b border-border px-4 py-4 lg:border-b-0 lg:border-r sm:px-6"><span className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-surface text-muted"><Layers3 aria-hidden="true" size={18} /></span><div><p className="font-mono text-xs uppercase tracking-wider text-muted">Input</p><p className="mt-1 text-sm font-semibold text-text">Benchmark run</p></div></div>
        <div className="space-y-3 p-4 sm:p-6">
          <div className="grid gap-2 sm:grid-cols-[110px_1fr_auto_1fr] sm:items-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.07em] text-primary">Tier P / partial</p>
            <div className="flex min-h-12 items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.045] px-3"><Activity aria-hidden="true" size={16} className="shrink-0 text-primary" /><span className="text-sm text-text">/proc sampler · every 5 ms</span></div>
            <ArrowRight aria-hidden="true" size={14} className="hidden text-primary sm:block" />
            <div className="flex min-h-12 items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.045] px-3"><ScanLine aria-hidden="true" size={16} className="shrink-0 text-primary" /><span className="text-sm text-text">Features → rules + ML</span></div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[110px_1fr_auto_1fr] sm:items-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.07em] text-secondary">Tier F / full</p>
            <div className="flex min-h-12 items-center gap-3 rounded-xl border border-secondary/25 bg-secondary/[0.04] px-3"><Database aria-hidden="true" size={16} className="shrink-0 text-secondary" /><span className="text-sm text-text">LD_PRELOAD sync trace</span></div>
            <ArrowRight aria-hidden="true" size={14} className="hidden text-secondary sm:block" />
            <div className="flex min-h-12 items-center gap-3 rounded-xl border border-secondary/25 bg-secondary/[0.04] px-3"><GitBranch aria-hidden="true" size={16} className="shrink-0 text-secondary" /><span className="text-sm text-text">Ground-truth labels + B3 graph</span></div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[110px_1fr_auto_1fr] sm:items-center">
            <span className="hidden sm:block" />
            <span className="hidden sm:block" />
            <ArrowRight aria-hidden="true" size={14} className="hidden text-muted sm:block" />
            <div className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-surface px-3"><span className="grid h-7 w-7 place-items-center rounded-full border border-success/25 text-success"><CheckIcon /></span><span className="text-sm font-medium text-text">Frozen held-out evaluation</span></div>
          </div>
        </div>
      </div>
      <motion.div aria-hidden="true" className="absolute left-[176px] top-[83px] hidden h-px w-12 bg-primary/80 lg:block" initial={{ scaleX: 0, transformOrigin: "left" }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: reduceMotion ? 0 : 0.7 }} />
    </figure>
  );
}

function CheckIcon() {
  return <span className="h-1.5 w-1.5 rounded-full bg-success" />;
}
