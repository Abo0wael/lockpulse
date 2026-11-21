import type { RunIndexEntry } from "@/lib/types";

interface RunSelectorProps {
  runs: RunIndexEntry[];
  value: string;
  onChange: (runId: string) => void;
}

export default function RunSelector({ runs, value, onChange }: RunSelectorProps) {
  return (
    <label className="grid gap-2 text-sm font-medium text-text">
      <span>Recorded run</span>
      <select
        aria-label="Select a recorded run"
        className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text outline-none transition focus-visible:ring-2 focus-visible:ring-primary sm:min-w-80"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {runs.map((run) => (
          <option key={run.runId} value={run.runId}>
            {run.family.replaceAll("_", " ")} · {run.runId} · {run.truth}
          </option>
        ))}
      </select>
    </label>
  );
}
