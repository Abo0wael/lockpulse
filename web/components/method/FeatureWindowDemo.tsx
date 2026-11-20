"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Clock3 } from "lucide-react";

const windows = [
  { samples: 10, duration: "50 ms" },
  { samples: 20, duration: "100 ms" },
  { samples: 40, duration: "200 ms" },
] as const;

export default function FeatureWindowDemo() {
  const [samples, setSamples] = useState<10 | 20 | 40>(10);
  const reduceMotion = useReducedMotion() ?? false;
  const selected = windows.find((window) => window.samples === samples)!;

  return (
    <div className="border-y border-border bg-[#0d1017]">
      <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center border border-primary/25 bg-primary/[0.07] text-primary"><Clock3 aria-hidden="true" size={16} /></span><div><p className="text-sm font-semibold text-text">Trailing feature window</p><p className="font-mono text-[9px] uppercase tracking-wider text-muted">5 ms per sample · past + current only</p></div></div>
        <div role="group" aria-label="Select feature window length" className="flex border border-border bg-background p-1">
          {windows.map((window) => <button key={window.samples} type="button" aria-pressed={samples === window.samples} onClick={() => setSamples(window.samples)} className={`min-h-9 min-w-16 px-3 font-mono text-[10px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary sm:min-w-[4.5rem] ${samples === window.samples ? "bg-primary/15 text-text" : "text-muted hover:text-text"}`}>W={window.samples}</button>)}
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <div className="mb-4 flex items-baseline justify-between gap-3"><p className="text-sm text-muted">Current feature row summarizes the last <strong className="font-semibold text-text">{selected.samples} samples</strong></p><p className="font-mono text-sm font-semibold text-primary">{selected.duration}</p></div>
        <div className="grid grid-cols-10 gap-1 sm:grid-cols-[repeat(20,minmax(0,1fr))]" role="img" aria-label={`A trailing window of ${selected.samples} samples out of 40, equivalent to ${selected.duration}; samples to the right are nearest the current time.`}>
          {Array.from({ length: 40 }, (_, index) => {
            const included = index >= 40 - samples;
            return <motion.span key={index} layout={!reduceMotion} animate={{ opacity: included ? 1 : 0.25 }} transition={{ duration: reduceMotion ? 0 : 0.22 }} className={`h-4 border ${included ? "border-primary/60 bg-primary/65" : "border-border bg-surface"}`} />;
          })}
        </div>
        <div className="mt-3 flex justify-between font-mono text-[9px] uppercase tracking-wider text-muted"><span>Older samples</span><span>Now · tick t</span></div>
        <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
          <p className="text-xs leading-5 text-muted"><span className="font-mono text-primary">W=10</span> · 10 × 5 ms = 50 ms</p>
          <p className="text-xs leading-5 text-muted"><span className="font-mono text-primary">W=20</span> · 20 × 5 ms = 100 ms</p>
          <p className="text-xs leading-5 text-muted"><span className="font-mono text-primary">W=40</span> · 40 × 5 ms = 200 ms</p>
        </div>
      </div>
    </div>
  );
}
