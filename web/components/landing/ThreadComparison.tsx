"use client";

import { motion, useReducedMotion } from "framer-motion";

const workerSegments = [
  { label: "WORK", width: 20, tone: "bg-success/80 text-background" },
  { label: "NANOSLEEP", width: 34, tone: "bg-secondary/15 text-secondary" },
  { label: "WORK", width: 18, tone: "bg-success/80 text-background" },
  { label: "SLEEP", width: 28, tone: "bg-secondary/15 text-secondary" },
];

function CpuTrace({ healthy, reducedMotion }: { healthy: boolean; reducedMotion: boolean }) {
  return (
    <svg
      role="img"
      aria-label={healthy ? "Low CPU activity while a healthy worker alternates sleep and work" : "Low CPU activity during a persistent futex wait"}
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      className="h-12 w-full overflow-visible"
    >
      <path d="M0 21 H100" fill="none" stroke="var(--border-strong)" strokeWidth="0.7" strokeDasharray="2 2" />
      <motion.path
        d="M0 21 H100"
        fill="none"
        stroke="var(--secondary)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reducedMotion ? false : { pathLength: 0 }}
        whileInView={reducedMotion ? undefined : { pathLength: 1 }}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ duration: reducedMotion ? 0 : 1.1, ease: [0.2, 0.7, 0.2, 1] }}
      />
    </svg>
  );
}

export default function ThreadComparison() {
  const reducedMotion = useReducedMotion() ?? false;

  return (
    <figure className="lp-panel-interactive overflow-hidden rounded-2xl border border-border bg-surface" aria-labelledby="thread-comparison-title">
      <figcaption className="flex flex-col gap-2 border-b border-border px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-5">
        <div>
          <p className="lp-kicker">Same quiet CPU · different syscall context</p>
          <h3 id="thread-comparison-title" className="mt-2 text-xl font-semibold tracking-tight text-text sm:text-2xl">The thread state tells the story.</h3>
        </div>
        <p className="max-w-sm text-xs leading-5 text-muted sm:text-sm">Conceptual timelines, not exported benchmark traces.</p>
      </figcaption>

      <div className="grid lg:grid-cols-2">
        <article className="min-w-0 border-b border-border p-4 sm:p-6 lg:border-b-0 lg:border-r">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="font-mono text-[11px] font-medium tracking-[0.07em] text-success">HEALTHY WORKER</p><h4 className="mt-1 text-lg font-semibold text-text">Sleeps, then resumes</h4></div>
            <span className="rounded-full border border-success/25 bg-success/[0.07] px-2.5 py-1 font-mono text-[11px] text-success">PROGRESS CONTINUES</span>
          </header>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.1em] text-muted"><span>Thread state</span><span>0–400 ms</span></div>
            <div className="relative flex h-11 overflow-hidden rounded-md border border-border bg-background" aria-label="Worker alternates between work and nanosleep">
              {workerSegments.map((segment, index) => (
                <motion.div
                  key={`${segment.label}-${index}`}
                  className={`flex h-full shrink-0 items-center justify-center overflow-hidden px-1 font-mono text-[11px] font-medium tracking-[0.04em] sm:text-[11px] ${segment.tone}`}
                  style={{ width: `${segment.width}%`, transformOrigin: "left" }}
                  initial={reducedMotion ? false : { scaleX: 0 }}
                  whileInView={reducedMotion ? undefined : { scaleX: 1 }}
                  viewport={{ once: true, amount: 0.7 }}
                  transition={{ duration: reducedMotion ? 0 : 0.42, delay: reducedMotion ? 0 : index * 0.12, ease: [0.2, 0.7, 0.2, 1] }}
                >{segment.label}</motion.div>
              ))}
              {!reducedMotion && <motion.span aria-hidden="true" className="pointer-events-none absolute inset-y-0 z-10 w-px bg-text shadow-[0_0_12px_rgba(66,220,232,0.75)]" initial={{ left: "0%", opacity: 0 }} whileInView={{ left: "100%", opacity: [0, 1, 0] }} viewport={{ once: true, amount: 0.8 }} transition={{ duration: 2, delay: 0.5, ease: "linear" }} />}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-[5.25rem_minmax(0,1fr)] items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">CPU view</span>
            <CpuTrace healthy reducedMotion={reducedMotion} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">Syscall context</span>
            <span className="ml-auto rounded-md border border-secondary/25 bg-secondary/[0.06] px-2.5 py-1.5 font-mono text-[11px] text-secondary">nanosleep</span>
            <span className="rounded-md border border-success/25 bg-success/[0.06] px-2.5 py-1.5 text-[11px] font-medium text-success">returns to work</span>
          </div>
        </article>

        <article className="min-w-0 p-4 sm:p-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="font-mono text-[11px] font-medium tracking-[0.07em] text-danger">HUNG THREAD</p><h4 className="mt-1 text-lg font-semibold text-text">Wait persists</h4></div>
            <span className="rounded-full border border-danger/25 bg-danger/[0.07] px-2.5 py-1 font-mono text-[11px] text-danger">NO FORWARD PROGRESS</span>
          </header>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.1em] text-muted"><span>Thread state</span><span>0–400 ms</span></div>
            <div className="relative flex h-11 overflow-hidden rounded-md border border-danger/20 bg-danger/[0.045]" aria-label="Thread remains in a futex wait for the full interval">
              <motion.div
                className="flex h-full w-full items-center justify-center border-r border-danger/30 bg-danger/[0.12] font-mono text-[11px] font-medium tracking-[0.07em] text-danger"
                initial={reducedMotion ? false : { scaleX: 0 }}
                whileInView={reducedMotion ? undefined : { scaleX: 1 }}
                viewport={{ once: true, amount: 0.7 }}
                transition={{ duration: reducedMotion ? 0 : 0.8, delay: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
                style={{ transformOrigin: "left" }}
              >PERSISTENT FUTEX WAIT</motion.div>
              {!reducedMotion && <motion.span aria-hidden="true" className="pointer-events-none absolute inset-y-0 z-10 w-px bg-text shadow-[0_0_12px_rgba(255,94,124,0.75)]" initial={{ left: "0%", opacity: 0 }} whileInView={{ left: "100%", opacity: [0, 1, 0] }} viewport={{ once: true, amount: 0.8 }} transition={{ duration: 2, delay: 0.5, ease: "linear" }} />}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-[5.25rem_minmax(0,1fr)] items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">CPU view</span>
            <CpuTrace healthy={false} reducedMotion={reducedMotion} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">Syscall context</span>
            <span className="ml-auto rounded-md border border-danger/30 bg-danger/[0.07] px-2.5 py-1.5 font-mono text-[11px] text-danger">futex</span>
            <span className="rounded-md border border-border px-2.5 py-1.5 text-[11px] text-muted">wait remains</span>
          </div>
        </article>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border bg-elevated/35 px-4 py-3 text-xs leading-5 sm:px-6">
        <span className="font-semibold text-text">CPU inactivity alone is ambiguous.</span>
        <span className="text-muted">Syscall context helps distinguish a legitimate sleep from a persistent blocked wait.</span>
      </div>
    </figure>
  );
}
