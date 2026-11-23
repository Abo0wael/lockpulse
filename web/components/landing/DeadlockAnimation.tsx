"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Activity, AlertTriangle, LockKeyhole } from "lucide-react";

type GraphEdge = {
  id: string;
  d: string;
  start: [number, number];
  end: [number, number];
  kind: "wait" | "ownership";
  beginsAt: number;
};

const edges: GraphEdge[] = [
  { id: "ownership-a", d: "M24 61 L24 39", start: [24, 61], end: [24, 39], kind: "ownership", beginsAt: 1 },
  { id: "ownership-b", d: "M76 39 L76 61", start: [76, 39], end: [76, 61], kind: "ownership", beginsAt: 2 },
  { id: "wait-a", d: "M43 24 L57 24", start: [43, 24], end: [57, 24], kind: "wait", beginsAt: 3 },
  { id: "wait-b", d: "M57 76 L43 76", start: [57, 76], end: [43, 76], kind: "wait", beginsAt: 4 },
];

const steps = [
  { label: "Acquire Lock A", actor: "THREAD A" },
  { label: "Acquire Lock B", actor: "THREAD B" },
  { label: "Request Lock B", actor: "THREAD A" },
  { label: "Request Lock A", actor: "THREAD B" },
];

const pulseTiming: Record<string, { delay: number; duration: number }> = {
  "ownership-a": { delay: 0, duration: 0.82 },
  "wait-a": { delay: 0.82, duration: 0.62 },
  "ownership-b": { delay: 1.44, duration: 0.82 },
  "wait-b": { delay: 2.26, duration: 0.62 },
};
const pulseCycleDuration = 2.88;

