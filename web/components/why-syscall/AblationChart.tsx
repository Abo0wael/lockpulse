const data = [
  { detector: "M2 · Random forest", variant: "With syscall features", detected: 91, total: 91, tone: "bg-success" },
  { detector: "M2 · Random forest", variant: "Without syscall features", detected: 0, total: 91, tone: "bg-danger" },
  { detector: "M3 · Gradient boosting", variant: "With syscall features", detected: 91, total: 91, tone: "bg-success" },
  { detector: "M3 · Gradient boosting", variant: "Without syscall features", detected: 0, total: 91, tone: "bg-danger" },
] as const;

export default function AblationChart() {
  return (
    <figure className="rounded-2xl border border-border bg-surface p-5 sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-primary">HELD-OUT TEST · 91 HANG RUNS</p>
          <h3 className="mt-2 text-xl font-semibold">Hang detections by feature set</h3>
        </div>
        <p className="text-xs text-muted">Each bar is scaled to 91 detections.</p>
      </div>

      <div className="mt-8 space-y-7" aria-hidden="true">
        {data.map((row) => (
          <div key={`${row.detector}-${row.variant}`}>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-sm font-medium text-text">{row.detector}</span>
              <span className="text-xs text-muted">{row.variant}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-background">
                <div
                  className={`h-full rounded-full ${row.tone}`}
                  style={{ width: `${(row.detected / row.total) * 100}%` }}
                />
              </div>
              <span className={`w-14 text-right font-mono text-sm font-semibold ${row.detected ? "text-success" : "text-danger"}`}>
                {row.detected}/{row.total}
              </span>
            </div>
          </div>
        ))}
      </div>

      <table className="sr-only">
        <caption>Held-out test hang detections with and without syscall features, out of 91 hang runs.</caption>
        <thead>
          <tr><th scope="col">Detector</th><th scope="col">Feature set</th><th scope="col">Hang detections</th></tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={`${row.detector}-${row.variant}`}>
              <th scope="row">{row.detector}</th><td>{row.variant}</td><td>{row.detected} of {row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <figcaption className="mt-7 border-t border-border pt-5 text-sm leading-6 text-muted">
        With features selected on the training data and thresholds chosen on validation, both models detected
        all 91 held-out test hangs with syscall features. Removing those features resulted in 0/91 detections
        for each model. These are results on this project’s benchmark, not a production performance guarantee.
      </figcaption>
    </figure>
  );
}
