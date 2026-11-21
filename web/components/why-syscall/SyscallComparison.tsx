import { Activity, Moon, Pause, Waves } from "lucide-react";

const healthyTicks = ["work", "sleep", "sleep", "work", "sleep", "work"];
const hangTicks = ["futex", "futex", "futex", "futex", "futex", "futex"];

function StateStrip({ states }: { states: string[] }) {
  return (
    <div className="mt-5 grid grid-cols-6 gap-2" aria-hidden="true">
      {states.map((state, index) => (
        <div
          key={`${state}-${index}`}
          className={`flex min-h-14 flex-col items-center justify-center rounded-lg border text-[10px] font-semibold uppercase tracking-wide sm:text-xs ${
            state === "work"
              ? "border-success/25 bg-success/10 text-success"
              : state === "sleep"
                ? "border-secondary/25 bg-secondary/10 text-secondary"
                : "border-danger/25 bg-danger/10 text-danger"
          }`}
        >
          <span className="font-mono">{state === "work" ? "RUN" : state === "sleep" ? "SLEEP" : "FUTEX"}</span>
          <span className="mt-1 font-mono opacity-60">t{index + 1}</span>
        </div>
      ))}
    </div>
  );
}

export default function SyscallComparison() {
  return (
    <section aria-labelledby="sleeping-vs-hanging" className="mx-auto max-w-7xl px-5 py-20 sm:px-6 lg:py-24">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary">THE AMBIGUITY</p>
        <h2 id="sleeping-vs-hanging" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Quiet CPU can mean two very different things.
        </h2>
        <p className="mt-4 leading-7 text-muted">
          CPU inactivity only says that threads are not using processor time. It does not say whether they are
          taking a planned pause or are unable to make progress.
        </p>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <span className="rounded-xl border border-secondary/25 bg-secondary/10 p-3 text-secondary">
              <Moon aria-hidden="true" size={21} />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-secondary">HEALTHY PAUSE</p>
              <h3 className="mt-1 text-xl font-semibold">Sleeping workers</h3>
            </div>
          </div>
          <p className="mt-5 text-sm leading-6 text-muted">
            Workers may sleep between jobs, then wake and run again. During the pause, CPU use is low, but the
            sampled syscall can show a sleep such as <code className="font-mono text-secondary">nanosleep</code>.
          </p>
          <figure className="mt-2">
            <StateStrip states={healthyTicks} />
            <figcaption className="mt-3 flex items-center gap-2 text-xs text-muted">
              <Activity aria-hidden="true" size={14} className="text-success" />
              Work resumes after the planned sleep.
            </figcaption>
          </figure>
        </article>

        <article className="rounded-2xl border border-danger/20 bg-surface p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <span className="rounded-xl border border-danger/25 bg-danger/10 p-3 text-danger">
              <Pause aria-hidden="true" size={21} />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-danger">NO PROGRESS</p>
              <h3 className="mt-1 text-xl font-semibold">Threads in a hang</h3>
            </div>
          </div>
          <p className="mt-5 text-sm leading-6 text-muted">
            In the benchmark hangs, live threads remain blocked and the program does not progress. Repeated
            <code className="font-mono text-danger"> futex </code> waits provide context a CPU-only view cannot.
          </p>
          <figure className="mt-2">
            <StateStrip states={hangTicks} />
            <figcaption className="mt-3 flex items-center gap-2 text-xs text-muted">
              <Waves aria-hidden="true" size={14} className="text-danger" />
              The sampled wait pattern stays blocked.
            </figcaption>
          </figure>
        </article>
      </div>

      <p className="mt-4 text-xs text-muted/80">
        Conceptual illustration of the distinction; the state strips are not individual exported runs.
      </p>
    </section>
  );
}
