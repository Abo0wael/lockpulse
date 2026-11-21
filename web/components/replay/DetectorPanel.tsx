"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { RunData } from "@/lib/types";
import { formatMs } from "@/lib/utils";

const order = ["B1", "B2", "B3", "B4", "M1", "M2", "M3"];

export default function DetectorPanel({ run, timeMs }: { run: RunData; timeMs: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <section className="rounded-2xl border border-border bg-surface/80 p-4 shadow-lg shadow-black/10 sm:p-5">
      <div className="mb-4"><p className="text-[10px] font-semibold tracking-[0.16em] text-primary">LIVE AT CURSOR</p><h2 className="mt-1 font-semibold">Detector status</h2></div>
      <div className="grid gap-2 sm:grid-cols-2">
        {order.map((key) => {
          const alert = run.alerts[key];
          const fired = alert != null && alert <= timeMs;
          return (
            <motion.div key={key} layout className="flex items-center justify-between gap-2 rounded-xl border border-border/80 bg-background/70 px-3 py-2.5 transition-colors hover:border-primary/25">
              <span><strong className="mr-2 rounded-md bg-primary/10 px-1.5 py-1 font-mono text-xs text-secondary">{key}</strong><span className="text-xs text-muted">{run.thresholds[key] != null ? `threshold ${run.thresholds[key]}` : "cycle detector"}</span></span>
              <motion.span key={`${key}-${fired ? "alert" : "wait"}`} initial={reduceMotion ? false : { opacity: 0.6 }} animate={{ opacity: 1 }} transition={{ duration: reduceMotion ? 0 : 0.2 }} className={`text-xs font-semibold ${fired ? "text-warning" : "text-muted"}`}>{fired ? `Alert · ${formatMs(alert)}` : alert == null ? "No alert" : "Watching"}</motion.span>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
