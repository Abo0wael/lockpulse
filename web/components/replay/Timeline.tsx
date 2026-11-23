import { DETECTORS, detectorColor } from "@/lib/replay";
import { formatMs } from "@/lib/utils";

interface TimelineProps {
  times: number[];
  index: number;
  t0Ms: number | null;
  onChange: (index: number) => void;
  /** First alert time per detector (null = no alert). */
  alerts: Record<string, number | null>;
}

/** Range scrubber with the t0 marker and one coloured, named marker per detector alert. */
export default function Timeline({ times, index, t0Ms, onChange, alerts }: TimelineProps) {
  const duration = times.at(-1) ?? 0;
  const current = times[index] ?? 0;
  const range = duration > 0 ? (current / duration) * 100 : 0;
  const at = (time: number) => `${duration > 0 ? Math.max(0, Math.min(100, (time / duration) * 100)) : 0}%`;
  const fired = Object.entries(alerts).filter((entry): entry is [string, number] => entry[1] != null).sort((a, b) => a[1] - b[1]);

  return (
    <section className="lp-panel-interactive rounded-2xl border border-border bg-surface p-4 sm:p-5" aria-label="Run scrubber">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Scrubber</h2>
        <p className="font-mono text-xs text-secondary">{formatMs(current)} / {formatMs(duration)}</p>
      </div>
      <div className="relative mt-4">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded bg-background" aria-hidden="true">
          <div className="h-full rounded bg-primary/70" style={{ width: `${range}%` }} />
        </div>
        {t0Ms != null && <span className="pointer-events-none absolute top-1/2 z-10 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-warning" style={{ left: at(t0Ms) }} title={`t0 (ground-truth onset): ${formatMs(t0Ms)}`} aria-hidden="true" />}
        {fired.map(([det, time]) => (
          <span key={det} className="pointer-events-none absolute top-1/2 z-10 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 ring-1 ring-surface" style={{ left: at(time), background: detectorColor(det) }} title={`${det} alert: ${formatMs(time)}`} aria-hidden="true" />
        ))}
        <input
          type="range"
          min={0}
          max={Math.max(0, times.length - 1)}
          step={1}
          value={Math.min(index, Math.max(0, times.length - 1))}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
          aria-label="Replay position"
          aria-valuetext={`${formatMs(current)} of ${formatMs(duration)}`}
          className="relative z-20 h-7 w-full cursor-pointer appearance-none bg-transparent accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {t0Ms != null && <li className="inline-flex items-center gap-1.5"><i className="inline-block h-3 w-0.5 bg-warning" />t0 · {formatMs(t0Ms)}</li>}
        {fired.map(([det, time]) => <li key={det} className="inline-flex items-center gap-1.5"><i className="inline-block size-2 rotate-45" style={{ background: detectorColor(det) }} /><b className="font-mono font-semibold" style={{ color: detectorColor(det) }}>{det}</b> {DETECTORS[det]?.name} · {formatMs(time)}</li>)}
        {fired.length === 0 && <li>No detector alerted in this run.</li>}
      </ul>
    </section>
  );
}
