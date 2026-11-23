/** Shared helpers for the /replay page: detector metadata, state colours, formatting and the trace summary. */
import type { RunData } from "@/lib/types";
import { formatMs } from "@/lib/utils";

export const DETECTOR_ORDER = ["B1", "B2", "B3", "B4", "M1", "M2", "M3"] as const;

/** Name, kind and a fixed colour per detector (mid-tone colours that read on both the dark and light theme). */
export const DETECTORS: Record<string, { name: string; color: string; rule: boolean }> = {
  B1: { name: "fixed timeout", color: "#f59e0b", rule: true },
  B2: { name: "futex silence", color: "#06b6d4", rule: false },
  B3: { name: "wait-for graph", color: "#e879f9", rule: true },
  B4: { name: "progress watchdog", color: "#f97316", rule: true },
  M1: { name: "logistic regression", color: "#84cc16", rule: false },
  M2: { name: "random forest", color: "#a78bfa", rule: false },
  M3: { name: "gradient boosting", color: "#3b82f6", rule: false },
};

export function detectorColor(det: string): string {
  return DETECTORS[det]?.color ?? "#94a3b8";
}

/** Per-tick Tier P thread state (ml/export_web.py) -> label and colour. */
export const STATES: Record<string, { label: string; color: string }> = {
  R: { label: "running", color: "var(--success)" },
  F: { label: "futex wait", color: "var(--danger)" },
  I: { label: "sleep / I/O", color: "#3b82f6" },
  B: { label: "other blocked", color: "var(--warning)" },
  ".": { label: "not alive", color: "color-mix(in srgb, var(--muted) 28%, transparent)" },
};

/** Thresholds with units: B rules in ms, model thresholds as probabilities at their frozen precision. */
export function formatThreshold(det: string, value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (det.startsWith("M")) return formatProbability(value);
  return `${Math.round(value)} ms`;
}

/** Probabilities near 1 keep one digit past the leading nines (0.9999936 -> "0.999994", 0.9995787 -> "0.9996"). */
export function formatProbability(p: number): string {
  if (p >= 1) return "1";
  if (p < 0.99) return p.toFixed(3);
  const nines = Math.floor(-Math.log10(1 - p));
  for (let d = Math.max(4, nines + 1); d <= 7; d++) {
    const s = p.toFixed(d);
    if (!s.startsWith("1")) return s;
  }
  return p.toFixed(7);
}

/** Value of an RLE series [value, length][] at tick index. */
export function rleAt<T>(series: Array<[T, number]>, index: number): T | undefined {
  let cursor = 0;
  for (const [value, length] of series) {
    cursor += length;
    if (index < cursor) return value;
  }
  return undefined;
}

/** Runs of equal characters in a per-tick state string: [state, startTick, length][]. */
export function stateRuns(states: string): Array<[string, number, number]> {
  const runs: Array<[string, number, number]> = [];
  for (let i = 0; i < states.length; ) {
    let j = i + 1;
    while (j < states.length && states[j] === states[i]) j++;
    runs.push([states[i], i, j - i]);
    i = j;
  }
  return runs;
}

/** First tick index whose time is >= timeMs (or the last tick). */
export function tickAt(tMs: number[], timeMs: number): number {
  const i = tMs.findIndex((t) => t >= timeMs);
  return i < 0 ? tMs.length - 1 : i;
}

const WAIT_KINDS: Record<string, string> = {
  MUTEX_REQ: "a mutex",
  SEM_WAIT_ENTER: "sem_wait",
  COND_WAIT_ENTER: "a condition variable",
  BARRIER_ENTER: "a barrier",
  "P:S": "sleeping with no CPU (join)",
};

export interface TraceSummary {
  label: string;
  onset: string | null;
  blocked: string | null;
  waits: string | null;
  cycle: string | null;
}

/** Readable summary of the labeler's reason string (which carries hex object addresses). */
export function summarizeTrace(run: RunData): TraceSummary {
  const reason = run.reason ?? "";
  const label = run.truth === "healthy" ? "healthy" : run.truth === "deadlock" ? "deadlock" : "hang (not a lock cycle)";
  const onset = run.t0Ms == null ? null : formatMs(run.t0Ms);
  const all = /all (\d+) live threads blocked/.exec(reason);
  let blocked: string | null = null;
  if (all) blocked = `${all[1]} of ${all[1]} live threads blocked`;
  else if (run.truth !== "healthy") {
    const tick = run.t0Ms == null ? run.nTicks - 1 : tickAt(run.tMs, run.t0Ms);
    const n = run.threads.filter((th) => "FIB".includes(th.states[tick] ?? "R")).length;
    blocked = `${n} threads blocked`;
  }
  const counts = new Map<string, number>();
  const head = reason.split("|")[0];
  for (const m of head.matchAll(/(\d+) (MUTEX_REQ|SEM_WAIT_ENTER|COND_WAIT_ENTER|BARRIER_ENTER|P:S)/g)) {
    const kind = WAIT_KINDS[m[2]];
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const waits = counts.size
    ? [...counts].map(([kind, n]) => (kind.startsWith("sleeping") ? `${n} ${kind}` : `${n} waiting on ${kind}`)).join(", ")
    : null;
  let cycle: string | null = null;
  const cyc = reason.split("deadlock cycle:")[1];
  if (cyc) {
    const tids = cyc.replace(/\[[^\]]*\]/g, "").match(/\d+/g) ?? [];
    if (tids.length > 1) cycle = tids.map((t) => `T${t}`).join(" → ");
  } else if (run.cycleTids.length) {
    cycle = [...run.cycleTids, run.cycleTids[0]].map((t) => `T${t}`).join(" → ");
  }
  return { label, onset, blocked, waits, cycle };
}

/** Where the replay opens: the ground-truth onset (plus a few ticks so alerts and graphs are populated), or mid-run. */
export function defaultTick(run: RunData): number {
  if (run.t0Ms == null) return Math.floor(run.nTicks / 2);
  return Math.min(run.nTicks - 1, tickAt(run.tMs, run.t0Ms) + 20);
}
