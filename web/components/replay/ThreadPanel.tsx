import type { RunData } from "@/lib/types";
import { STATES, rleAt } from "@/lib/replay";

interface ThreadPanelProps { run: RunData; index: number; syscallNames: Record<string, string> }

export default function ThreadPanel({ run, index, syscallNames }: ThreadPanelProps) {
  return (
    <section className="lp-panel-interactive overflow-hidden rounded-2xl border border-border bg-surface" aria-labelledby="thread-panel-title">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
        <h2 id="thread-panel-title" className="font-semibold">Thread state at the cursor</h2>
        <span className="text-xs text-muted">{run.live[index] ?? 0} live · {run.futex[index] ?? 0} in futex</span>
      </div>
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-elevated text-xs text-muted"><tr><th className="px-4 py-2 font-medium sm:px-5">TID</th><th className="px-4 py-2 font-medium">State</th><th className="px-4 py-2 font-medium">Syscall</th></tr></thead>
          <tbody className="divide-y divide-border/70">
            {run.threads.map((thread) => {
              const state = thread.states[index] ?? ".";
              const syscall = rleAt(thread.syscalls, index);
              const meta = STATES[state];
              return <tr key={thread.tid}>
                <th scope="row" className="px-4 py-2.5 font-mono text-xs text-secondary sm:px-5">T{thread.tid}</th>
                <td className="px-4 py-2.5"><span className="inline-flex items-center gap-2 text-xs text-text"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: meta?.color ?? "var(--muted)" }} />{meta?.label ?? `unknown (${state})`}</span></td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted">{syscall == null ? "—" : syscallNames[String(syscall)] ?? `syscall ${syscall}`}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
