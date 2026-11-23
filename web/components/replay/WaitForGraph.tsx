import type { GraphSnapshot, RunData } from "@/lib/types";
import { formatMs } from "@/lib/utils";

interface WaitForGraphProps { run: RunData; timeMs: number }

function snapshotAt(graphs: GraphSnapshot[], timeMs: number): GraphSnapshot | undefined {
  let selected: GraphSnapshot | undefined;
  for (const graph of graphs) {
    if (graph[0] > timeMs) break;
    selected = graph;
  }
  return selected;
}

export default function WaitForGraph({ run, timeMs }: WaitForGraphProps) {
  const snapshot = snapshotAt(run.tierF.graphs, timeMs);
  const held = snapshot?.[1] ?? [];
  const waiting = snapshot?.[2] ?? [];
  const cycle = new Set(snapshot?.[3] ?? []);
  const ownerFor = new Map(held.map(([objectIndex, tid]) => [objectIndex, tid]));

  return (
    <section className="lp-panel-interactive rounded-2xl border border-border bg-surface p-4 sm:p-5" aria-labelledby="wait-graph-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h2 id="wait-graph-title" className="font-semibold">Wait-for graph</h2><p className="mt-1 text-xs text-muted">Tier F synchronization snapshot at or before the cursor.</p></div>
        <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[11px] text-muted">{run.tierF.graphGranularity}</span>
      </div>
      {!snapshot ? <p className="mt-5 rounded-lg border border-dashed border-border p-4 text-sm text-muted">No graph snapshot has been recorded by {formatMs(timeMs)}.</p> : (
        <div className="mt-4 space-y-2" aria-live="polite">
          <p className="font-mono text-[11px] text-secondary">Snapshot · {formatMs(snapshot[0])}{cycle.size > 0 && <span className="ml-2 text-danger">cycle: {[...Array.from(cycle), Array.from(cycle)[0]].map((t) => `T${t}`).join(" → ")}</span>}</p>
          {waiting.length === 0 && held.length === 0 ? <p className="rounded-lg bg-background px-3 py-4 text-sm text-muted">No active waits or held locks in this snapshot.</p> : (
            <ul className="space-y-2">
              {waiting.map(([tid, objectIndex, kind], i) => {
                const owner = ownerFor.get(objectIndex);
                return <li key={`${tid}-${objectIndex}-${i}`} className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5 text-xs ${cycle.has(tid) ? "border-danger/40 bg-danger/5" : "border-border bg-background"}`}>
                  <span className="font-mono text-text">T{tid}</span><span className="text-muted">waits for</span><span className="font-mono text-secondary">object {run.tierF.objects[objectIndex] ?? `#${objectIndex}`}</span><span className="text-muted">({kind})</span>{owner != null && <><span aria-hidden="true" className="text-primary">←</span><span className="text-muted">held by</span><span className="font-mono text-text">T{owner}</span></>}
                </li>;
              })}
            </ul>
          )}
          {held.length > 0 && <p className="pt-1 text-[11px] leading-5 text-muted">Held resources: {held.map(([objectIndex, tid]) => `T${tid} owns ${run.tierF.objects[objectIndex] ?? `object #${objectIndex}`}`).join(" · ")}</p>}
        </div>
      )}
    </section>
  );
}
