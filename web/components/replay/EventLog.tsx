import type { RunData } from "@/lib/types";
import { formatMs } from "@/lib/utils";

interface EventLogProps { run: RunData; timeMs: number }

export default function EventLog({ run, timeMs }: EventLogProps) {
  const events = run.tierF.events.filter(([time]) => time <= timeMs).slice(-12).reverse();
  return (
    <section className="lp-panel-interactive overflow-hidden rounded-2xl border border-border bg-surface" aria-labelledby="event-log-title">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5"><h2 id="event-log-title" className="font-semibold">Synchronization events</h2><span className="text-xs text-muted">{run.tierF.eventsTotal.toLocaleString()} total in trace</span></div>
      {events.length === 0 ? <p className="p-4 text-sm text-muted">No exported synchronization events before the current cursor.</p> : (
        <ol className="max-h-72 divide-y divide-border/70 overflow-auto" aria-live="polite">
          {events.map(([time, tid, eventIndex, objectIndex], i) => <li key={`${time}-${tid}-${i}`} className="grid grid-cols-[4.5rem_3rem_minmax(0,1fr)] gap-2 px-4 py-2.5 font-mono text-[11px] sm:px-5">
            <time className="text-muted">{formatMs(time, 2)}</time><span className="text-secondary">T{tid}</span><span className="break-all text-text">{run.tierF.eventNames[eventIndex] ?? "Unknown event"}<span className="text-muted"> · {run.tierF.objects[objectIndex] ?? `object #${objectIndex}`}</span></span>
          </li>)}
        </ol>
      )}
    </section>
  );
}