function ThreadNode({
  label,
  isWaiting,
  holdsLock,
  pulseActive,
  reduceMotion,
}: {
  label: string;
  isWaiting: boolean;
  holdsLock: boolean;
  pulseActive: boolean;
  reduceMotion: boolean;
}) {
  const description = isWaiting ? "BLOCKED · FUTEX" : holdsLock ? "RUNNING · LOCK HELD" : "RUNNING · MAKING PROGRESS";

  return (
    <motion.div
      animate={{ borderColor: isWaiting ? "rgb(255 94 124 / 58%)" : holdsLock ? "rgb(69 212 131 / 42%)" : "var(--border)" }}
      transition={{ duration: reduceMotion ? 0 : 0.35 }}
      className="relative z-10 flex min-h-[108px] min-w-0 flex-col justify-between rounded-2xl border bg-elevated/95 p-4 shadow-[0_12px_28px_rgba(0,0,0,0.2)] sm:min-h-[120px] sm:p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-medium tracking-[0.06em] text-muted sm:text-[13px]">{label}</span>
        <motion.span
          aria-hidden="true"
          className={`size-2 rounded-full ${isWaiting ? "bg-danger" : "bg-success"}`}
          animate={!reduceMotion && pulseActive && isWaiting ? { opacity: [0.55, 1, 0.55], scale: [0.9, 1.15, 0.9] } : { opacity: 1, scale: 1 }}
          transition={isWaiting && pulseActive && !reduceMotion ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
        />
      </div>
      <div className="min-w-0">
        <p className="text-base font-semibold tracking-tight text-text sm:text-lg">{isWaiting ? "Waiting on a lock" : "Worker thread"}</p>
        <p className={`mt-1.5 font-mono text-xs font-medium tracking-[0.06em] sm:text-[13px] ${isWaiting ? "text-danger" : "text-success"}`}>
          <span className="sr-only">Status: </span>{description}
        </p>
      </div>
    </motion.div>
  );
}

function LockNode({ label, owner }: { label: string; owner: string | null }) {
  return (
    <motion.div
      animate={{ borderColor: owner ? "rgb(66 220 232 / 45%)" : "var(--border)" }}
      transition={{ duration: 0.35 }}
      className="relative z-10 flex min-h-[108px] min-w-0 flex-col justify-between rounded-2xl border bg-surface-high/95 p-4 shadow-[0_12px_28px_rgba(0,0,0,0.2)] sm:min-h-[120px] sm:p-5"
    >
      <div className="flex items-center gap-2 text-secondary">
        <LockKeyhole aria-hidden="true" size={15} />
        <span className="font-mono text-xs font-medium tracking-[0.06em] sm:text-[13px]">RESOURCE</span>
      </div>
      <div className="min-w-0">
        <p className="text-base font-semibold tracking-tight text-text sm:text-lg">{label}</p>
        <p className={`mt-1.5 font-mono text-xs tracking-[0.06em] sm:text-[13px] ${owner ? "text-secondary" : "text-muted"}`}>
          {owner ? `HELD BY ${owner}` : "AVAILABLE"}
        </p>
      </div>
    </motion.div>
  );
}

export default function DeadlockAnimation() {
  const graphRef = useRef<HTMLDivElement>(null);
  const inView = useInView(graphRef, { amount: 0.2 });
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!inView || prefersReducedMotion) return;

    let stageTimers: ReturnType<typeof setTimeout>[] = [];
    const runSequence = () => {
      stageTimers.forEach(clearTimeout);
      setPhase(0);
      stageTimers = [
        setTimeout(() => setPhase(1), 700),
        setTimeout(() => setPhase(2), 1450),
        setTimeout(() => setPhase(3), 2200),
        setTimeout(() => setPhase(4), 2950),
        setTimeout(() => setPhase(5), 3900),
      ];
    };

    const start = setTimeout(runSequence, 0);
    const cycle = setInterval(runSequence, 8500);
    return () => {
      clearTimeout(start);
      clearInterval(cycle);
      stageTimers.forEach(clearTimeout);
    };
  }, [inView, prefersReducedMotion]);

  const visiblePhase = prefersReducedMotion ? 5 : phase;
  const cycleFound = visiblePhase >= 4;
  const alertRaised = visiblePhase >= 5;
  const phaseLabel = alertRaised ? "ALERT RAISED" : cycleFound ? "CIRCULAR WAIT" : "TRACE IN PROGRESS";

  return (
    <section
      aria-label="Illustrative simulation of two threads forming a mutex deadlock cycle"
      className="lp-panel lp-wait-graph-card relative overflow-hidden rounded-2xl bg-surface"
    >
      <div aria-hidden="true" className="lp-grid-field pointer-events-none absolute inset-0 opacity-35" />
      <div className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full bg-primary/[0.08] blur-3xl" aria-hidden="true" />

      <header className="relative flex flex-wrap items-center justify-between gap-3 border-b border-border/90 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-secondary/25 bg-secondary/[0.08] text-secondary">
            <Activity aria-hidden="true" size={19} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-text sm:text-lg">Wait-for graph</h2>
            <p className="mt-1 font-mono text-xs uppercase tracking-[0.06em] text-muted">Illustrative simulation · not host data</p>
          </div>
        </div>
        <span className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 py-1 font-mono text-xs font-semibold tracking-[0.06em] ${alertRaised ? "border-danger/40 bg-danger/[0.1] text-danger" : cycleFound ? "border-warning/35 bg-warning/[0.08] text-warning" : "border-secondary/30 bg-secondary/[0.07] text-secondary"}`}>
          {alertRaised ? <AlertTriangle aria-hidden="true" size={13} /> : <span aria-hidden="true" className={`size-1.5 rounded-full ${cycleFound ? "bg-warning" : "bg-secondary"}`} />}
          {phaseLabel}
        </span>
      </header>

      <div ref={graphRef} className="relative px-3 py-5 sm:px-6 sm:py-7">
        <div className="relative mx-auto grid h-[292px] max-w-[760px] grid-cols-2 grid-rows-2 gap-x-5 gap-y-16 sm:h-[330px] sm:gap-x-20 sm:gap-y-20 lg:h-[360px] lg:gap-x-28 lg:gap-y-24">
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <marker id="wait-arrow" markerWidth="6" markerHeight="6" refX="4.5" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L6,3 L0,6 z" fill="var(--danger)" /></marker>
              <marker id="owner-arrow" markerWidth="6" markerHeight="6" refX="4.5" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L6,3 L0,6 z" fill="var(--secondary)" /></marker>
            </defs>
            {cycleFound && <motion.path d="M24 61 L24 39 L43 24 L57 24 L76 39 L76 61 L57 76 L43 76 Z" fill="none" stroke="var(--danger)" strokeWidth="0.35" strokeDasharray="1 2" initial={{ opacity: 0 }} animate={alertRaised && inView && !prefersReducedMotion ? { opacity: [0.35, 0.7, 0.35] } : { opacity: 0.45 }} transition={{ duration: prefersReducedMotion ? 0 : 1.4, repeat: alertRaised && inView && !prefersReducedMotion ? Infinity : 0, ease: "easeInOut" }} />}
            {edges.map((edge, index) => {
              const active = visiblePhase >= edge.beginsAt;
              const stroke = edge.kind === "wait" ? "var(--danger)" : "var(--secondary)";
              const pulse = pulseTiming[edge.id];
              return (
                <g key={edge.id}>
                  <motion.path
                    d={edge.d}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={cycleFound && edge.kind === "wait" ? 1.15 : 0.8}
                    strokeDasharray={edge.kind === "wait" ? "2 1.5" : undefined}
                    markerEnd={edge.kind === "wait" ? "url(#wait-arrow)" : "url(#owner-arrow)"}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: active ? 1 : 0, opacity: active ? 1 : 0 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.55, ease: [0.2, 0.7, 0.2, 1] }}
                  />
                  {active && !prefersReducedMotion && inView && (
                    <motion.circle
                      key={`${edge.id}-${cycleFound ? "cycle" : "trace"}`}
                      r={cycleFound ? "1.2" : "1.05"}
                      fill={edge.kind === "wait" ? "var(--danger)" : "var(--secondary)"}
                      initial={{ cx: edge.start[0], cy: edge.start[1], opacity: 0 }}
                      animate={{ cx: [edge.start[0], edge.end[0]], cy: [edge.start[1], edge.end[1]], opacity: [0, 1, 1, 0] }}
                      transition={cycleFound
                        ? { duration: pulse.duration, delay: pulse.delay, repeat: Infinity, repeatDelay: pulseCycleDuration - pulse.duration, ease: "linear" }
                        : { duration: 1.05, delay: index * 0.12, repeat: Infinity, repeatDelay: 0.45, ease: "linear" }}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          <ThreadNode label="THREAD A" isWaiting={visiblePhase >= 3} holdsLock={visiblePhase >= 1} pulseActive={inView} reduceMotion={prefersReducedMotion} />
          <LockNode label="Lock B" owner={visiblePhase >= 2 ? "THREAD B" : null} />
          <LockNode label="Lock A" owner={visiblePhase >= 1 ? "THREAD A" : null} />
          <ThreadNode label="THREAD B" isWaiting={visiblePhase >= 4} holdsLock={visiblePhase >= 2} pulseActive={inView} reduceMotion={prefersReducedMotion} />
        </div>

        <div className="relative mx-auto mt-3 max-w-[760px]">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4 sm:gap-3" aria-label="Deadlock formation sequence">
            {steps.map((step, index) => {
              const complete = visiblePhase >= index + 1;
              return (
                <div key={step.label} className={`min-w-0 border-t px-1 pt-2.5 sm:px-2 ${complete ? "border-secondary/65" : "border-border"}`}>
                  <p className={`font-mono text-xs tracking-[0.05em] ${complete ? "text-secondary" : "text-muted/70"}`}>0{index + 1} · {step.actor}</p>
                  <p className={`mt-1 min-h-10 text-sm font-medium leading-5 ${complete ? "text-text" : "text-muted"}`}>{step.label}</p>
                </div>
              );
            })}
          </div>
          <div className={`mt-4 flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 py-2.5 transition-colors ${alertRaised ? "border-danger/35 bg-danger/[0.07]" : "border-border/80 bg-background/60"}`} role="status" aria-live="polite">
            <span className="font-mono text-xs uppercase tracking-[0.05em] text-muted">{alertRaised ? "B3 · wait-for cycle" : cycleFound ? "Circular wait formed" : "Replay sequence"}</span>
            <span className={`text-right text-xs font-medium sm:text-sm ${alertRaised ? "text-danger" : "text-muted"}`}>
              {alertRaised ? "DEADLOCK ALERT" : phase >= 4 ? "Each thread waits on the other" : "Locks and waits appear in sequence"}
            </span>
          </div>
        </div>
      </div>

      <footer className="relative flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border px-4 py-3.5 font-mono text-xs uppercase tracking-[0.06em] text-muted sm:px-6">
        <span className="inline-flex items-center gap-2"><span className="h-0.5 w-5 border-t border-dashed border-danger" />Waiting relationship</span>
        <span className="inline-flex items-center gap-2"><span className="h-0.5 w-5 bg-secondary" />Ownership relationship</span>
        <span className="ml-auto text-muted/75">Illustration only · no host monitoring</span>
      </footer>
    </section>
  );
}
