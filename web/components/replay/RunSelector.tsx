import type { RunSummary } from "@/lib/types";

export default function RunSelector({ runs, value, onChange }: { runs: RunSummary[]; value: string; onChange: (id: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-muted">
      Recorded run
      <select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-xl border border-border bg-background/80 px-3 text-text outline-none transition hover:border-secondary/30 focus:border-secondary/50 focus:ring-2 focus:ring-secondary/15">
        {runs.map((run) => <option key={run.runId} value={run.runId}>{run.family.replaceAll("_", " ")} · {run.truth} · {run.runId}</option>)}
      </select>
    </label>
  );
}
