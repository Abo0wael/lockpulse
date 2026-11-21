"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { RunData, ThreadState } from "@/lib/types";

const labels: Record<ThreadState, string> = { R: "Running", F: "Futex wait", I: "Sleep / I/O", B: "Other blocked", ".": "Not alive" };
const tones: Record<ThreadState, string> = { R: "bg-success", F: "bg-danger", I: "bg-secondary", B: "bg-warning", ".": "bg-border" };

export default function ThreadPanel({ run, index }: { run: RunData; index: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <section className="rounded-2xl border border-border bg-surface/80 p-4 shadow-lg shadow-black/10 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div><p className="text-[10px] font-semibold tracking-[0.16em] text-secondary">THREAD ACTIVITY</p><h2 className="mt-1 font-semibold">Thread states</h2></div>
        <span className="rounded-lg border border-border bg-background/70 px-2.5 py-1.5 font-mono text-xs text-text">{Math.round(run.tMs[index] ?? 0)} ms</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {run.threads.map((thread) => {
          const state = (thread.states[index] ?? ".") as ThreadState;
          return (
            <motion.div key={thread.tid} layout={!reduceMotion} whileHover={reduceMotion ? undefined : { y: -2 }} transition={{ duration: reduceMotion ? 0 : 0.18 }} className="flex items-center gap-3 rounded-xl border border-border/80 bg-background/70 px-3 py-2.5 transition-colors hover:border-secondary/25">
              <motion.span key={`${thread.tid}-${state}`} initial={reduceMotion ? false : { scale: 0.6, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: reduceMotion ? 0 : 0.2 }} className={`h-2.5 w-2.5 shrink-0 rounded-full ${tones[state]}`} />
              <span className="min-w-0 flex-1"><span className="block text-sm font-medium">Thread {thread.tid}</span><span className="block text-xs text-muted">{labels[state]}</span></span>
              <span className="font-mono text-xs text-muted">{state}</span>
            </motion.div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted">R running · F futex · I sleep or I/O · B other blocked · . not alive</p>
    </section>
  );
}
