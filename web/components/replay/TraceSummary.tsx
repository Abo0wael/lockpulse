"use client";

import { useState } from "react";
import type { RunData } from "@/lib/types";
import { summarizeTrace } from "@/lib/replay";
import { familyLabel } from "@/lib/utils";
import StatusBadge from "@/components/shared/StatusBadge";

/** Readable summary of the selected run; the labeler's raw reason (with hex object addresses) sits behind a toggle. */
export default function TraceSummary({ run }: { run: RunData }) {
  const [open, setOpen] = useState(false);
  const s = summarizeTrace(run);
  const preview = run.source === "presentation-preview";
  return (
    <div className="lp-panel-interactive min-w-0 rounded-2xl border border-border bg-surface/80 p-4 shadow-lg shadow-black/10 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-secondary">{preview ? "Presentation scenario" : "Selected recorded trace"}</p>
      <h2 className="mt-2 flex flex-wrap items-center gap-2 font-mono text-sm font-semibold">{run.runId}<StatusBadge tone={run.truth}>{s.label}</StatusBadge></h2>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted">Family</dt><dd>{familyLabel(run.family)} · {run.split} split{run.split === "test" ? " (held-out)" : ""}</dd>
        <dt className="text-muted">Onset t0</dt><dd>{s.onset ?? "none (healthy run)"}</dd>
        {s.blocked && <><dt className="text-muted">Blocked</dt><dd>{s.blocked}{s.waits ? ` (${s.waits})` : ""}</dd></>}
        {s.cycle && <><dt className="text-muted">Cycle</dt><dd className="break-words font-mono text-xs leading-6 text-danger">cycle: {s.cycle}</dd></>}
        <dt className="text-muted">Trace</dt><dd>{run.nTicks} samples at {run.tickMs} ms · {run.threads.length} threads</dd>
      </dl>
      {run.reason && <div className="mt-3">
        <button type="button" className="text-xs font-medium text-secondary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Hide details" : "Show details"} (raw labeler reason)</button>
        {open && <p className="mt-2 break-all rounded-lg bg-background px-3 py-2 font-mono text-[11px] leading-5 text-muted">{run.reason}</p>}
      </div>}
    </div>
  );
}
