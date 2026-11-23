"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Activity, Moon, Pause } from "lucide-react";

type Scenario = "sleeping" | "hanging";

const timelines: Record<Scenario, { label: string; states: string[]; cpu: boolean[] }> = {
  sleeping: { label: "Healthy worker", states: ["RUN", "SLEEP", "SLEEP", "RUN", "SLEEP", "RUN"], cpu: [true, false, false, true, false, true] },
  hanging: { label: "Hung worker", states: ["FUTEX", "FUTEX", "FUTEX", "FUTEX", "FUTEX", "FUTEX"], cpu: [false, false, false, false, false, false] },
};

function TimelineRow({ type, selected, reduceMotion }: { type: Scenario; selected: boolean; reduceMotion: boolean }) {
  const item = timelines[type];
  const healthy = type === "sleeping";
  return (
    <motion.article
      layout={!reduceMotion}
      animate={{ opacity: selected ? 1 : 0.58, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.28, ease: "easeOut" }}
      className={`lp-panel-interactive relative min-w-0 rounded-2xl border p-4 sm:p-5 ${healthy ? "border-secondary/25" : "border-danger/25"} ${selected ? healthy ? "bg-secondary/[0.06]" : "bg-danger/[0.05]" : "bg-surface/60"}`}
      aria-label={`${item.label} conceptual timeline`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`grid size-10 place-items-center rounded-xl border ${healthy ? "border-secondary/30 bg-secondary/10 text-secondary" : "border-danger/30 bg-danger/10 text-danger"}`}>
            {healthy ? <Moon aria-hidden="true" size={16} /> : <Pause aria-hidden="true" size={16} />}
          </span>
          <div><p className="text-sm font-semibold text-text">{item.label}</p><p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-muted">{healthy ? "nanosleep · work resumes" : "futex · no progress"}</p></div>
        </div>
        <span className={`font-mono text-[11px] uppercase tracking-widest ${healthy ? "text-secondary" : "text-danger"}`}>{healthy ? "Healthy pause" : "Persistent wait"}</span>
      </div>

      <div className="mt-5 grid grid-cols-6 overflow-hidden rounded-xl border border-border bg-background" aria-hidden="true">
        {item.states.map((state, index) => (
          <motion.div
            key={`${type}-${index}`}
            initial={false}
            animate={{ opacity: selected ? 1 : 0.7, scaleY: selected && healthy && state === "RUN" && !reduceMotion ? [1, 1.08, 1] : 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.55, delay: reduceMotion ? 0 : index * 0.045, repeat: reduceMotion || !selected || !healthy || state !== "RUN" ? 0 : Infinity, repeatDelay: 1.1 }}
            className={`flex min-h-[58px] flex-col items-center justify-center border-r border-border/80 font-mono text-[11px] font-semibold tracking-wide last:border-r-0 sm:min-h-[68px] sm:text-xs ${state === "RUN" ? "bg-success/[0.09] text-success" : state === "SLEEP" ? "bg-secondary/[0.07] text-secondary" : "bg-danger/[0.07] text-danger"}`}
          >
            <span>{state}</span><span className="mt-1 text-[11px] text-muted/75">t{index + 1}</span>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="w-16 shrink-0 font-mono text-[11px] uppercase tracking-wider text-muted">CPU work</span>
        <div className="grid flex-1 grid-cols-6 gap-1.5 sm:gap-2" aria-hidden="true">
          {item.cpu.map((active, index) => <span key={`${type}-cpu-${index}`} className={`h-1.5 ${active ? "bg-success/80" : "bg-border"}`} />)}
        </div>
        <span className="w-[72px] text-right font-mono text-[11px] text-muted">{healthy ? "resumes" : "stalled"}</span>
      </div>
    </motion.article>
  );
}

export default function SyscallComparison() {
  const [scenario, setScenario] = useState<Scenario>("sleeping");
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <section aria-labelledby="sleeping-vs-hanging" className="relative lp-container py-16 sm:py-20 lg:py-24">
      <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-end lg:gap-14">
        <div>
          <p className="lp-kicker">The ambiguity / 01</p>
          <h2 id="sleeping-vs-hanging" className="lp-section-heading mt-5 max-w-[12ch]">Same silence. <span className="text-secondary">Different state.</span></h2>
        </div>
        <p className="lp-copy-lead max-w-2xl">CPU inactivity only says that threads are not using processor time. It cannot tell whether a worker is taking a planned pause or is unable to make progress. Select a scenario to inspect its conceptual sampled timeline.</p>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface/65 p-3 sm:px-5 sm:py-4">
        <div className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.06em] text-muted"><Activity aria-hidden="true" size={15} className="text-secondary" /> Illustrative thread trace</div>
        <div role="group" aria-label="Choose thread scenario" className="inline-flex rounded-xl border border-border bg-background/70 p-1">
          {(["sleeping", "hanging"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={scenario === value}
              onClick={() => setScenario(value)}
              className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary sm:px-5 ${scenario === value ? value === "sleeping" ? "bg-secondary/10 text-secondary" : "bg-danger/10 text-danger" : "text-muted hover:text-text"}`}
            >
              {value === "sleeping" ? "Sleeping worker" : "Hanging worker"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid min-w-0 gap-3">
          {(["sleeping", "hanging"] as const).map((type) => <TimelineRow key={type} type={type} selected={scenario === type} reduceMotion={reduceMotion} />)}
        </div>

        <aside className="lp-panel-interactive flex flex-col justify-center rounded-2xl border border-border bg-surface/80 p-5 sm:p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.07em] text-muted">CPU-only observation</p>
          <div className="mt-4 flex items-end gap-1.5" aria-label="Both scenarios have low CPU activity">
            {[12, 8, 10, 7, 9, 8, 11, 7, 9, 8, 10, 6].map((height, index) => <span key={index} className="w-full bg-muted/40" style={{ height }} aria-hidden="true" />)}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[11px] text-muted"><span>sleeping: quiet</span><span>hang: quiet</span></div>
          <div className="my-5 h-px bg-border" />
          <p className="font-mono text-[11px] uppercase tracking-[0.07em] text-secondary">Tier P context</p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={scenario} initial={reduceMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -5 }} transition={{ duration: reduceMotion ? 0 : 0.2 }}>
              <p className={`mt-2 font-mono text-lg font-semibold ${scenario === "sleeping" ? "text-secondary" : "text-danger"}`}>{scenario === "sleeping" ? "nanosleep" : "futex"}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{scenario === "sleeping" ? "A planned wait; work returns." : "A blocked wait persists without progress."}</p>
            </motion.div>
          </AnimatePresence>
          <p className="mt-5 text-[11px] leading-4 text-muted/80">Conceptual illustration only; these are not individual exported benchmark traces.</p>
        </aside>
      </div>
    </section>
  );
}
