export type Split = "train" | "validation" | "test";
export type RunTruth = "deadlock" | "hang" | "healthy";
export type ThreadState = "R" | "F" | "I" | "B" | ".";

export interface RunSummary {
  runId: string; family: string; split: Split; truth: RunTruth; t0Ms: number | null;
  threads: number; durationMs: number; config: string; seed: number; bytes?: number;
}
export interface ThreadTrace { tid: number; states: string; syscalls: [number | null, number][] }
export interface WaitForEdge { from: number; to: number; kind: string }
export type GraphSnapshot = [number, [number, number][], [number, number, string][], number[]];
export type TraceEvent = [number, number, number, number];
export interface RunData extends Omit<RunSummary, "threads" | "durationMs" | "config" | "seed" | "bytes"> {
  reason?: string; source?: "collected" | "presentation-preview"; tickMs: number; nTicks: number; tMs: number[]; threads: ThreadTrace[];
  futex: number[]; live: number[]; scores: Record<string, (number | null)[]>;
  thresholds: Record<string, number>; alerts: Record<string, number | null>;
  outcomes: Record<string, { kind: string; delayMs: number | null }>;
  cycleTids: number[]; tierF: { events: TraceEvent[]; eventsTotal: number; graphs: GraphSnapshot[]; eventNames: string[]; objects: string[] };
}
export interface ResultRow {
  detector: string; name: string; input: string; setting: string; scope: string; runs: number;
  hangRuns: number; detected: number; detectionRate: number | null; delayMedianMs: number | null;
  delayP90Ms: number | null; faHealthy: number; faEarly: number; faRate: number | null; prAuc: number | null;
}
export interface ResultsData { split: string; rows: ResultRow[] }
export interface RunIndex { runs: RunSummary[]; default: string; detectors: Record<string, string>; syscallNames: Record<string, string>; source?: "collected" | "presentation-preview" }
