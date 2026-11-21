import {
  ArrowRight,
  CircleAlert,
  Database,
  Eye,
  Radio,
  ScanSearch,
  Timer,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import ActionLink from "@/components/shared/ActionLink";
import StatusBadge from "@/components/shared/StatusBadge";
import DeadlockAnimation from "@/components/landing/DeadlockAnimation";
import Reveal from "@/components/landing/Reveal";

const steps: {
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
}[] = [
  {
    label: "OBSERVE",
    title: "Read the thread context",
    description: "Pair thread state with CPU activity, context switches, and the current syscall.",
    icon: Radio,
    color: "text-secondary",
  },
  {
    label: "DETECT",
    title: "Separate quiet from stuck",
    description: "Use simple baselines and learned detectors to flag patterns that stop making progress.",
    icon: CircleAlert,
    color: "text-primary",
  },
  {
    label: "INSPECT",
    title: "Review the evidence",
    description: "Replay events and compare detector behavior across controlled benchmark runs.",
    icon: ScanSearch,
    color: "text-success",
  },
];

const readouts = [
  { label: "INPUT SOURCE", value: "/proc sampling", detail: "External thread telemetry", icon: Radio, color: "text-secondary" },
  { label: "SAMPLE CADENCE", value: "5 ms", detail: "Partial telemetry · Tier P", icon: Timer, color: "text-primary" },
  { label: "EVIDENCE VIEW", value: "Trace replay", detail: "States, alerts, events", icon: Database, color: "text-success" },
];

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-hidden bg-background text-text">
        <section className="relative isolate overflow-hidden border-b border-border">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_72%_30%,rgba(99,102,241,0.14),transparent_45%),radial-gradient(ellipse_at_8%_92%,rgba(56,189,248,0.06),transparent_35%)]" />
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:py-24">
            <Reveal className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-3">
                <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-secondary">
                  <span className="h-px w-7 bg-secondary" /> SYSTEM OVERVIEW · LINUX
                </p>
                <StatusBadge tone="preview">RESEARCH PREVIEW</StatusBadge>
              </div>

              <h1 className="mt-6 text-[2.65rem] font-bold leading-[1.04] tracking-[-0.045em] sm:text-6xl lg:text-[4rem]">
                Understand when a quiet system <span className="bg-gradient-to-r from-primary via-indigo-400 to-secondary bg-clip-text text-transparent">stops progressing.</span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
                LockPulse combines thread-state samples with syscall context to investigate hangs that can look like ordinary sleep or blocked I/O.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-4">
                <ActionLink href="/replay" className="group">
                  Open the replay <ArrowRight aria-hidden="true" size={17} className="transition-transform group-hover:translate-x-1" />
                </ActionLink>
                <a href="#overview" className="rounded-md px-2 py-2 text-sm font-medium text-muted transition hover:text-text focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary">
                  How to read LockPulse <span aria-hidden="true" className="ml-1 text-secondary">↓</span>
                </a>
              </div>

              <div className="mt-8 grid gap-2 border-t border-border/80 pt-4 sm:grid-cols-3">
                {readouts.map(({ label, value, detail, icon: Icon, color }) => (
                  <div key={label} className="min-w-0 rounded-lg border border-border/80 bg-background/45 px-3 py-2.5">
                    <div className="flex items-center gap-2"><Icon aria-hidden="true" size={13} className={color} /><span className="font-mono text-[9px] font-semibold tracking-[0.14em] text-muted">{label}</span></div>
                    <p className="mt-2 truncate text-xs font-semibold text-text">{value}</p>
                    <p className="mt-0.5 truncate text-[10px] text-muted">{detail}</p>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.08} className="w-full min-w-0">
              <div className="mb-2 flex items-center justify-between gap-3 px-1 font-mono text-[9px] font-semibold tracking-[0.14em] text-muted">
                <span>LOCKPULSE / TRACE CONSOLE</span>
                <span className="text-warning">ILLUSTRATIVE TRACE</span>
              </div>
              <DeadlockAnimation />
            </Reveal>
          </div>
        </section>

        <section id="overview" aria-labelledby="overview-title" className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20 lg:py-24">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-primary">SIGNAL PIPELINE</p>
              <h2 id="overview-title" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">From sampled state to reviewable evidence.</h2>
            </div>
            <p className="max-w-lg text-sm leading-6 text-muted">Follow the signal from observation to alert, then inspect how it performed in the benchmark.</p>
          </div>

          <div className="mt-9 grid gap-3 md:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Reveal key={step.label} delay={index * 0.05}>
                  <article className="group relative h-full min-h-[190px] overflow-hidden rounded-xl border border-border bg-surface/75 p-5 transition duration-300 hover:-translate-y-1 hover:border-primary/35 hover:bg-surface sm:p-6">
                    <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" />
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-semibold tracking-[0.18em] text-muted">STAGE 0{index + 1} <span className="mx-1 text-border">/</span> {step.label}</span>
                      <span className={`rounded-lg border border-border bg-background p-2.5 transition-transform duration-300 group-hover:rotate-3 group-hover:scale-105 ${step.color}`}><Icon aria-hidden="true" size={18} /></span>
                    </div>
                    <h3 className="mt-6 text-lg font-semibold tracking-tight">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{step.description}</p>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </section>

        <section className="border-t border-border bg-surface/35">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 sm:px-6 sm:py-8 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <span className="rounded-lg border border-secondary/20 bg-secondary/10 p-2 text-secondary"><Eye aria-hidden="true" size={17} /></span>
              <p className="max-w-3xl text-sm leading-6 text-muted">LockPulse is evaluated on a synthetic benchmark. Results describe these workloads; broader programs need their own evaluation.</p>
            </div>
            <ActionLink href="/results" variant="secondary" className="shrink-0 self-start md:self-auto">
              View benchmark results <ArrowRight aria-hidden="true" size={16} />
            </ActionLink>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
