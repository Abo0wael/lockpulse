"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { RunData } from "@/lib/types";
import { formatMs } from "@/lib/utils";

export default function EventLog({ run, timeMs }: { run: RunData; timeMs: number }) {
  const reduceMotion = useReducedMotion();
  const events = run.tierF.events.filter((event) => event[0] <= timeMs).slice(-12).reverse();
  return (
    <section className="rounded-2xl border border-border bg-surface/80 p-4 shadow-lg shadow-black/10 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold tracking-[0.16em] text-primary">RECORDED TRACE</p><h2 className="mt-1 font-semibold">Tier F event log</h2></div><span className="rounded-lg border border-border bg-background/70 px-2.5 py-1.5 text-xs tabular-nums text-muted">{run.tierF.eventsTotal.toLocaleString()} events</span></div>
      {events.length ? (
        <ol className="max-h-72 space-y-1 overflow-auto pr-1">
          {events.map((event, index) => <motion.li key={`${event[0]}-${index}`} initial={reduceMotion ? false : { opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduceMotion ? 0 : 0.18 }} className="grid grid-cols-[5rem_4rem_1fr] gap-2 border-b border-border/60 py-2 font-mono text-[11px] last:border-0"><span className="text-muted">{formatMs(event[0], 2)}</span><span className="text-secondary">T{event[1]}</span><span className="break-all text-text">{run.tierF.eventNames[event[2]]} <span className="text-muted">{run.tierF.objects[event[3]]}</span></span></motion.li>)}
        </ol>
      ) : <p className="rounded-xl border border-border/70 bg-background/70 p-4 text-sm leading-6 text-muted">No synchronization events have occurred by this point in the replay.</p>}
    </section>
  );
}
