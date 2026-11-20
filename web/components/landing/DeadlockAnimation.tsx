"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Activity, LockKeyhole } from "lucide-react";

const pulseEdges = [
  { x: [43, 57], y: [24, 24] },
  { x: [76, 76], y: [39, 61] },
  { x: [57, 43], y: [76, 76] },
  { x: [24, 24], y: [61, 39] },
] as const;

function ThreadNode({ label, lock, reduceMotion }: { label: string; lock: string; reduceMotion: boolean }) {
  return (
    <div className="relative z-10 flex min-h-[92px] flex-col justify-between border border-danger/20 bg-[#111520]/95 p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <motion.span className="h-1.5 w-1.5 rounded-full bg-danger" animate={reduceMotion ? undefined : { opacity: [0.5, 1, 0.5], scale: [1, 1.25, 1] }} transition={reduceMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted sm:text-xs">{label}</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-text sm:text-base">{lock}</p>
        <p className="mt-1 font-mono text-[10px] text-danger sm:text-xs">BLOCKED · futex</p>
      </div>
    </div>
  );
}

function LockNode({ label, owner }: { label: string; owner: string }) {
  return (
    <div className="relative z-10 flex min-h-[92px] flex-col justify-between border border-secondary/20 bg-[#101721]/95 p-3 sm:p-4">
      <div className="flex items-center gap-2 text-secondary">
        <LockKeyhole aria-hidden="true" size={15} />
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] sm:text-xs">RESOURCE</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-text sm:text-base">{label}</p>
        <p className="mt-1 font-mono text-[10px] text-secondary sm:text-xs">HELD BY {owner}</p>
      </div>
    </div>
  );
}

export default function DeadlockAnimation() {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <section
      aria-label="Illustrative two-thread deadlock: Thread A holds Lock A and waits for Lock B; Thread B holds Lock B and waits for Lock A."
      className="lp-panel relative overflow-hidden rounded-sm bg-[#0c0f16]"
    >
      <div aria-hidden="true" className="lp-grid-field pointer-events-none absolute inset-0 opacity-70" />
      <header className="relative flex items-center justify-between border-b border-border/80 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="border border-primary/25 bg-primary/[0.08] p-2 text-primary"><Activity aria-hidden="true" size={17} /></span>
          <div>
            <p className="text-sm font-semibold tracking-tight">Wait-for graph</p>
            <p className="mt-0.5 font-mono text-[10px] tracking-wide text-muted">ILLUSTRATIVE DEADLOCK TRACE</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-danger/25 bg-danger/10 px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-wide text-danger sm:px-3 sm:text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-danger" /> CYCLE FOUND
        </span>
      </header>

      <div className="relative px-4 py-6 sm:px-6 sm:py-7">
        <div className="relative grid h-[290px] grid-cols-2 grid-rows-2 gap-x-8 gap-y-20 sm:h-[340px] sm:gap-x-16 sm:gap-y-24 lg:h-[380px] lg:gap-x-24 lg:gap-y-28">
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <marker id="wait-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L5,2.5 L0,5 z" fill="var(--danger)" /></marker>
              <marker id="hold-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L5,2.5 L0,5 z" fill="var(--secondary)" /></marker>
            </defs>
            <path d="M43 24 C48 17 52 17 57 24" fill="none" stroke="var(--danger)" strokeWidth="0.65" strokeDasharray="1.5 1.5" markerEnd="url(#wait-arrow)" />
            <path d="M76 39 C82 47 82 53 76 61" fill="none" stroke="var(--secondary)" strokeWidth="0.65" markerEnd="url(#hold-arrow)" />
            <path d="M57 76 C52 83 48 83 43 76" fill="none" stroke="var(--danger)" strokeWidth="0.65" strokeDasharray="1.5 1.5" markerEnd="url(#wait-arrow)" />
            <path d="M24 61 C18 53 18 47 24 39" fill="none" stroke="var(--secondary)" strokeWidth="0.65" markerEnd="url(#hold-arrow)" />
            {pulseEdges.map((edge, index) => (
              <motion.circle
                key={index}
                r="1.25"
                fill="var(--text)"
                initial={{ cx: edge.x[0], cy: edge.y[0], opacity: 0 }}
                animate={reduceMotion ? undefined : {
                  cx: edge.x,
                  cy: edge.y,
                  opacity: [0, 1, 1, 0],
                }}
                transition={reduceMotion ? undefined : {
                  cx: { duration: 0.82, delay: index * 0.88, repeat: Infinity, repeatDelay: 2.7, ease: "linear" },
                  cy: { duration: 0.82, delay: index * 0.88, repeat: Infinity, repeatDelay: 2.7, ease: "linear" },
                  opacity: { duration: 0.82, times: [0, 0.15, 0.78, 1], delay: index * 0.88, repeat: Infinity, repeatDelay: 2.7, ease: "linear" },
                }}
              />
            ))}
          </svg>

          <ThreadNode label="Thread A" lock="Waiting for Lock B" reduceMotion={reduceMotion} />
          <LockNode label="Lock B" owner="THREAD B" />
          <LockNode label="Lock A" owner="THREAD A" />
          <ThreadNode label="Thread B" lock="Waiting for Lock A" reduceMotion={reduceMotion} />
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-muted sm:text-xs">
          <span className="inline-flex items-center gap-2"><span className="h-2 w-4 rounded-sm border border-danger/50" />Waiting edge</span>
          <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 bg-secondary" />Ownership edge</span>
        </div>
        <span className="rounded-md border border-danger/20 bg-danger/5 px-2.5 py-1.5 font-mono text-[10px] text-danger">CIRCULAR WAIT</span>
      </footer>
    </section>
  );
}
