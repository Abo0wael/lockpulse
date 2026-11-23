"use client";

import { useState } from "react";
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

const tiers = [
  { id: "P", name: "Partial process view", summary: "Sampled /proc telemetry · inputs to rules and ML", tone: "primary" },
  { id: "F", name: "Full synchronization trace", summary: "Trace-derived labels and baselines · never an ML input", tone: "secondary" },
] as const;

export default function DetectorOverview() {
  const [filter, setFilter] = useState<Filter>("all");
  const visibleTiers = tiers.filter((tier) => filter === "all" || filter === tier.id);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <p className="max-w-2xl text-sm leading-6 text-muted">Compare each detector by the evidence it reads and the signal it uses to decide.</p>
        <div role="group" aria-label="Filter detectors by telemetry tier" className="flex rounded-xl border border-border bg-surface/70 p-1">
          {([{ key: "all", label: "All detectors" }, { key: "P", label: "Tier P" }, { key: "F", label: "Tier F" }] as const).map((item) => (
            <button key={item.key} type="button" aria-pressed={filter === item.key} onClick={() => setFilter(item.key)} className={`min-h-10 rounded-lg px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${filter === item.key ? "bg-primary/15 text-text" : "text-muted hover:text-text"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid items-start gap-4 ${visibleTiers.length === 2 ? "lg:grid-cols-[1.45fr_1fr]" : "grid-cols-1"}`} aria-live="polite">
        {visibleTiers.map((tier) => {
          const entries = detectors.filter((detector) => detector.tier === tier.id);
          const isPartial = tier.id === "P";

          return (
            <section key={tier.id} aria-labelledby={`tier-${tier.id}-title`} className={`overflow-hidden rounded-2xl border ${isPartial ? "border-primary/25 bg-primary/[0.025]" : "border-secondary/25 bg-secondary/[0.02]"}`}>
              <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border/80 px-5 py-5 sm:px-6">
                <div>
                  <p className={`font-mono text-xs font-semibold uppercase tracking-[0.06em] ${isPartial ? "text-primary" : "text-secondary"}`}>Tier {tier.id}</p>
                  <h3 id={`tier-${tier.id}-title`} className="mt-2 text-xl font-semibold text-text">{tier.name}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">{tier.summary}</p>
                </div>
                <span className="rounded-full border border-border bg-surface/70 px-3 py-1 font-mono text-xs text-muted">{entries.length} detectors</span>
              </header>
              <ul className="divide-y divide-border/80">
                {entries.map((detector) => {
                  const Icon = detector.icon;
                  return (
                    <li key={detector.id} className="grid gap-x-4 gap-y-2 px-5 py-4 sm:grid-cols-[54px_minmax(0,1fr)] sm:px-6">
                      <span className={`flex items-center gap-2 font-mono text-sm font-semibold ${isPartial ? "text-primary" : "text-secondary"}`}><Icon aria-hidden="true" className="size-4 sm:hidden" />{detector.id}</span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <h4 className="text-base font-semibold text-text">{detector.method}</h4>
                          <span className="font-mono text-[11px] uppercase tracking-wide text-muted">{detector.family}</span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-muted">{detector.description}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="mt-4 text-sm leading-6 text-muted">ML inputs never include Tier F events. B3 uses the full synchronization trace and is a mutex-cycle baseline, not a general hang oracle.</p>
    </div>
  );
}
