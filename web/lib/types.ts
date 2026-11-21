/** Types for the static JSON contract produced by `python -m ml.export_web`. */

export type RunTruth = "deadlock" | "hang" | "healthy";
export type ResultSplit = "test" | "validation";
export type TraceEvent = [timeMs: number, threadId: number, eventIndex: number, objectIndex: number];
export type Split = "train" | "validation" | "test";
export type ThreadState = "R" | "F" | "I" | "B" | ".";

export interface RunIndexEntry {
  runId: string;
  family: string;
  split: string;
  truth: RunTruth;
  t0Ms: number | null;
  threads: number;
  durationMs: number;
  config: string;
  seed: number;
  bytes?: number;
}

export type RunSummary = RunIndexEntry;

export interface RunIndex {
  runs: RunIndexEntry[];
  default: string;
  detectors: Record<string, string>;
  syscallNames: Record<string, string>;
  source?: "collected" | "presentation-preview";
}

export type EncodedSeries<T> = [value: T, runLength: number][];
export type HeldEdge = [objectIndex: number, threadId: number];
export type WaitEdge = [threadId: number, objectIndex: number, kind: string];
export type GraphSnapshot = [
  timeMs: number,
  held: HeldEdge[],
  waiting: WaitEdge[],
  cycleThreadIds: number[],
];
export type TierFEvent = [timeMs: number, threadId: number, eventIndex: number, objectIndex: number];

export interface TierFData {
  eventNames: string[];
  objects: string[];
  events: TierFEvent[];
  eventsTotal: number;
  graphs: GraphSnapshot[];
  graphGranularity: "event" | "tick";
}

export interface RunThread {
  tid: number;
  /** Per-tick state encoding: . not alive, R running, F futex, I sleep/I/O, B other blocked. */
  states: string;
  /** RLE pairs [syscall number or null, run length]. */
  syscalls: EncodedSeries<number | null>;
}

export interface DetectorOutcome {
  kind: string;
  delayMs: number | null;
}

export interface RunData {
  runId: string;
  family: string;
  split: string;
  truth: RunTruth;
  t0Ms: number | null;
  reason: string;
  tickMs: number;
  nTicks: number;
  tMs: number[];
  threads: RunThread[];
  futex: number[];
  live: number[];
  scores: Record<string, (number | null)[]>;
  thresholds: Record<string, number>;
  alerts: Record<string, number | null>;
  outcomes: Record<string, DetectorOutcome>;
  cycleTids: number[];
  tierF: TierFData;
  /** Optional UI annotation; it is not emitted by the research exporter. */
  source?: "collected" | "presentation-preview";
}

export interface ResultRow {
  detector: string;
  name: string;
  input: string;
  setting: string;
  scope: string;
  runs: number;
  hangRuns: number;
  detected: number;
  detectionRate: number | null;
  delayMedianMs: number | null;
  delayP90Ms: number | null;
  faHealthy: number;
  faEarly: number;
  faRate: number | null;
  prAuc: number | null;
}

export interface ResultsData {
  split: ResultSplit;
  rows: ResultRow[];
}
