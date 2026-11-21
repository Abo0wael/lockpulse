import type { GraphSnapshot, RunData, RunIndex, RunSummary, ThreadState, TraceEvent } from "./types";

const TICK_MS = 5;
const N_TICKS = 441;
const DETECTORS = ["B1", "B2", "B3", "B4", "M1", "M2", "M3"];
const NAMES: Record<string, string> = {
  B1: "B1 fixed timeout", B2: "B2 futex silence", B3: "B3 wait-for graph", B4: "B4 progress watchdog",
  M1: "M1 logistic regression", M2: "M2 random forest", M3: "M3 gradient boosting",
};
const SYSCALL_NAMES: Record<string, string> = { "-1": "running", "0": "read", "35": "nanosleep", "202": "futex" };

type Scenario = "semaphore" | "deadlock" | "io";
const DEFINITIONS: Record<Scenario, { runId: string; family: string; truth: RunData["truth"]; t0Ms: number | null; threadIds: number[]; title: string }> = {
  semaphore: { runId: "preview-semaphore-hang", family: "sem_never_posted", truth: "hang", t0Ms: 500, threadIds: [1200, 1201, 1202, 1203], title: "Semaphore hang without a mutex cycle" },
  deadlock: { runId: "preview-dining-deadlock", family: "dining_philosophers", truth: "deadlock", t0Ms: 500, threadIds: [2101, 2102, 2103, 2104, 2105, 2106], title: "Dining philosophers deadlock" },
  io: { runId: "preview-blocked-io", family: "blocked_on_io", truth: "healthy", t0Ms: null, threadIds: [3101, 3102, 3103], title: "Healthy workers blocked on I/O" },
};

const ALERTS: Record<Scenario, Record<string, number | null>> = {
  semaphore: { B1: 2000, B2: 555, B3: null, B4: 2000, M1: 525, M2: 548, M3: 560 },
  deadlock: { B1: 2000, B2: 561, B3: 500, B4: 2000, M1: 546, M2: 561, M3: 556 },
  io: { B1: 1850, B2: null, B3: null, B4: 1850, M1: null, M2: null, M3: null },
};

function rle(values: Array<number | null>): [number | null, number][] {
  const result: [number | null, number][] = [];
  for (const value of values) {
    const last = result[result.length - 1];
    if (last && last[0] === value) last[1]++;
    else result.push([value, 1]);
  }
  return result;
}

function statesFor(scenario: Scenario, threadIndex: number): string {
  return Array.from({ length: N_TICKS }, (_, i): ThreadState => {
    const time = i * TICK_MS;
    if (scenario === "semaphore") {
      if (threadIndex === 3) return time >= 510 ? "." : "R";
      return time >= (threadIndex === 0 ? 495 : 500) ? "F" : "R";
    }
    if (scenario === "deadlock") {
      if (threadIndex < 5) return time >= 500 ? "F" : "R";
      return time >= 505 ? "F" : "R";
    }
    if (threadIndex < 2) return time >= 100 && time < 1900 ? "I" : "R";
    return time >= 100 && time < 1900 ? "I" : "R";
  }).join("");
}

