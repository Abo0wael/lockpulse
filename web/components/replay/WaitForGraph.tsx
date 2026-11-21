"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { RunData } from "@/lib/types";

export default function WaitForGraph({ run, timeMs }: { run: RunData; timeMs: number }) {
  const reduceMotion = useReducedMotion();
  const snapshot = [...run.tierF.graphs].reverse().find((graph) => graph[0] <= timeMs);
  const graph = snapshot?.[2] ?? [];
  const owners = snapshot?.[1] ?? [];
  const cycle = snapshot?.[3] ?? [];
  return (
    <section className="rounded-2xl border border-border bg-surface/80 p-4 shadow-lg shadow-black/10 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold tracking-[0.16em] text-secondary">SYNCHRONIZATION</p><h2 className="mt-1 font-semibold">Wait-for graph</h2></div><span className="rounded-lg border border-border bg-background/70 px-2.5 py-1.5 text-xs text-muted">{snapshot ? `${graph.length} wait edges` : "No graph state"}</span></div>
      {graph.length || owners.length ? (
        <div className="space-y-2">
          {graph.map(([tid, object, kind], index) => {
            const owner = owners.find(([obj]) => obj === object)?.[1];
            return (
              <motion.div key={`${snapshot?.[0]}-${tid}-${index}`} initial={reduceMotion ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduceMotion ? 0 : 0.22, delay: reduceMotion ? 0 : index * 0.025 }} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 text-sm">
                <span className={cycle.includes(tid) ? "font-semibold text-danger" : "text-text"}>Thread {tid}</span><span className="text-muted">waits for {kind} <code className="rounded bg-secondary/5 px-1 text-secondary">{run.tierF.objects[object] ?? object}</code></span>{owner != null && <><span className="text-muted">held by</span><span className={cycle.includes(owner) ? "font-semibold text-danger" : "text-text"}>Thread {owner}</span></>}
              </motion.div>
            );
          })}
          {owners.length > 0 && <p className="pt-2 text-xs text-muted">Locks currently held: {owners.map(([, tid]) => `T${tid}`).join(" · ")}</p>}
        </div>
      ) : <p className="rounded-xl border border-border/70 bg-background/70 p-4 text-sm leading-6 text-muted">No held-lock cycle is present at this sample. Some hangs do not involve a mutex cycle.</p>}
    </section>
  );
}
