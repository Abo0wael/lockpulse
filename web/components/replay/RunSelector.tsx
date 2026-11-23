import type { RunIndexEntry } from "@/lib/types";
import { familyLabel } from "@/lib/utils";

interface RunSelectorProps {
  runs: RunIndexEntry[];
  value: string;
  onChange: (runId: string) => void;
}

const SPLITS: Array<[string, string]> = [
  ["test", "Test split (held-out, one-shot evaluation)"],
  ["validation", "Validation split"],
  ["train", "Train split"],
];

/** Run picker grouped by split, test first; test runs are marked as held-out. */
export default function RunSelector({ runs, value, onChange }: RunSelectorProps) {
  const known = new Set(SPLITS.map(([s]) => s));
  const groups = [...SPLITS, ...[...new Set(runs.map((r) => r.split))].filter((s) => !known.has(s)).map((s) => [s, s] as [string, string])];
  return (
    <label className="grid min-w-0 gap-2 text-sm font-medium text-text">
      <span>Recorded run</span>
      <select
        aria-label="Select a recorded run"
        className="min-h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-text outline-none transition focus-visible:ring-2 focus-visible:ring-primary sm:min-w-80"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {groups.map(([split, label]) => {
          const items = runs.filter((r) => r.split === split).sort((a, b) => a.family.localeCompare(b.family) || a.runId.localeCompare(b.runId));
          if (!items.length) return null;
          return <optgroup key={split} label={label}>
            {items.map((run) => (
              <option key={run.runId} value={run.runId}>
                {split === "test" ? "[TEST] " : ""}{familyLabel(run.family)} · {run.runId.slice(run.family.length + 1)} · {run.truth}
              </option>
            ))}
          </optgroup>;
        })}
      </select>
    </label>
  );
}