function tierF(scenario: Scenario, tids: number[]): RunData["tierF"] & { graphGranularity: string } {
  if (scenario === "deadlock") {
    const events = tids.slice(0, 5).flatMap((tid, i) => [[480, tid, 0, i] as [number, number, number, number], [500, tid, 1, (i + 1) % 5] as [number, number, number, number]]);
    const held = tids.slice(0, 5).map((tid, i) => [i, tid] as [number, number]);
    const waiting = tids.slice(0, 5).map((tid, i) => [tid, (i + 1) % 5, "mutex"] as [number, number, string]);
    return { eventNames: ["MUTEX_ACQ", "MUTEX_REQ"], objects: ["fork A", "fork B", "fork C", "fork D", "fork E"], events, eventsTotal: 10,
      graphs: [[480, held, [], []], [500, held, waiting, tids.slice(0, 5)]] as RunData["tierF"]["graphs"], graphGranularity: "event" };
  }
  if (scenario === "semaphore") {
    const events: TraceEvent[] = tids.slice(0, 3).map((tid, i) => [500 + i * 2, tid, 0, 0]);
    return { eventNames: ["SEM_WAIT_ENTER"], objects: ["semaphore 0"], events, eventsTotal: 4, graphs: [], graphGranularity: "event" };
  }
  const events: TraceEvent[] = [[100, tids[0], 0, 0], [105, tids[1], 0, 0]];
  return { eventNames: ["IO_WAIT"], objects: ["input pipe"], events, eventsTotal: 2, graphs: [] as GraphSnapshot[], graphGranularity: "event" };
}

export function presentationRunIndex(): RunIndex {
  const runs: RunSummary[] = (Object.keys(DEFINITIONS) as Scenario[]).map((key) => {
    const d = DEFINITIONS[key];
    return { runId: d.runId, family: d.family, split: key === "io" ? "test" : "test", truth: d.truth,
      t0Ms: d.t0Ms, threads: d.threadIds.length, durationMs: (N_TICKS - 1) * TICK_MS, config: "preview", seed: 0 };
  });
  return { runs, default: DEFINITIONS.semaphore.runId, detectors: NAMES, syscallNames: SYSCALL_NAMES, source: "presentation-preview" };
}

export function presentationRun(runId: string): RunData {
  const entry = (Object.keys(DEFINITIONS) as Scenario[]).find((key) => DEFINITIONS[key].runId === runId);
  if (!entry) throw new Error(`Presentation example not found: ${runId}`);
  const d = DEFINITIONS[entry];
  const tMs = Array.from({ length: N_TICKS }, (_, i) => i * TICK_MS);
  const threads = d.threadIds.map((tid, threadIndex) => {
    const states = statesFor(entry, threadIndex);
    const syscalls = rle(Array.from(states, (state) => state === "F" ? 202 : state === "I" ? (entry === "io" ? 0 : 35) : state === "." ? null : -1));
    return { tid, states, syscalls };
  });
  const alerts = ALERTS[entry];
  const scores: RunData["scores"] = Object.fromEntries(["M1", "M2", "M3"].map((detector) => {
    const alertAt = alerts[detector];
    return [detector, tMs.map((time) => alertAt != null && time >= alertAt ? detector === "M3" ? 1 : 0.9999 : 0.1)];
  }));
  scores.B2 = tMs.map((time) => entry !== "io" && time >= 550 ? time - 500 : 0);
  const outcomes = Object.fromEntries(DETECTORS.map((detector) => {
    const alert = alerts[detector];
    const kind = d.truth === "healthy" ? (alert == null ? "ok_healthy" : "fa_healthy") : (alert == null ? "missed" : "detected");
    return [detector, { kind, delayMs: alert == null || d.t0Ms == null ? null : alert - d.t0Ms }];
  }));
  return {
    runId, family: d.family, split: "test", truth: d.truth, t0Ms: d.t0Ms, source: "presentation-preview",
    reason: `${d.title}. Reconstructed from the project's demo notes for presentation; this is not a raw collected trace.`,
    tickMs: TICK_MS, nTicks: N_TICKS, tMs, threads, futex: tMs.map((time) => threads.filter((thread) => thread.states[Math.round(time / TICK_MS)] === "F").length),
    live: tMs.map((time) => threads.filter((thread) => thread.states[Math.round(time / TICK_MS)] !== ".").length), scores,
    thresholds: { B1: 1500, B2: 50, B3: 0, B4: 1500, M1: 0.9996, M2: 0.9947, M3: 1 }, alerts, outcomes,
    cycleTids: entry === "deadlock" ? d.threadIds.slice(0, 5) : [], tierF: tierF(entry, d.threadIds),
  };
}
