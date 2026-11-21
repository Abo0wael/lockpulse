import type { ResultRow, ResultSplit, ResultsData, RunData, RunIndex } from "@/lib/types";

async function getJson<T>(path: string, description: string): Promise<T> {
  const response = await fetch(path, { cache: "force-cache" });

  if (!response.ok) {
    const status = `${response.status} ${response.statusText}`.trim();
    throw new Error(`${description} could not be loaded (${status}). Export the project data with python -m ml.export_web.`);
  }

  return (await response.json()) as T;
}

/** Loads the run catalog generated at public/data/index.json. */
export function loadRunIndex(): Promise<RunIndex> {
  return getJson<RunIndex>("/data/index.json", "Replay run index");
}

/** Loads one exported, per-run trace without synthesizing missing data. */
export function loadRun(runId: string): Promise<RunData> {
  return getJson<RunData>(`/data/runs/${encodeURIComponent(runId)}.json`, `Replay run “${runId}”`);
}

/** Loads the frozen test or validation table produced by the web exporter. */
export function loadResults(split: ResultSplit): Promise<ResultsData> {
  const file = split === "test" ? "results_test.json" : "results_val.json";
  return getJson<ResultsData>(`/data/${file}`, `${split} evaluation results`);
}

/** Keeps aggregate rows for overview charts; per-family rows remain available to the page. */
export function overallRows(rows: ResultRow[]): ResultRow[] {
  return rows.filter((row) => row.scope === "overall");
}
