"use client";

import { useCallback, useEffect, useState } from "react";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import RunSelector from "@/components/replay/RunSelector";
import PlaybackControls from "@/components/replay/PlaybackControls";
import Timeline from "@/components/replay/Timeline";
import ThreadPanel from "@/components/replay/ThreadPanel";
import DetectorPanel from "@/components/replay/DetectorPanel";
import EventLog from "@/components/replay/EventLog";
import WaitForGraph from "@/components/replay/WaitForGraph";
import { loadRun, loadRunIndex } from "@/lib/data";
import type { RunData, RunIndex } from "@/lib/types";
import { formatMs } from "@/lib/utils";

export default function ReplayPage() {
  const [indexData, setIndexData] = useState<RunIndex | null>(null);
  const [run, setRun] = useState<RunData | null>(null);
  const [runId, setRunId] = useState("");
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => { loadRunIndex().then((data) => { setIndexData(data); setRunId(data.default || data.runs[0]?.runId || ""); }).catch((e: Error) => setError(e.message)); }, []);
  useEffect(() => { if (!runId) return; loadRun(runId).then((data) => { setRun(data); setError(""); }).catch((e: Error) => { setRun(null); setError(e.message); }); }, [runId]);
  useEffect(() => {
    if (!playing || !run || position >= run.nTicks - 1) return;
    const timer = window.setTimeout(() => setPosition((current) => Math.min(current + 1, run.nTicks - 1)), Math.max(25, run.tickMs / speed));
    return () => window.clearTimeout(timer);
  }, [playing, position, run, speed]);

  const reset = useCallback(() => { setPlaying(false); setPosition(0); }, []);
  const timeMs = run?.tMs[position] ?? 0;
  const isPlaying = Boolean(playing && run && position < run.nTicks - 1);
  const alertTimes = run ? Object.values(run.alerts).filter((value): value is number => value != null) : [];
  return <><Navbar/><main className="flex-1 bg-background text-text"><header className="border-b border-border bg-[radial-gradient(ellipse_at_80%_10%,rgba(99,102,241,0.15),transparent_50%)]"><div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 sm:py-14"><p className="text-xs font-semibold tracking-[0.18em] text-secondary">RECORDED TRACE EXPLORER</p><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Replay a run, tick by tick.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Inspect sampled thread states beside detector alerts and synchronization events from the same recorded run.</p></div></header>
    <div className="mx-auto max-w-7xl space-y-5 px-5 py-8 sm:px-6 sm:py-10">
      {indexData && <div className="grid gap-4 rounded-xl border border-border bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:p-5"><RunSelector runs={indexData.runs} value={runId} onChange={(id) => { setPlaying(false); setPosition(0); setRunId(id); }}/>{run && <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full border border-border px-3 py-1.5 text-muted">{run.split}</span><span className={`rounded-full border px-3 py-1.5 ${run.truth === "healthy" ? "border-success/30 text-success" : "border-danger/30 text-danger"}`}>{run.truth}</span><span className="rounded-full border border-border px-3 py-1.5 text-muted">{run.threads.length} threads</span></div>}</div>}
      {error && <div role="status" className="rounded-xl border border-warning/30 bg-warning/5 p-5"><h2 className="font-semibold text-warning">Replay data is not available</h2><p className="mt-2 text-sm leading-6 text-muted">The replay interface is ready, but this checkout does not include exported trace JSON. Generate it with <code className="rounded bg-background px-1.5 py-0.5 text-text">python -m ml.export_web</code> after restoring the collected dataset.</p><p className="mt-2 break-all text-xs text-muted">{error}</p></div>}
      {run && <>
        {run.source === "presentation-preview" && <aside role="note" className="rounded-xl border border-warning/35 bg-warning/5 p-4 sm:p-5"><p className="text-sm font-semibold text-warning">Presentation preview · reconstructed walkthrough</p><p className="mt-1 text-xs leading-5 text-muted">The project’s collected trace files are absent from this checkout. These timelines illustrate the scenarios and detector behavior described in the demo notes; sample-by-sample details are illustrative, not raw measurements.</p></aside>}
        <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]"><div className="rounded-xl border border-border bg-surface p-4 sm:p-5"><p className="text-xs text-muted">{run.source === "presentation-preview" ? "Presentation scenario" : "Selected recorded trace"}</p><h2 className="mt-1 font-mono text-sm font-semibold">{run.runId}</h2><p className="mt-2 text-xs leading-5 text-muted">{run.reason || run.family.replaceAll("_", " ")} · {run.nTicks} samples at {run.tickMs} ms intervals</p></div><div className="rounded-xl border border-border bg-surface p-4 sm:p-5"><PlaybackControls playing={isPlaying} onToggle={() => { if (!isPlaying && position >= run.nTicks - 1) setPosition(0); setPlaying(!isPlaying); }} onReset={reset} speed={speed} onSpeed={setSpeed}/></div></div>
        <Timeline times={run.tMs} index={position} t0Ms={run.t0Ms} onChange={(value) => { setPlaying(false); setPosition(value); }} alertTimes={alertTimes}/>
        <div className="grid gap-5 xl:grid-cols-2"><ThreadPanel run={run} index={position}/><DetectorPanel run={run} timeMs={timeMs}/><WaitForGraph run={run} timeMs={timeMs}/><EventLog run={run} timeMs={timeMs}/></div>
        <p className="text-right text-xs text-muted">Cursor: {formatMs(timeMs, 2)} · ground truth: {run.truth}{run.t0Ms != null ? ` from ${formatMs(run.t0Ms, 2)}` : ""}</p>
      </>}
    </div></main><Footer/></>;
}
