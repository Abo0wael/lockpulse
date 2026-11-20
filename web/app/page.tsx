import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Clock3,
  Layers3,
  Play,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import DeadlockAnimation from "@/components/landing/DeadlockAnimation";
import Reveal from "@/components/landing/Reveal";

const metrics: {
  value: string;
  label: string;
  detail: string;
  icon: LucideIcon;
  accent: string;
}[] = [
  {
    value: "91/91",
    label: "Hang detections",
    detail: "Each: B2 · M2 · M3 on the held-out hangs",
    icon: Activity,
    accent: "text-success",
  },
  {
    value: "0",
    label: "False alarms",
    detail: "Each: B2 · M2 · M3 across 89 healthy test runs",
    icon: ShieldCheck,
    accent: "text-success",
  },
  {
    value: "47–69 ms",
    label: "Median detection delay",
    detail: "M2 47 · M3 55 · B2 69 ms",
    icon: Clock3,
    accent: "text-secondary",
  },
  {
    value: "13",
    label: "Benchmark families",
    detail: "7 hang scenarios · 6 hard negatives",
    icon: Layers3,
    accent: "text-primary",
  },
];

const pages: {
  href: string;
  number: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
}[] = [
  {
    href: "/replay",
    number: "01",
    title: "Replay",
    description: "Scrub through a run to inspect thread states, detector alerts, and synchronization events.",
    icon: Play,
    color: "text-secondary",
  },
  {
    href: "/results",
    number: "02",
    title: "Results",
    description: "Compare detector performance across the held-out test benchmark.",
    icon: BarChart3,
    color: "text-success",
  },
  {
    href: "/why-syscall",
    number: "03",
    title: "Why Syscall",
    description: "See how syscall context helps separate sleeping workers from hangs.",
    icon: Activity,
    color: "text-primary",
  },
  {
    href: "/method",
    number: "04",
    title: "Methodology",
    description: "Follow the benchmark design, telemetry tiers, detectors, and evaluation.",
    icon: BookOpen,
    color: "text-warning",
  },
];

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-hidden bg-background text-text">
        <section className="relative isolate border-b border-border">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_72%_30%,rgba(99,102,241,0.14),transparent_45%),radial-gradient(ellipse_at_8%_92%,rgba(56,189,248,0.06),transparent_35%)]" />
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:gap-12 lg:py-24">
            <Reveal className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-secondary">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
                SYSTEM HANG DETECTION · LINUX
              </div>

              <h1 className="mt-7 text-[2.7rem] font-bold leading-[1.06] tracking-[-0.045em] sm:text-6xl lg:text-[4.25rem]">
                Find the moment a system stops <span className="bg-gradient-to-r from-primary via-indigo-400 to-secondary bg-clip-text text-transparent">making progress.</span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
                LockPulse samples thread state and syscall context to distinguish real hangs from workers that
                are simply sleeping or waiting on I/O.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/replay"
                  className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary"
                >
                  Explore a run <ArrowRight aria-hidden="true" size={17} className="transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/method"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border bg-surface/70 px-5 py-3 text-sm font-semibold text-text transition hover:border-secondary/50 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary"
                >
                  How it works <ArrowUpRight aria-hidden="true" size={16} className="text-muted" />
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
                <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-success" />External thread sampling</span>
                <span className="hidden h-3 w-px bg-border sm:block" />
                <span>5 ms sample interval</span>
                <span className="hidden h-3 w-px bg-border sm:block" />
                <span>Research benchmark</span>
              </div>
            </Reveal>

            <Reveal delay={0.08} className="w-full min-w-0">
              <DeadlockAnimation />
            </Reveal>
          </div>
        </section>

        <section aria-labelledby="metrics-title" className="border-b border-border bg-[#0e1017]">
          <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 sm:py-16">
            <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] text-primary">HELD-OUT TEST SNAPSHOT</p>
                <h2 id="metrics-title" className="mt-2 text-xl font-semibold sm:text-2xl">Results from the frozen detector configurations</h2>
              </div>
              <p className="max-w-md text-xs leading-5 text-muted">B2 futex-silence rule, M2 random forest, and M3 gradient boosting. Synthetic benchmark results; not a production guarantee.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric, index) => {
                const Icon = metric.icon;
                return (
                  <Reveal key={metric.label} delay={index * 0.045}>
                    <article className="group relative h-full overflow-hidden rounded-xl border border-border bg-surface p-5 transition duration-200 hover:-translate-y-1 hover:border-primary/40 hover:bg-[#171b26]">
                      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition group-hover:opacity-100" />
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">{metric.label}</p>
                          <p className={`mt-3 text-3xl font-bold tracking-tight sm:text-[2rem] ${metric.accent}`}>{metric.value}</p>
                        </div>
                        <span className={`rounded-lg border border-border bg-background p-2.5 ${metric.accent}`}><Icon aria-hidden="true" size={18} /></span>
                      </div>
                      <p className="mt-3 border-t border-border pt-3 text-xs leading-5 text-muted">{metric.detail}</p>
                    </article>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <section aria-labelledby="explore-title" className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20 lg:py-24">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-primary">EXPLORE LOCKPULSE</p>
              <h2 id="explore-title" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">From a sampled signal to an explainable result.</h2>
            </div>
            <p className="max-w-lg text-sm leading-6 text-muted">Inspect a run, compare frozen detectors, and see the experimental choices behind the analysis.</p>
          </div>

          <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {pages.map((page, index) => {
              const Icon = page.icon;
              return (
                <Reveal key={page.href} delay={index * 0.05}>
                  <Link
                    href={page.href}
                    className="group flex h-full min-h-[240px] flex-col rounded-2xl border border-border bg-surface/75 p-5 transition duration-200 hover:-translate-y-1 hover:border-primary/45 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary sm:p-6"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs tracking-widest text-muted/70">{page.number}</span>
                      <span className={`rounded-xl border border-border bg-background p-3 transition group-hover:border-primary/30 ${page.color}`}><Icon aria-hidden="true" size={19} /></span>
                    </div>
                    <h3 className="mt-8 text-xl font-semibold tracking-tight transition group-hover:text-text">{page.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-6 text-muted">{page.description}</p>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-secondary">
                      Open section <ArrowRight aria-hidden="true" size={15} className="transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </section>

        <section className="border-t border-border bg-surface/35">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <span className="rounded-lg border border-secondary/20 bg-secondary/10 p-2 text-secondary"><Activity aria-hidden="true" size={17} /></span>
              <p className="max-w-3xl text-sm leading-6 text-muted">
                The benchmark includes hard negatives such as sleeping workers, heavy contention, long critical sections, and blocked I/O.
              </p>
            </div>
            <Link href="/why-syscall" className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-secondary transition hover:text-sky-300">
              Why syscall features? <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
