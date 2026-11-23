"use client";

import { CircleCheck, OctagonAlert } from "lucide-react";

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
  return (
    <div>
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        {groups.map((group, index) => (
          <section key={group.name} className="lp-panel relative min-w-0 overflow-hidden rounded-2xl p-5 sm:p-6">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-35" />
            <div className="flex items-start justify-between gap-3">
              <div><p className={`text-sm font-semibold ${group.hue}`}>0{index + 1} / {group.name}</p><h3 className="mt-2 text-xl font-semibold text-text">{group.note}</h3></div>
              <span className="shrink-0 font-mono text-xs text-muted">{group.runs}</span>
            </div>
            <div className="mt-6 space-y-5">
              <div><p className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.04em] text-danger"><OctagonAlert aria-hidden="true" size={14} />Hang families</p><ul className="space-y-1.5">{group.hang.map((family) => <li key={family} className="break-all font-mono text-xs leading-5 text-text/85">{family}</li>)}</ul></div>
              <div className="border-t border-border pt-4"><p className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.04em] text-success"><CircleCheck aria-hidden="true" size={14} />Healthy hard negatives</p><ul className="space-y-1.5">{group.healthy.map((family) => <li key={family} className="break-all font-mono text-xs leading-5 text-muted">{family}</li>)}</ul></div>
            </div>
          </section>
        ))}
      </div>
      <div className="flex flex-col gap-2 border-b border-border bg-surface/40 px-4 py-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>13 families · 4 configurations × 15 seeds; hang families force c1–c3, c4 is scheduler-dependent</span>
        <span className="font-mono text-xs text-text">780 collected · 779 analyzed · 1 ambiguous excluded</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">The split is by family. Test scenarios are kept separate from model fitting and validation.</p>
    </div>
  );
}
