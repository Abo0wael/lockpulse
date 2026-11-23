"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Activity, BellRing, Clock3, UsersRound, type LucideIcon } from "lucide-react";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import Reveal from "@/components/landing/Reveal";
import RunSelector from "@/components/replay/RunSelector";
import PlaybackControls from "@/components/replay/PlaybackControls";
import Timeline from "@/components/replay/Timeline";
import TraceTimeline from "@/components/replay/TraceTimeline";
import TraceSummary from "@/components/replay/TraceSummary";
import ThreadPanel from "@/components/replay/ThreadPanel";
import DetectorPanel from "@/components/replay/DetectorPanel";
import EventLog from "@/components/replay/EventLog";
import WaitForGraph from "@/components/replay/WaitForGraph";
import { loadRun, loadRunIndex } from "@/lib/data";
import type { RunData, RunIndex } from "@/lib/types";
import { formatMs } from "@/lib/utils";
import { defaultTick, tickAt } from "@/lib/replay";

export default function ReplayPage() {
  const reduceMotion = useReducedMotion();
  const [indexData, setIndexData] = useState<RunIndex | null>(null);
  const [run, setRun] = useState<RunData | null>(null);
  const [runId, setRunId] = useState("");
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState("");

  const pendingTime = useRef<number | null>(null);
  useEffect(() => { loadRunIndex().then((data) => {
    setIndexData(data);
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("run");
    const t = Number(params.get("t"));
    if (params.has("t") && Number.isFinite(t)) pendingTime.current = t;
    setRunId(fromUrl && data.runs.some((r) => r.runId === fromUrl) ? fromUrl : data.default || data.runs[0]?.runId || "");
  }).catch((e: Error) => setError(e.message)); }, []);
  useEffect(() => { if (!runId) return; loadRun(runId).then((data) => {
    setRun(data); setError("");
    const t = pendingTime.current; pendingTime.current = null;
    setPosition(t == null ? defaultTick(data) : tickAt(data.tMs, t));
  }).catch((e: Error) => { setRun(null); setError(e.message); }); }, [runId]);
  // keep ?run= and ?t= in the URL so a view can be linked (replaceState: no history spam while scrubbing)
  useEffect(() => {
    if (!run || playing) return;
    const url = new URL(window.location.href);
    url.searchParams.set("run", run.runId);
    url.searchParams.set("t", String(Math.round(run.tMs[position] ?? 0)));
    window.history.replaceState(null, "", url);
  }, [run, position, playing]);
  useEffect(() => {
    if (!playing || !run || position >= run.nTicks - 1) return;
    const timer = window.setTimeout(() => setPosition((current) => Math.min(current + 1, run.nTicks - 1)), Math.max(25, run.tickMs / speed));
    return () => window.clearTimeout(timer);
  }, [playing, position, run, speed]);

  const reset = useCallback(() => { setPlaying(false); setPosition(0); }, []);
  const timeMs = run?.tMs[position] ?? 0;
  const isPlaying = Boolean(playing && run && position < run.nTicks - 1);
  const alertTimes = run ? Object.values(run.alerts).filter((value): value is number => value != null) : [];
  const seek = useCallback((value: number) => { setPlaying(false); setPosition(value); }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, [contenteditable='true']"))) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

      if (event.code === "Space") {
        if (!run) return;
        event.preventDefault();
        if (isPlaying) {
          setPlaying(false);
        } else {
          if (position >= run.nTicks - 1) setPosition(0);
          setPlaying(true);
        }
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        if (!run) return;
        event.preventDefault();
        setPlaying(false);
        setPosition((current) => Math.max(0, Math.min(run.nTicks - 1, current + (event.key === "ArrowRight" ? 1 : -1))));
      } else if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        reset();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, position, reset, run]);

  return <><Navbar/><main className="flex-1 bg-background text-text">
    <PageHeader eyebrow="Trace control / Replay mode" title="Inspect a run, sample by sample." description="Move through the trace and watch thread state, futex waits, and detector alerts update together." tone="violet"/>
    <div className="lp-container space-y-7 py-10 sm:py-12 lg:py-14">
      {indexData && <Reveal><div className="lp-panel-interactive grid gap-4 rounded-2xl border border-border bg-surface/80 p-4 shadow-xl shadow-black/10 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:p-5"><RunSelector runs={indexData.runs} value={runId} onChange={(id) => { setPlaying(false); setRunId(id); }}/>{run && <div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-muted">{run.split}</span><StatusBadge tone={run.truth}>{run.truth}</StatusBadge><span className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-muted">{run.threads.length} threads</span></div>}</div></Reveal>}
      {error && <div role="status" className="rounded-xl border border-warning/30 bg-warning/5 p-5"><h2 className="font-semibold text-warning">Replay data is not available</h2><p className="mt-2 text-sm leading-6 text-muted">The replay interface is ready, but this checkout does not include exported trace JSON. Generate it with <code className="rounded bg-background px-1.5 py-0.5 text-text">python -m ml.export_web</code> after restoring the collected dataset.</p><p className="mt-2 break-all text-xs text-muted">{error}</p></div>}
      {run && <>
        {run.source === "presentation-preview" && <aside role="note" className="rounded-2xl border border-warning/35 bg-warning/5 p-4 shadow-lg shadow-warning/5 sm:p-5"><p className="text-sm font-semibold text-warning">Presentation preview · reconstructed walkthrough</p><p className="mt-1 text-xs leading-5 text-muted">The project’s collected trace files are absent from this checkout. These timelines illustrate the scenarios and detector behavior described in the demo notes; sample-by-sample details are illustrative, not raw measurements.</p></aside>}
        <Reveal key={`readouts-${runId}`} delay={0.03}><section aria-label="Current trace readouts" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MonitorReadout icon={Clock3} label="Playhead" value={formatMs(timeMs, 0)} detail={`Sample ${position + 1} of ${run.nTicks}`} color="violet" reduceMotion={reduceMotion}/>
          <MonitorReadout icon={UsersRound} label="Live threads" value={`${run.live[position]}`} detail={`of ${run.threads.length} in this trace`} color="cyan" reduceMotion={reduceMotion}/>
          <MonitorReadout icon={Activity} label="Futex waiters" value={`${run.futex[position]}`} detail="Threads waiting at this sample" color="amber" reduceMotion={reduceMotion}/>
          <MonitorReadout icon={BellRing} label="Alerts by cursor" value={`${alertTimes.filter((time) => time <= timeMs).length}`} detail={`of ${Object.keys(run.alerts).length} detector alerts`} color="rose" reduceMotion={reduceMotion}/>
        </section></Reveal>
        <Reveal key={`overview-${runId}`}><div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]"><TraceSummary run={run}/><div className="lp-panel-interactive rounded-2xl border border-border bg-surface/80 p-4 shadow-lg shadow-black/10 sm:p-5"><p className="mb-3 text-xs text-muted">Keys: Space play/pause · ← → step one 5 ms tick · R reset.</p><PlaybackControls playing={isPlaying} onToggle={() => { if (!isPlaying && position >= run.nTicks - 1) setPosition(0); setPlaying(!isPlaying); }} onReset={reset} speed={speed} onSpeed={setSpeed}/></div></div></Reveal>
        <Reveal key={`timeline-${runId}`} delay={0.05}><Timeline times={run.tMs} index={position} t0Ms={run.t0Ms} onChange={seek} alerts={run.alerts}/></Reveal>
        <Reveal key={`trace-${runId}`} delay={0.05}><TraceTimeline run={run} index={position} onChange={seek}/></Reveal>
        <div className="grid gap-5 xl:grid-cols-2"><Reveal key={`${runId}-threads`}><ThreadPanel run={run} index={position} syscallNames={indexData?.syscallNames ?? {}}/></Reveal><Reveal key={`${runId}-detectors`} delay={0.04}><DetectorPanel run={run} timeMs={timeMs}/></Reveal><Reveal key={`${runId}-graph`} delay={0.08}><WaitForGraph run={run} timeMs={timeMs}/></Reveal><Reveal key={`${runId}-events`} delay={0.12}><EventLog run={run} timeMs={timeMs}/></Reveal></div>
        <p className="text-right text-xs text-muted">Cursor: {formatMs(timeMs)} · ground truth: {run.truth}{run.t0Ms != null ? ` from ${formatMs(run.t0Ms)}` : ""}</p>
      </>}
    </div></main><Footer/></>;
}

