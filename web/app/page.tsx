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
  { value: "91/91", label: "Hang detections", detail: "B2 · M2 · M3 · held-out hangs", icon: Activity, accent: "text-success" },
  { value: "0", label: "False alarms", detail: "B2 · M2 · M3 · 89 healthy test runs", icon: ShieldCheck, accent: "text-success" },
  { value: "47–69 ms", label: "Median detection delay", detail: "M2 47 · M3 55 · B2 69 ms", icon: Clock3, accent: "text-secondary" },
  { value: "13", label: "Benchmark families", detail: "7 hang scenarios · 6 hard negatives", icon: Layers3, accent: "text-primary" },
];

const pages: {
  href: string;
  number: string;
  title: string;
  description: string;
  icon: LucideIcon;
  label: string;
}[] = [
  { href: "/replay", number: "01", title: "Replay", description: "Move through a run: thread states, detector alerts, and synchronization events.", icon: Play, label: "INSPECT A RUN" },
  { href: "/results", number: "02", title: "Results", description: "Compare frozen detectors across the held-out benchmark.", icon: BarChart3, label: "MEASURE PERFORMANCE" },
  { href: "/why-syscall", number: "03", title: "Why Syscall", description: "Understand how syscall context separates sleep from blocked waits.", icon: Activity, label: "READ THE SIGNAL" },
  { href: "/method", number: "04", title: "Methodology", description: "Trace the benchmark, telemetry tiers, detectors, and evaluation protocol.", icon: BookOpen, label: "FOLLOW THE METHOD" },
];

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-hidden bg-background text-text">
        <section className="relative isolate overflow-hidden border-b border-border">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_78%_34%,rgba(99,102,241,0.17),transparent_46%),linear-gradient(90deg,transparent_58%,rgba(56,189,248,0.025))]" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-[5.5%] hidden w-px bg-gradient-to-b from-transparent via-border to-transparent xl:block" />

          <div className="mx-auto grid max-w-[1440px] gap-10 px-5 pb-12 pt-12 sm:px-8 sm:pb-16 sm:pt-16 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:gap-9 lg:px-10 lg:py-20 xl:px-16 xl:py-24">
            <Reveal className="relative z-10 max-w-xl lg:pl-2">
              <p className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-secondary sm:text-xs">
                <span className="h-px w-8 bg-secondary" /> Linux thread observability <span className="text-muted/60">/ 01</span>
              </p>
              <h1 className="mt-7 max-w-[11ch] text-[3.35rem] font-semibold leading-[0.96] tracking-[-0.065em] sm:text-6xl lg:text-[4.4rem] xl:text-[5.15rem]">
                When progress <span className="text-primary">breaks,</span> find where.
              </h1>
              <p className="mt-7 max-w-md border-l border-primary/50 pl-4 text-base leading-7 text-muted sm:text-lg sm:leading-8">
                LockPulse reads thread state and syscall context to tell a real hang from a worker that is simply sleeping or waiting on I/O.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/replay" className="lp-button-primary group w-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary sm:w-auto">
                  Explore a run <ArrowRight aria-hidden="true" size={17} className="transition-transform group-hover:translate-x-1" />
                </Link>
                <Link href="/method" className="lp-button-secondary w-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary sm:w-auto">
                  How it works <ArrowUpRight aria-hidden="true" size={16} className="text-muted" />
                </Link>
              </div>
              <div className="mt-9 flex flex-wrap gap-x-5 gap-y-3 font-mono text-[10px] uppercase tracking-[0.13em] text-muted sm:text-[11px]">
                <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-success" /> External sampling</span>
                <span>5 ms cadence</span>
                <span>Research benchmark</span>
              </div>
            </Reveal>

            <Reveal delay={0.08} className="relative min-w-0 lg:-mr-6 xl:-mr-10">
              <div aria-hidden="true" className="absolute -inset-6 -z-10 bg-[radial-gradient(ellipse_at_52%_50%,rgba(99,102,241,0.12),transparent_68%)]" />
              <DeadlockAnimation />
              <div className="mt-3 flex items-center justify-between gap-3 px-1 font-mono text-[9px] uppercase tracking-[0.14em] text-muted/80 sm:text-[10px]">
                <span>Wait relationship / ownership relationship</span>
                <span className="hidden sm:inline">Illustrative graph · not a live process</span>
              </div>
            </Reveal>
          </div>
        </section>

        <section aria-labelledby="metrics-title" className="relative border-b border-border bg-[#0e1017]">
          <div className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 sm:py-12 lg:px-10 xl:px-16">
            <div className="mb-6 flex flex-col gap-2 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Experimental readout / held-out test</p>
                <h2 id="metrics-title" className="mt-2 text-lg font-medium tracking-tight text-text sm:text-xl">Frozen detector configurations</h2>
              </div>
              <p className="max-w-md text-xs leading-5 text-muted">B2 futex-silence rule, M2 random forest, and M3 gradient boosting. Synthetic benchmark results, not a production guarantee.</p>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4 md:gap-x-0">
              {metrics.map((metric, index) => {
                const Icon = metric.icon;
                return (
                  <Reveal key={metric.label} delay={index * 0.06} className={`min-w-0 ${index % 2 === 1 ? "border-l border-border pl-4 sm:pl-6 md:pl-7" : ""} ${index >= 2 ? "md:border-l md:border-border md:pl-7" : ""}`}>
                    <div className="flex min-h-[106px] flex-col justify-between gap-2 pr-2 sm:min-h-[118px] sm:pr-5">
                      <div className="flex items-center justify-between gap-2">
                        <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted sm:text-[10px] sm:tracking-[0.16em]">{metric.label}</dt>
                        <Icon aria-hidden="true" size={15} className={`hidden shrink-0 sm:block ${metric.accent}`} />
                      </div>
                      <dd className={`text-3xl font-semibold tracking-[-0.055em] sm:text-4xl lg:text-[2.6rem] ${metric.accent}`}>{metric.value}</dd>
                      <p className="text-[10px] leading-4 text-muted sm:text-xs">{metric.detail}</p>
                    </div>
                  </Reveal>
                );
              })}
            </dl>
          </div>
        </section>

        <section aria-labelledby="explore-title" className="relative mx-auto grid max-w-[1440px] gap-9 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16 lg:px-10 lg:py-24 xl:px-16">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Navigate the signal</p>
            <h2 id="explore-title" className="mt-4 max-w-[12ch] text-3xl font-semibold leading-[1.06] tracking-[-0.045em] sm:text-4xl lg:text-[3.25rem]">
              From a sampled signal to an explainable result.
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-6 text-muted">
              Move from a concrete run to the benchmark evidence, then into the reasoning behind the detector.
            </p>
            <div className="mt-8 hidden items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted lg:flex">
              <span className="h-px w-10 bg-border" /> Four paths through LockPulse
            </div>
          </Reveal>

          <nav aria-label="Explore LockPulse" className="min-w-0">
            <ol className="border-t border-border">
              {pages.map((page, index) => {
                const Icon = page.icon;
                const featured = index === 0;
                return (
                  <li key={page.href}>
                    <Reveal delay={index * 0.055}>
                      <Link
                        href={page.href}
                        className={`group relative grid min-w-0 grid-cols-[2.4rem_1fr_auto] items-center gap-3 border-b border-border px-1 py-5 transition-colors hover:bg-white/[0.02] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-secondary sm:grid-cols-[3rem_1fr_auto] sm:gap-5 ${featured ? "sm:py-7" : "sm:py-5"}`}
                      >
                        <span className={`font-mono text-xs tracking-widest ${featured ? "text-primary" : "text-muted/70"}`}>{page.number}</span>
                        <span className="flex min-w-0 items-center gap-3 sm:gap-4">
                          <span className={`grid h-10 w-10 shrink-0 place-items-center border transition-colors sm:h-11 sm:w-11 ${featured ? "border-primary/35 bg-primary/10 text-primary group-hover:bg-primary/15" : "border-border bg-surface/60 text-muted group-hover:border-secondary/35 group-hover:text-secondary"}`}>
                            <Icon aria-hidden="true" size={18} />
                          </span>
                          <span className="min-w-0">
                            <span className={`block truncate font-semibold tracking-tight text-text ${featured ? "text-xl sm:text-2xl" : "text-base sm:text-lg"}`}>{page.title}</span>
                            <span className="mt-1 block font-mono text-[8px] uppercase tracking-[0.14em] text-muted sm:text-[9px]">{page.label}</span>
                            <span className="mt-2 hidden max-w-lg text-sm leading-5 text-muted sm:block">{page.description}</span>
                          </span>
                        </span>
                        <ArrowRight aria-hidden="true" size={17} className="text-muted transition duration-200 group-hover:translate-x-1 group-hover:text-secondary" />
                      </Link>
                    </Reveal>
                  </li>
                );
              })}
            </ol>
          </nav>
        </section>

        <section className="border-t border-border bg-[#0e1017]">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-5 py-7 sm:px-8 sm:py-8 md:flex-row md:items-center md:justify-between lg:px-10 xl:px-16">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 border-l-2 border-secondary px-3 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-secondary">Hard negatives</span>
              <p className="max-w-3xl text-xs leading-5 text-muted sm:text-sm sm:leading-6">Sleeping workers, heavy contention, long critical sections, and blocked I/O help test whether quiet threads are actually hung.</p>
            </div>
            <Link href="/why-syscall" className="group inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-text transition hover:text-secondary">
              Why syscall context? <ArrowRight aria-hidden="true" size={16} className="text-secondary transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
