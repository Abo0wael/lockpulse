"use client";

import { useCallback, useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { RunData } from "@/lib/types";
import { DETECTOR_ORDER, DETECTORS, STATES, detectorColor, formatProbability, stateRuns } from "@/lib/replay";
import { formatMs } from "@/lib/utils";

interface TraceTimelineProps {
  run: RunData;
  index: number;
  onChange: (index: number) => void;
}

const ROW = 14; // px per thread row
const DET_ROW = 12; // px per detector alert row
const CHART = 64; // px per score chart
const NINES_CAP = 7; // -log10(1 - p), capped: the export keeps 7 decimals near 1
const B2_CAP_FACTOR = 5; // B2 chart is clipped at 5 x T

/** -log10(1 - p): spreads probabilities near 1 so the frozen threshold (e.g. 0.999994) is visible. */
function nines(p: number): number {
  return Math.min(NINES_CAP, -Math.log10(Math.max(1 - p, 10 ** -NINES_CAP)));
}

/** Polyline segments over the tick axis, broken at nulls (feature-window warm-up). */
function segments(values: (number | null)[], y: (v: number) => number): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  values.forEach((v, i) => {
    if (v == null) { if (cur.length) out.push(cur.join(" ")); cur = []; return; }
    cur.push(`${i + 0.5},${y(v).toFixed(2)}`);
  });
  if (cur.length) out.push(cur.join(" "));
  return out;
}

