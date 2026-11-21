import { formatMs } from "@/lib/utils";

interface TimelineProps {
  times: number[];
  index: number;
  t0Ms: number | null;
  onChange: (index: number) => void;
  alertTimes: number[];
}

export default function Timeline({ times, index, t0Ms, onChange, alertTimes }: TimelineProps) {
  const duration = times.at(-1) ?? 0;
  const current = times[index] ?? 0;
  const range = duration > 0 ? (current / duration) * 100 : 0;
  const markers = [
    ...(t0Ms == null ? [] : [{ time: t0Ms, label: "Ground-truth onset" }]),
    ...alertTimes.map((time, i) => ({ time, label: `Detector alert ${i + 1}` })),
  ];

  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5" aria-label="Run timeline">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Run timeline</h2>
        <p className="font-mono text-xs text-secondary">{formatMs(current, 2)} / {formatMs(duration, 2)}</p>
      </div>
      <div className="relative mt-4">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded bg-background" aria-hidden="true">
          <div className="h-full rounded bg-primary/70" style={{ width: `${range}%` }} />
        </div>
        {markers.map(({ time, label }, markerIndex) => (
          <span
            key={`${label}-${markerIndex}`}
            className={`pointer-events-none absolute top-1/2 z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface ${label === "Ground-truth onset" ? "bg-warning" : "bg-danger"}`}
            style={{ left: `${duration > 0 ? Math.max(0, Math.min(100, (time / duration) * 100)) : 0}%` }}
            title={`${label}: ${formatMs(time, 2)}`}
            aria-hidden="true"
          />
        ))}
        <input
          type="range"
          min={0}
          max={Math.max(0, times.length - 1)}
          step={1}
          value={Math.min(index, Math.max(0, times.length - 1))}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
          aria-label="Replay position"
          aria-valuetext={`${formatMs(current, 2)} of ${formatMs(duration, 2)}`}
          className="relative z-20 h-7 w-full cursor-pointer appearance-none bg-transparent accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {t0Ms != null && <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-warning" />Ground-truth onset</span>}
        {alertTimes.map((time, i) => <span key={`${time}-${i}`}><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-danger" />Detector alert · {formatMs(time, 1)}</span>)}
      </div>
    </section>
  );
}
