"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownRight, CircleHelp } from "lucide-react";

const models = {
  M2: { label: "Random forest", withFeatures: 91, withoutFeatures: 0 },
  M3: { label: "Gradient boosting", withFeatures: 91, withoutFeatures: 0 },
} as const;

export default function AblationChart() {
  const [model, setModel] = useState<keyof typeof models>("M2");
  const reduceMotion = useReducedMotion() ?? false;
  const selected = models[model];

  return (
    <figure className="relative overflow-hidden border-y border-border bg-[#0c0f16]">
      <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
        <div className="border-b border-border p-5 sm:p-8 lg:border-b-0 lg:border-r lg:p-10">
          <p className="lp-kicker"><span className="lp-kicker-line" />Ablation / held-out test</p>
          <h3 className="mt-5 max-w-[13ch] text-2xl font-semibold leading-tight tracking-[-0.04em] sm:text-3xl">What changes when syscall features leave?</h3>
          <p className="mt-4 text-sm leading-6 text-muted">Select a detector to compare its frozen feature configuration with the no-syscall ablation. The ablation model was retrained and its threshold was selected on validation.</p>
          <div role="group" aria-label="Choose detector model" className="mt-7 flex border-b border-border">
            {Object.keys(models).map((id) => {
              const key = id as keyof typeof models;
              return <button key={id} type="button" aria-pressed={model === key} onClick={() => setModel(key)} className={`min-h-11 border-b-2 px-4 font-mono text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${model === key ? "border-primary text-text" : "border-transparent text-muted hover:text-text"}`}>{id}<span className="ml-2 font-sans font-normal">{models[key].label}</span></button>;
            })}
          </div>
          <div className="mt-6 flex items-start gap-3 border-l border-secondary/50 pl-4">
            <CircleHelp aria-hidden="true" className="mt-0.5 shrink-0 text-secondary" size={16} />
            <p className="text-xs leading-5 text-muted">These are benchmark results on 91 held-out hangs. They do not guarantee the same performance on production workloads.</p>
          </div>
        </div>

        <div className="flex flex-col justify-center p-5 sm:p-8 lg:p-10" aria-live="polite" aria-atomic="true">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">Selected detector / {model}</p><p className="mt-1 text-lg font-semibold text-text">{selected.label}</p></div>
            <span className="font-mono text-[10px] text-muted">0 — 91 hangs detected</span>
          </div>
          {[
            { label: "Syscall features included", count: selected.withFeatures, color: "bg-secondary", text: "text-secondary" },
            { label: "Syscall features removed", count: selected.withoutFeatures, color: "bg-danger", text: "text-danger" },
          ].map((row, index) => (
            <div key={row.label} className="mb-7 last:mb-0">
              <div className="mb-3 flex items-center justify-between gap-3"><span className="text-sm text-muted">{row.label}</span><span className={`font-mono text-lg font-semibold ${row.text}`}>{row.count}<span className="text-sm text-muted"> / 91</span></span></div>
              <div className="relative h-9 border border-border bg-background">
                <div aria-hidden="true" className="absolute inset-0 grid grid-cols-6 divide-x divide-border/70">{Array.from({ length: 6 }, (_, i) => <span key={i} />)}</div>
                <motion.div
                  className={`relative z-10 h-full ${row.color}`}
                  initial={{ width: reduceMotion ? `${(row.count / 91) * 100}%` : 0 }}
                  whileInView={{ width: `${(row.count / 91) * 100}%` }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: reduceMotion ? 0 : 0.9, delay: reduceMotion ? 0 : index * 0.14, ease: [0.22, 1, 0.36, 1] }}
                  aria-hidden="true"
                />
              </div>
              <div className="mt-2 flex justify-between font-mono text-[9px] text-muted"><span>0</span><span>91</span></div>
            </div>
          ))}
          <div className="mt-8 flex items-center gap-2 border-t border-border pt-5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            <ArrowDownRight aria-hidden="true" className="text-danger" size={15} /> 91 / 91 → 0 / 91 when syscall features are removed
          </div>
        </div>
      </div>
      <table className="sr-only">
        <caption>Held-out test hang detections with and without syscall features. Both models detect 91 of 91 with features and 0 of 91 without.</caption>
        <thead><tr><th scope="col">Detector</th><th scope="col">With syscall features</th><th scope="col">Without syscall features</th></tr></thead>
        <tbody><tr><th scope="row">M2 random forest</th><td>91 of 91</td><td>0 of 91</td></tr><tr><th scope="row">M3 gradient boosting</th><td>91 of 91</td><td>0 of 91</td></tr></tbody>
      </table>
      <figcaption className="border-t border-border px-5 py-4 text-xs leading-5 text-muted sm:px-8">Ablation settings were selected using validation; the comparison reports held-out benchmark test results from <code className="font-mono text-text">results/phase4/ablation_table.md</code>.</figcaption>
    </figure>
  );
}
