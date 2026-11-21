"use client";

import { motion } from "framer-motion";
import { formatMs } from "@/lib/utils";

export default function Timeline({ times, index, t0Ms, onChange, alertTimes = [] }: { times: number[]; index: number; t0Ms: number | null; onChange: (index: number) => void; alertTimes?: number[] }) {
  const max = Math.max(0, times.length - 1);
  const cursor = times[index] ?? 0;
  return (
    <section className="rounded-2xl border border-border bg-surface/80 p-4 shadow-lg shadow-black/10 sm:p-5" aria-label="Replay timeline">
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted"><span className="font-semibold text-text">Run timeline</span><span className="font-mono text-secondary">{formatMs(cursor, 0)} / {formatMs(times[max] ?? 0, 0)}</span></div>
      <div className="relative py-2">
        {t0Ms != null && times[max] > 0 && <motion.span layout title="Ground truth hang start" className="absolute top-0 z-10 h-3 w-0.5 bg-danger shadow-[0_0_10px_rgba(251,113,133,0.8)]" style={{ left: `${Math.min(100, (t0Ms / times[max]) * 100)}%` }} />}
        {alertTimes.map((time, i) => <motion.span layout key={`${time}-${i}`} title={`Detector alert at ${formatMs(time)}`} className="absolute top-4 z-10 h-2 w-0.5 bg-warning shadow-[0_0_8px_rgba(251,191,36,0.7)]" style={{ left: `${Math.min(100, (time / (times[max] || 1)) * 100)}%` }} />)}
        <input aria-label="Replay position" type="range" min={0} max={max} value={index} onChange={(event) => onChange(Number(event.target.value))} className="w-full cursor-pointer accent-secondary" />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted"><span><i className="mr-1 inline-block h-2 w-0.5 bg-danger"/>Hang start</span><span><i className="mr-1 inline-block h-2 w-0.5 bg-warning"/>Detector alert</span><span className="ml-auto font-mono tabular-nums">{index + 1} / {times.length} samples</span></div>
    </section>
  );
}
