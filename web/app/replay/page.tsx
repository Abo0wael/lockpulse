"use client";

import { useCallback, useEffect, useState } from "react";
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
import ThreadPanel from "@/components/replay/ThreadPanel";
import DetectorPanel from "@/components/replay/DetectorPanel";
import EventLog from "@/components/replay/EventLog";
import WaitForGraph from "@/components/replay/WaitForGraph";
import { loadRun, loadRunIndex } from "@/lib/data";
import type { RunData, RunIndex } from "@/lib/types";
import { formatMs } from "@/lib/utils";

export default function ReplayPage() {
  const reduceMotion = useReducedMotion();
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
    <PageHeader eyebrow="TRACE CONTROL ROOM · REPLAY MODE" title="Inspect a run, sample by sample." description="Move through the trace and watch thread state, futex waits, and detector alerts update together." tone="violet"/>
    <div className="mx-auto max-w-7xl space-y-5 px-5 py-8 sm:px-6 sm:py-10">
      {indexData && <Reveal><div className="grid gap-4 rounded-2xl border border-border bg-surface/80 p-4 shadow-xl shadow-black/10 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:p-5"><RunSelector runs={indexData.runs} value={runId} onChange={(id) => { setPlaying(false); setPosition(0); setRunId(id); }}/>{run && <div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-muted">{run.split}</span><StatusBadge tone={run.truth}>{run.truth}</StatusBadge><span className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-muted">{run.threads.length} threads</span></div>}</div></Reveal>}
      {error && <div role="status" className="rounded-xl border border-warning/30 bg-warning/5 p-5"><h2 className="font-semibold text-warning">Replay data is not available</h2><p className="mt-2 text-sm leading-6 text-muted">The replay interface is ready, but this checkout does not include exported trace JSON. Generate it with <code className="rounded bg-background px-1.5 py-0.5 text-text">python -m ml.export_web</code> after restoring the collected dataset.</p><p className="mt-2 break-all text-xs text-muted">{error}</p></div>}
      {run && <>
        {run.source === "presentation-preview" && <aside role="note" className="rounded-2xl border border-warning/35 bg-warning/5 p-4 shadow-lg shadow-warning/5 sm:p-5"><p className="text-sm font-semibold text-warning">Presentation preview · reconstructed walkthrough</p><p className="mt-1 text-xs leading-5 text-muted">The project’s collected trace files are absent from this checkout. These timelines illustrate the scenarios and detector behavior described in the demo notes; sample-by-sample details are illustrative, not raw measurements.</p></aside>}
        <Reveal key={`readouts-${runId}`} delay={0.03}><section aria-label="Current trace readouts" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MonitorReadout icon={Clock3} label="Playhead" value={formatMs(timeMs, 0)} detail={`Sample ${position + 1} of ${run.nTicks}`} color="violet" reduceMotion={reduceMotion}/>
          <MonitorReadout icon={UsersRound} label="Live threads" value={`${run.live[position]}`} detail={`of ${run.threads.length} in this trace`} color="cyan" reduceMotion={reduceMotion}/>
          <MonitorReadout icon={Activity} label="Futex waiters" value={`${run.futex[position]}`} detail="Threads waiting at this sample" color="amber" reduceMotion={reduceMotion}/>
          <MonitorReadout icon={BellRing} label="Alerts by cursor" value={`${alertTimes.filter((time) => time <= timeMs).length}`} detail={`of ${Object.keys(run.alerts).length} detector alerts`} color="rose" reduceMotion={reduceMotion}/>
        </section></Reveal>
        <Reveal key={`overview-${runId}`}><div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]"><div className="rounded-2xl border border-border bg-surface/80 p-4 shadow-lg shadow-black/10 sm:p-5"><p className="text-xs font-semibold uppercase tracking-wider text-secondary">{run.source === "presentation-preview" ? "Presentation scenario" : "Selected recorded trace"}</p><h2 className="mt-2 font-mono text-sm font-semibold">{run.runId}</h2><p className="mt-2 text-xs leading-5 text-muted">{run.reason || run.family.replaceAll("_", " ")} · {run.nTicks} samples at {run.tickMs} ms intervals</p></div><div className="rounded-2xl border border-border bg-surface/80 p-4 shadow-lg shadow-black/10 sm:p-5"><PlaybackControls playing={isPlaying} onToggle={() => { if (!isPlaying && position >= run.nTicks - 1) setPosition(0); setPlaying(!isPlaying); }} onReset={reset} speed={speed} onSpeed={setSpeed}/></div></div></Reveal>
        <Reveal key={`timeline-${runId}`} delay={0.05}><Timeline times={run.tMs} index={position} t0Ms={run.t0Ms} onChange={(value) => { setPlaying(false); setPosition(value); }} alertTimes={alertTimes}/></Reveal>
        <div className="grid gap-5 xl:grid-cols-2"><Reveal key={`${runId}-threads`}><ThreadPanel run={run} index={position}/></Reveal><Reveal key={`${runId}-detectors`} delay={0.04}><DetectorPanel run={run} timeMs={timeMs}/></Reveal><Reveal key={`${runId}-graph`} delay={0.08}><WaitForGraph run={run} timeMs={timeMs}/></Reveal><Reveal key={`${runId}-events`} delay={0.12}><EventLog run={run} timeMs={timeMs}/></Reveal></div>
        <p className="text-right text-xs text-muted">Cursor: {formatMs(timeMs, 2)} · ground truth: {run.truth}{run.t0Ms != null ? ` from ${formatMs(run.t0Ms, 2)}` : ""}</p>
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
    violet: "text-secondary bg-secondary/10 border-secondary/20",
    cyan: "text-cyan-300 bg-cyan-400/10 border-cyan-400/20",
    amber: "text-warning bg-warning/10 border-warning/20",
    rose: "text-danger bg-danger/10 border-danger/20",
  };

  return <motion.article whileHover={reduceMotion ? undefined : { y: -3 }} transition={{ duration: 0.18 }} className="group relative overflow-hidden rounded-2xl border border-border bg-surface/80 p-4 shadow-lg shadow-black/10 sm:p-5">
    <div className="pointer-events-none absolute -right-7 -top-8 h-24 w-24 rounded-full bg-white/[0.025] blur-2xl transition-transform duration-500 group-hover:scale-150"/>
    <div className="relative flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p><p className="mt-3 font-mono text-2xl font-semibold tabular-nums tracking-tight text-text sm:text-3xl">{value}</p><p className="mt-1.5 text-xs leading-5 text-muted">{detail}</p></div><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${accents[color]}`}><Icon size={18} strokeWidth={1.8}/></span></div>
    <div className="relative mt-4 h-px overflow-hidden bg-border"><motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.7, delay: 0.1 }} className={`h-full origin-left ${color === "violet" ? "bg-secondary" : color === "cyan" ? "bg-cyan-300" : color === "amber" ? "bg-warning" : "bg-danger"}`}/></div>
  </motion.article>;
}
