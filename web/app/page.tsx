
import Link from "next/link";

const metrics = [
  { value: "91 / 91", label: "Hangs detected", color: "text-success" },
  { value: "0", label: "False alarms", color: "text-success" },
  { value: "50–70 ms", label: "Detection delay", color: "text-secondary" },
  { value: "13", label: "Benchmark families", color: "text-warning" },
];

const pages = [
  {
    href: "/replay",
    number: "01",
    title: "Run Replay",
    description: "Explore execution timelines, thread states and detector alerts.",
  },
  {
    href: "/results",
    number: "02",
    title: "Results",
    description: "Compare detector performance across unseen test runs.",
  },
  {
    href: "/why-syscall",
    number: "03",
    title: "Why Syscalls?",
    description: "Understand why system call information matters for detection.",
  },
  {
    href: "/method",
    number: "04",
    title: "Methodology",
    description: "Explore the benchmark, detectors and evaluation process.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-text">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Lock<span className="text-primary">Pulse</span>
            <span className="ml-2 text-xs font-normal text-muted">
              SYSTEM MONITOR
            </span>
          </Link>

          <div className="hidden items-center gap-7 text-sm text-muted md:flex">
            <Link href="/replay" className="transition hover:text-primary">Replay</Link>
            <Link href="/results" className="transition hover:text-primary">Results</Link>
            <Link href="/why-syscall" className="transition hover:text-primary">Why Syscalls?</Link>
            <Link href="/method" className="transition hover:text-primary">Method</Link>
          </div>

          <Link
            href="/replay"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Explore Replay →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto grid max-w-7xl gap-14 px-6 py-24 md:grid-cols-2 md:items-center md:py-32">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-secondary">
            <span className="h-2 w-2 rounded-full bg-success" />
            SYSTEM PROGRAMMING PROJECT
          </div>

          <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-7xl">
            Detect the
            <br />
            <span className="text-primary">invisible</span>
            <br />
            system hangs.
          </h1>

          <p className="mt-7 max-w-xl text-lg leading-8 text-muted">
            LockPulse is a system hang detection and analysis framework.
            It combines passive system monitoring with syscall-level
            instrumentation to identify hangs and understand what caused them.
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <Link
              href="/replay"
              className="rounded-lg bg-primary px-6 py-3 font-semibold text-white transition hover:bg-indigo-500"
            >
              Explore a Run →
            </Link>

            <Link
              href="/method"
              className="rounded-lg border border-border px-6 py-3 font-medium text-text transition hover:border-secondary hover:bg-surface"
            >
              How It Works
            </Link>
          </div>

          <p className="mt-6 text-xs text-muted">
            Research project · Linux system monitoring · Deadlock detection
          </p>
        </div>

        {/* Deadlock Visualization */}
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-2xl shadow-black/30">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <p className="text-sm font-semibold">Deadlock detected</p>
              <p className="mt-1 text-xs text-muted">
                Illustrative wait-for relationship
              </p>
            </div>

            <span className="rounded-full border border-danger/30 bg-danger/10 px-3 py-1 text-xs text-danger">
              DEADLOCK
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 py-8">
            <div className="rounded-xl border border-secondary/20 bg-secondary/5 p-4">
              <p className="text-xs text-secondary">THREAD 01</p>
              <p className="mt-3 text-lg font-semibold">Thread A</p>

              <div className="mt-5 rounded-lg bg-background p-3">
                <p className="text-xs text-muted">Holds</p>
                <p className="mt-1 font-mono text-sm text-success">Lock A</p>
              </div>

              <p className="mt-3 text-xs text-muted">Waiting for Lock B</p>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-xs text-primary">THREAD 02</p>
              <p className="mt-3 text-lg font-semibold">Thread B</p>

              <div className="mt-5 rounded-lg bg-background p-3">
                <p className="text-xs text-muted">Holds</p>
                <p className="mt-1 font-mono text-sm text-success">Lock B</p>
              </div>

              <p className="mt-3 text-xs text-muted">Waiting for Lock A</p>
            </div>
          </div>

          <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-center">
            <p className="font-mono text-sm text-danger">
              Thread A → Lock B → Thread B → Lock A
            </p>
            <p className="mt-2 text-xs text-muted">
              Circular wait · Neither thread can proceed
            </p>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-muted">
            <span>Wait-for graph</span>
            <span className="text-danger">Cycle found</span>
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section className="border-y border-border bg-surface/50">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="mb-8">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary">
              TEST RESULTS
            </p>
            <h2 className="mt-3 text-2xl font-bold">
              Performance at a glance
            </h2>
            <p className="mt-2 text-sm text-muted">
              Results on the project's frozen, unseen test set.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-xl border border-border bg-surface p-5"
              >
                <p className={`text-2xl font-bold md:text-3xl ${metric.color}`}>
                  {metric.value}
                </p>
                <p className="mt-2 text-sm text-muted">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Project Pages */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary">
          EXPLORE LOCKPULSE
        </p>

        <h2 className="mt-3 text-3xl font-bold">
          Understand every layer.
        </h2>

        <p className="mt-4 max-w-2xl leading-7 text-muted">
          Explore benchmark data, inspect execution behavior and understand
          how LockPulse identifies system hangs.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {pages.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="group rounded-xl border border-border bg-surface p-6 transition hover:-translate-y-1 hover:border-primary/60"
            >
              <p className="font-mono text-sm text-secondary">
                {page.number}
              </p>

              <h3 className="mt-8 text-xl font-semibold transition group-hover:text-primary">
                {page.title}
              </h3>

              <p className="mt-3 text-sm leading-6 text-muted">
                {page.description}
              </p>

              <p className="mt-6 text-sm text-primary">Explore →</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 px-6 py-8 text-sm text-muted sm:flex-row">
          <p>
            <span className="font-semibold text-text">LockPulse</span>
            {" "}— System Hang Detection & Analysis
          </p>
          <p>System Programming Project · 2026</p>
        </div>
      </footer>

    </main>
  );
}