export default function TraceTimeline({ run, index, onChange }: TraceTimelineProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const n = run.nTicks;
  const duration = run.tMs.at(-1) ?? 0;
  const pct = (tick: number) => `${((tick + 0.5) / n) * 100}%`;
  const tickOf = useCallback((ms: number) => {
    const i = run.tMs.findIndex((t) => t >= ms);
    return i < 0 ? n - 1 : i;
  }, [run.tMs, n]);
  const t0Tick = run.t0Ms == null ? null : tickOf(run.t0Ms);
  const alerts = DETECTOR_ORDER.filter((d) => d in run.outcomes).map((d) => ({ det: d, ms: run.alerts[d] ?? null }));

  const threadRects = useMemo(() => run.threads.map((th) => stateRuns(th.states)), [run.threads]);
  const m3Thr = run.thresholds.M3;
  const b2T = run.thresholds.B2 ?? 50;
  const b2Cap = b2T * B2_CAP_FACTOR;
  const m3Y = (p: number) => CHART - (nines(p) / NINES_CAP) * (CHART - 4) - 2;
  const b2Y = (v: number) => CHART - (Math.min(v, b2Cap) / b2Cap) * (CHART - 4) - 2;
  const m3 = run.scores.M3;
  const b2 = run.scores.B2;
  const m3Segs = useMemo(() => segments(m3 ?? [], (p) => CHART - (nines(p) / NINES_CAP) * (CHART - 4) - 2), [m3]);
  const b2Segs = useMemo(() => segments(b2 ?? [], (v) => CHART - (Math.min(v, b2Cap) / b2Cap) * (CHART - 4) - 2), [b2, b2Cap]);

  // time-axis ticks every 500 ms (1000 ms for long runs)
  const step = duration > 4000 ? 1000 : 500;
  const axis: number[] = [];
  for (let t = 0; t <= duration; t += step) axis.push(t);

  const scrub = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = plotRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width - 1, event.clientX - r.left));
    onChange(Math.floor((x / r.width) * n));
  };

  const plotHeight = run.threads.length * ROW + 10 + alerts.length * DET_ROW + 14 + CHART + 22 + CHART + 18;

  return (
    <section className="lp-panel-interactive rounded-2xl border border-border bg-surface p-4 sm:p-5" aria-labelledby="trace-timeline-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="trace-timeline-title" className="font-semibold">Per-thread timeline</h2>
          <p className="mt-1 text-xs text-muted">Tier P thread state per 5 ms tick, detector alerts, and the M3 and B2 scores. Click or drag to move the cursor.</p>
        </div>
        <p className="font-mono text-xs text-secondary">{formatMs(run.tMs[index])} / {formatMs(duration)}</p>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Thread state colours">
        {(["R", "F", "I", "B", "."] as const).map((s) => (
          <li key={s} className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-4 rounded-sm" style={{ background: STATES[s].color }} />{STATES[s].label}</li>
        ))}
        {run.t0Ms != null && <li className="inline-flex items-center gap-1.5"><i className="inline-block h-3 w-0 border-l-2 border-dashed border-warning" />t0 (ground-truth onset)</li>}
        <li className="inline-flex items-center gap-1.5"><i className="inline-block h-3 w-0.5 bg-text" />cursor</li>
      </ul>

      <div className="mt-4 grid grid-cols-[4.25rem_minmax(0,1fr)] gap-x-2 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-x-3">
        {/* left gutter: row labels, same heights as the plot rows */}
        <div className="font-mono text-[11px] leading-none text-muted" aria-hidden="true">
          {run.threads.map((th) => <div key={th.tid} className="flex items-center truncate" style={{ height: ROW }}>T{th.tid}</div>)}
          <div style={{ height: 10 }} />
          {alerts.map(({ det }) => <div key={det} className="flex items-center gap-1" style={{ height: DET_ROW, color: detectorColor(det) }}>{det}<span className="hidden truncate text-muted sm:inline">alert</span></div>)}
          <div style={{ height: 14 }} />
          <div className="flex flex-col justify-between py-0.5" style={{ height: CHART }}><span style={{ color: detectorColor("M3") }}>M3 score</span><span className="text-[11px]">log</span></div>
          <div style={{ height: 22 }} />
          <div className="flex flex-col justify-between py-0.5" style={{ height: CHART }}><span style={{ color: detectorColor("B2") }}>B2 silence</span><span className="text-[11px]">ms</span></div>
        </div>

        {/* plot column */}
        <div
          ref={plotRef}
          className="relative cursor-crosshair touch-none select-none"
          style={{ height: plotHeight }}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); scrub(e); }}
          onPointerMove={(e) => { if (e.buttons & 1) scrub(e); }}
          role="img"
          aria-label={`Timeline of ${run.threads.length} threads over ${formatMs(duration)}; cursor at ${formatMs(run.tMs[index])}`}
        >
          {/* thread rows */}
          <svg className="block w-full" height={run.threads.length * ROW} viewBox={`0 0 ${n} ${run.threads.length * ROW}`} preserveAspectRatio="none" aria-hidden="true">
            {threadRects.map((runs, row) => runs.map(([s, start, len]) => (
              <rect key={`${row}-${start}`} x={start} y={row * ROW + 2} width={len} height={ROW - 4} fill={STATES[s]?.color ?? STATES.B.color} />
            )))}
          </svg>
          <div style={{ height: 10 }} />
          {/* detector alert rows: a marker at the first alert, then a band while the alert stands */}
          {alerts.map(({ det, ms }) => {
            const color = detectorColor(det);
            if (ms == null) return <div key={det} className="relative" style={{ height: DET_ROW }}><div className="absolute inset-x-0 top-1/2 h-px bg-border" /></div>;
            const tk = tickOf(ms);
            return <div key={det} className="relative" style={{ height: DET_ROW }} title={`${det} ${DETECTORS[det]?.name ?? ""}: alert at ${formatMs(ms)}`}>
              <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
              <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-r" style={{ left: pct(tk), right: 0, background: color, opacity: 0.45 }} />
              <div className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45" style={{ left: pct(tk), background: color }} />
            </div>;
          })}
          <div style={{ height: 14 }} />
          {/* M3 score (probability on a -log10(1-p) axis) with its frozen threshold */}
          <ChartBox>
            <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${n} ${CHART}`} preserveAspectRatio="none" aria-hidden="true">
              {[0.9, 0.999, 0.99999].map((p) => <line key={p} x1={0} x2={n} y1={m3Y(p)} y2={m3Y(p)} stroke="var(--chart-grid)" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
              {m3Thr != null && <line x1={0} x2={n} y1={m3Y(m3Thr)} y2={m3Y(m3Thr)} stroke={detectorColor("M3")} strokeDasharray="4 3" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.8} />}
              {m3Segs.map((pts, i) => <polyline key={i} points={pts} fill="none" stroke={detectorColor("M3")} strokeWidth={1.75} vectorEffect="non-scaling-stroke" />)}
            </svg>
            {m3Thr != null && <span className="absolute right-1 rounded bg-surface/85 px-1 font-mono text-[11px]" style={{ top: Math.max(0, m3Y(m3Thr) - 16), color: detectorColor("M3") }}>threshold {formatProbability(m3Thr)}</span>}
            {(!m3 || m3.every((v) => v == null)) && <span className="absolute inset-0 grid place-items-center text-xs text-muted">no score exported</span>}
          </ChartBox>
          <div className="relative font-mono text-[11px] text-muted" style={{ height: 22 }} aria-hidden="true">
            <span className="absolute inset-x-0 top-0.5 truncate">M3 gridlines: p = 0.9 · 0.999 · 0.99999 (log scale) · no score in the first 50 ms (feature-window warm-up)</span>
          </div>
          {/* B2 futex silence in ms with T */}
          <ChartBox>
            <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${n} ${CHART}`} preserveAspectRatio="none" aria-hidden="true">
              <line x1={0} x2={n} y1={b2Y(b2T)} y2={b2Y(b2T)} stroke={detectorColor("B2")} strokeDasharray="4 3" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.8} />
              {b2Segs.map((pts, i) => <polyline key={i} points={pts} fill="none" stroke={detectorColor("B2")} strokeWidth={1.75} vectorEffect="non-scaling-stroke" />)}
            </svg>
            <span className="absolute right-1 rounded bg-surface/85 px-1 font-mono text-[11px]" style={{ top: Math.max(0, b2Y(b2T) - 16), color: detectorColor("B2") }}>T = {Math.round(b2T)} ms</span>
            <span className="absolute left-1 top-0.5 font-mono text-[11px] text-muted">{Math.round(b2Cap)}+ ms</span>
          </ChartBox>
          {/* time axis */}
          <div className="relative font-mono text-[11px] text-muted" style={{ height: 18 }} aria-hidden="true">
            {axis.map((t) => {
              const left = duration > 0 ? (t / duration) * 100 : 0;
              return <span key={t} className="absolute top-1 -translate-x-1/2 whitespace-nowrap" style={{ left: `${left}%`, display: left > 96 ? "none" : undefined }}>{t === 0 ? "0" : `${t / 1000}s`}</span>;
            })}
          </div>

          {/* overlays spanning every row: t0 and the cursor */}
          {t0Tick != null && <div className="pointer-events-none absolute -top-1 border-l-2 border-dashed border-warning" style={{ left: pct(t0Tick), bottom: 18 }} aria-hidden="true">
            <span className="absolute -top-4 left-1 font-mono text-[11px] font-semibold text-warning">t0</span>
          </div>}
          <div className="pointer-events-none absolute -top-1 w-0.5 -translate-x-1/2 bg-text shadow-[0_0_6px_rgba(0,0,0,0.5)]" style={{ left: pct(index), bottom: 18 }} aria-hidden="true" />
        </div>
      </div>

      {/* alert list: every detector by name, colour, time and delay */}
      <ul className="mt-4 grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2 lg:grid-cols-4" aria-label="Detector alerts">
        {alerts.map(({ det, ms }) => {
          const outcome = run.outcomes[det];
          const passed = ms != null && run.tMs[index] >= ms;
          return <li key={det} className="flex min-w-0 items-start gap-2">
            <i className="mt-1.5 inline-block size-2.5 shrink-0 rotate-45" style={{ background: detectorColor(det), opacity: ms == null ? 0.35 : 1 }} />
            <span className={`min-w-0 ${passed ? "text-text" : "text-muted"}`}>
              <b className="font-mono font-semibold" style={{ color: detectorColor(det) }}>{det}</b> {DETECTORS[det]?.name}
              {" · "}{ms == null ? "no alert" : `alert ${formatMs(ms)}`}
              {outcome?.delayMs != null && ` (delay ${formatMs(outcome.delayMs)})`}
              {outcome?.kind === "fa_healthy" && " · false alarm"}
            </span>
          </li>;
        })}
      </ul>
    </section>
  );
}

function ChartBox({ children }: { children: React.ReactNode }) {
  return <div className="relative overflow-hidden rounded border border-border/70 bg-background/60" style={{ height: CHART }}>{children}</div>;
}
