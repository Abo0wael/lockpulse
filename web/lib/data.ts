import type { ResultRow, ResultsData, RunData, RunIndex } from "./types";
import { presentationRun, presentationRunIndex } from "./presentation-replay";

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
  return response.json() as Promise<T>;
}

export async function loadRunIndex() {
  try {
    return await readJson<RunIndex>("/data/index.json");
  } catch {
    return presentationRunIndex();
  }
}

export function loadRun(runId: string) {
  return runId.startsWith("preview-")
    ? Promise.resolve(presentationRun(runId))
    : readJson<RunData>(`/data/runs/${encodeURIComponent(runId)}.json`);
}
export const loadResults = (split: "test" | "validation") =>
  readJson<ResultsData>(`/data/results_${split === "test" ? "test" : "val"}.json`);

export function overallRows(rows: ResultRow[]) {
  return rows.filter((row) => row.scope === "overall");
}
