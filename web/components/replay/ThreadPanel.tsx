import type { RunData } from "@/lib/types";

interface ThreadPanelProps { run: RunData; index: number }

function syscallAt(series: Array<[number | null, number]>, index: number): number | null | undefined {
  let cursor = 0;
  for (const [value, length] of series) {
    cursor += length;
    if (index < cursor) return value;
  }
  return undefined;
}

const stateLabels: Record<string, string> = {
  ".": "Not alive", R: "Running", F: "Futex wait", I: "Sleep / I/O", B: "Other blocked",
};

export default function ThreadPanel({ run, index }: ThreadPanelProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface" aria-labelledby="thread-panel-title">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
        <h2 id="thread-panel-title" className="font-semibold">Thread state</h2>
        <span className="text-xs text-muted">{run.live[index] ?? 0} live · {run.futex[index] ?? 0} futex</span>
      </div>
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-elevated text-xs text-muted"><tr><th className="px-4 py-2 font-medium sm:px-5">TID</th><th className="px-4 py-2 font-medium">State</th><th className="px-4 py-2 font-medium">Syscall nr</th></tr></thead>
          <tbody className="divide-y divide-border/70">
            {run.threads.map((thread) => {
              const state = thread.states[index] ?? ".";
              const syscall = syscallAt(thread.syscalls, index);
              return <tr key={thread.tid}>
                <th scope="row" className="px-4 py-2.5 font-mono text-xs text-secondary sm:px-5">{thread.tid}</th>
                <td className="px-4 py-2.5"><span className={`inline-flex items-center gap-2 text-xs ${state === "F" || state === "B" ? "text-warning" : state === "R" ? "text-success" : "text-muted"}`}><i className="h-1.5 w-1.5 rounded-full bg-current" />{stateLabels[state] ?? `Unknown (${state})`}</span></td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted">{syscall == null ? syscall === null ? "—" : "No sample" : syscall}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