function MonitorReadout({ icon: Icon, label, value, detail, color, reduceMotion }: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  color: "violet" | "cyan" | "amber" | "rose";
  reduceMotion: boolean | null;
}) {
  const accents = {
    violet: "text-primary bg-primary/10 border-primary/20",
    cyan: "text-secondary bg-secondary/10 border-secondary/20",
    amber: "text-warning bg-warning/10 border-warning/20",
    rose: "text-danger bg-danger/10 border-danger/20",
  };

  return <motion.article whileHover={reduceMotion ? undefined : { y: -2 }} transition={{ duration: 0.18 }} className="lp-panel-interactive group relative min-w-0 rounded-2xl border border-border bg-surface/60 px-5 py-5 sm:px-6 sm:py-6">
    <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[11px] font-semibold text-muted">{label}</p><p className="mt-3 font-mono text-3xl font-semibold tabular-nums tracking-tight text-text sm:text-4xl">{value}</p><p className="mt-2 text-sm leading-6 text-muted">{detail}</p></div><span className={`grid size-10 shrink-0 place-items-center border ${accents[color]}`}><Icon size={18} strokeWidth={1.8}/></span></div>
    <div className="relative mt-4 h-px overflow-hidden bg-border"><motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.7, delay: 0.1 }} className={`h-full origin-left ${color === "violet" ? "bg-secondary" : color === "cyan" ? "bg-secondary" : color === "amber" ? "bg-warning" : "bg-danger"}`}/></div>
  </motion.article>;
}
