import { Activity, ArrowRight, Clock3, Layers3, Radio, ShieldCheck, Timer } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import ActionLink from "@/components/shared/ActionLink";
import DeadlockAnimation from "@/components/landing/DeadlockAnimation";
import Reveal from "@/components/landing/Reveal";
import ThreadComparison from "@/components/landing/ThreadComparison";

const metrics: {
  value: string;
  label: string;
  detail: string;
  icon: LucideIcon;
  tone: string;
}[] = [
  { value: "91/91", label: "Hang detections", detail: "Each: B2 · M2 · M3 on held-out hangs", icon: Activity, tone: "text-success" },
  { value: "0", label: "False alarms", detail: "Each: B2 · M2 · M3 across 89 healthy runs", icon: ShieldCheck, tone: "text-success" },
  { value: "47–69 ms", label: "Median detection delay", detail: "M2 47 ms · M3 55 ms · B2 69 ms", icon: Clock3, tone: "text-secondary" },
  { value: "13", label: "Benchmark families", detail: "7 hang scenarios · 6 hard negatives", icon: Layers3, tone: "text-primary" },
];

const readouts = [
  { label: "INPUT SOURCE", value: "/proc sampling", detail: "External thread telemetry", icon: Radio, color: "text-secondary" },
  { label: "SAMPLE CADENCE", value: "5 ms", detail: "Partial telemetry · Tier P", icon: Timer, color: "text-primary" },
  { label: "EVIDENCE VIEW", value: "Trace replay", detail: "States, alerts, events", icon: Activity, color: "text-success" },
];

const pipeline: {
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
}[] = [
  {
    label: "OBSERVE",
    title: "Read thread context",
    description: "Pair thread state with CPU activity, context switches, and the current syscall.",
    icon: Radio,
    color: "text-secondary",
  },
  {
    label: "DETECT",
    title: "Separate quiet from stuck",
    description: "Apply baseline rules and learned detectors to identify patterns that stop making progress.",
    icon: Activity,
    color: "text-primary",
  },
  {
    label: "INSPECT",
    title: "Review the evidence",
    description: "Replay thread states, detector alerts, and synchronization events from a recorded run.",
    icon: ShieldCheck,
    color: "text-success",
  },
];

const destinations = [
  { href: "/replay", label: "Replay", detail: "Move through a run sample by sample.", type: "TRACE CONTROL" },
  { href: "/results", label: "Results", detail: "Compare detector performance by split and family.", type: "EVALUATION" },
  { href: "/why-syscall", label: "Why Syscall", detail: "See why quiet CPU time needs thread context.", type: "SIGNAL INTERPRETATION" },
  { href: "/method", label: "Methodology", detail: "Follow collection, labeling, and test protocol.", type: "EXPERIMENT DESIGN" },
] as const;

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-hidden bg-background text-text">
        <section aria-labelledby="hero-title" className="relative isolate overflow-hidden border-b border-border">
          <div aria-hidden="true" className="lp-grid-field pointer-events-none absolute inset-0 -z-10 opacity-30" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-56 top-12 -z-10 size-[42rem] rounded-full bg-[radial-gradient(circle,rgba(140,124,255,0.10),transparent_68%)]" />

          <div className="lp-container relative grid items-center gap-12 py-12 sm:gap-14 sm:py-16 lg:py-20 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] xl:gap-12 xl:py-16">
            <Reveal className="relative z-10 max-w-2xl xl:py-6">
              <h1 id="hero-title" className="lp-display mt-7 max-w-[10ch] sm:mt-9">
                <span className="block">Detect the</span>
                <span className="block text-secondary">silence.</span>
                <span className="mt-5 block max-w-[15ch] text-[clamp(1.85rem,3.4vw,3.1rem)] font-medium leading-[1.05] tracking-[-0.055em] text-text sm:mt-6">Understand the <span className="text-primary">deadlock.</span></span>
              </h1>
              <p className="lp-copy-lead mt-6 border-l border-secondary/50 pl-4 sm:mt-7">
                LockPulse analyzes thread-state telemetry and syscall context to distinguish real hangs from legitimate sleeping and waiting.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3 sm:mt-8">
                <ActionLink href="/replay" className="group min-h-12 px-5">
                  Inspect a recorded run <ArrowRight aria-hidden="true" size={17} className="transition-transform group-hover:translate-x-1" />
                </ActionLink>
                <a href="#evidence" className="lp-button-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary">
                  View held-out evidence <span aria-hidden="true">↓</span>
                </a>
              </div>
              <dl className="mt-9 grid grid-cols-1 gap-2 sm:mt-11 sm:grid-cols-3 sm:gap-3">
                {readouts.map(({ label, value, detail, icon: Icon, color }) => (
                  <div key={label} className="lp-panel-quiet grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-x-3 gap-y-1 rounded-xl p-3 sm:block sm:p-3">
                    <dt className="row-span-2 flex items-center gap-2 font-mono text-[11px] font-medium leading-4 tracking-[0.05em] text-muted sm:min-h-8 sm:items-start sm:text-xs"><Icon aria-hidden="true" size={14} className={`shrink-0 ${color}`} /><span>{label}</span></dt>
                    <dd className="col-start-2 row-start-1 text-sm font-semibold leading-5 text-text sm:mt-2">{value}</dd>
                    <p className="col-start-2 row-start-2 text-xs leading-5 text-muted">{detail}</p>
                  </div>
                ))}
              </dl>
            </Reveal>

            <Reveal delay={0.08} className="relative min-w-0">
              <DeadlockAnimation />
            </Reveal>
          </div>
        </section>

        <section id="evidence" aria-labelledby="evidence-title" className="scroll-mt-24 border-b border-border bg-surface/55">
          <div className="lp-container py-10 sm:py-12 lg:py-14">
            <div className="mb-5 flex flex-col gap-3 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="lp-kicker">Research evidence / held-out test</p>
                <h2 id="evidence-title" className="mt-2 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">Measured on this benchmark.</h2>
              </div>
              <p className="max-w-xl text-xs leading-5 text-muted sm:text-sm">Frozen B2 futex-silence rule, M2 random forest, and M3 gradient boosting. Synthetic benchmark results; not a production guarantee.</p>
            </div>

            <dl className="lp-metric-grid" aria-label="Held-out benchmark metrics">
              {metrics.map((metric, index) => {
                const Icon = metric.icon;
                return (
                  <Reveal key={metric.label} delay={index * 0.06} className="lp-metric-cell min-w-0">
                    <div className="flex min-h-[112px] min-w-0 flex-col justify-between gap-3 py-4 sm:min-h-[132px] sm:py-5">
                      <div className="flex items-center justify-between gap-2">
                        <dt className="lp-data-label text-[11px] sm:text-[11px]">{metric.label}</dt>
                        <Icon aria-hidden="true" size={15} className={`hidden shrink-0 sm:block ${metric.tone}`} />
                      </div>
                      <dd className={`lp-metric-value min-w-0 ${metric.tone}`}>{metric.value}</dd>
                      <p className="text-[11px] leading-4 text-muted sm:text-[11px] sm:leading-5">{metric.detail}</p>
                    </div>
                  </Reveal>
                );
              })}
            </dl>
            <p className="mt-6 border-t border-border/70 pt-3 text-[11px] leading-5 text-muted sm:text-xs">Held-out test scope: 91 hangs and 89 healthy runs across three held-out benchmark families.</p>
          </div>
        </section>

        <section id="overview" aria-labelledby="overview-title" className="relative border-b border-border">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(66,220,232,0.025)_50%,transparent_100%)]" />
          <div className="lp-container relative py-16 sm:py-20 lg:py-24">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <p className="lp-kicker">01 / Signal path</p>
                <h2 id="overview-title" className="lp-section-heading mt-4">From sampled state to reviewable evidence.</h2>
              </div>
              <p className="max-w-lg text-sm leading-7 text-muted sm:text-base">Follow the system from observation, through detector analysis, to an inspectable recorded run.</p>
            </div>
            <ol className="mt-10 grid gap-3 sm:gap-4 md:grid-cols-3">
              {pipeline.map((step, index) => {
                const Icon = step.icon;
                return (
                  <li key={step.label} className="lp-panel lp-panel-interactive min-w-0 rounded-2xl">
                    <Reveal delay={index * 0.07} className="group flex h-full min-h-[190px] flex-col p-5 sm:min-h-[205px] sm:p-6 lg:p-7">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] font-semibold tracking-[0.07em] text-muted">0{index + 1}</span>
                        <span aria-hidden="true" className="h-px flex-1 bg-border transition-colors group-hover:bg-secondary/55" />
                        <Icon aria-hidden="true" size={17} className={`shrink-0 ${step.color}`} />
                        <span className="lp-data-label">{step.label}</span>
                      </div>
                      <h3 className="mt-7 text-xl font-semibold tracking-[-0.035em] sm:text-2xl">{step.title}</h3>
                      <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{step.description}</p>
                    </Reveal>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section aria-labelledby="quiet-title" className="relative border-b border-border">
          <div aria-hidden="true" className="lp-grid-field pointer-events-none absolute inset-0 -z-10 opacity-20" />
          <div className="lp-container relative py-16 sm:py-20 lg:py-24">
            <div className="mb-9 grid gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-end lg:gap-14">
              <Reveal>
                <p className="lp-kicker">02 / Signal ambiguity</p>
                <h2 id="quiet-title" className="lp-section-heading mt-4 max-w-[11ch]">Quiet is not a diagnosis.</h2>
              </Reveal>
              <Reveal delay={0.06}>
                <p className="max-w-2xl text-sm leading-7 text-muted sm:text-base">A healthy worker can be mostly idle and still resume. A hung worker can look just as quiet while remaining blocked. Thread state and syscall context help explain what CPU inactivity alone cannot.</p>
              </Reveal>
            </div>
            <Reveal delay={0.08}><ThreadComparison /></Reveal>
          </div>
        </section>

        <section id="explore" aria-labelledby="explore-title" className="border-b border-border bg-surface/55">
          <div className="lp-container grid gap-10 py-16 sm:py-20 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16 lg:py-24">
            <Reveal className="self-start lg:sticky lg:top-32">
              <p className="lp-kicker">03 / Inspect the evidence</p>
              <h2 id="explore-title" className="lp-section-heading mt-4 max-w-[10ch]">Observe the wait. Understand why progress stopped.</h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-muted">LockPulse combines sampled thread state and syscall context with a separate synchronization trace to examine wait relationships.</p>
            </Reveal>
            <nav aria-label="Explore LockPulse" className="border-t border-border">
              <ol>
                {destinations.map((destination, index) => (
                  <li key={destination.href} className="border-b border-border">
                    <Reveal delay={index * 0.04}>
                      <Link href={destination.href} className="group grid min-h-[92px] grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 py-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-secondary sm:min-h-[100px] sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:gap-5 sm:py-5">
                        <span className="font-mono text-[11px] tracking-[0.07em] text-primary/85">0{index + 1}</span>
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-lg font-semibold tracking-[-0.03em] text-text transition-colors group-hover:text-secondary sm:text-xl">{destination.label}</span>
                            <span className="lp-data-label text-[11px]">{destination.type}</span>
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-muted sm:text-sm">{destination.detail}</span>
                        </span>
                        <ArrowRight aria-hidden="true" size={17} className="text-muted transition-transform group-hover:translate-x-1 group-hover:text-secondary" />
                      </Link>
                    </Reveal>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        </section>

        <section className="border-t border-border bg-surface/35">
          <div className="lp-container flex flex-col gap-4 py-6 sm:py-7 md:flex-row md:items-center md:justify-between">
            <p className="max-w-3xl text-xs leading-5 text-muted sm:text-sm">LockPulse is evaluated on a synthetic benchmark. These results describe the tested workloads and do not guarantee performance on other programs.</p>
            <a href="#evidence" className="inline-flex min-h-10 shrink-0 items-center gap-2 self-start rounded-md px-2 text-sm font-semibold text-secondary transition hover:text-sky-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary md:self-auto">
              Review benchmark evidence <ArrowRight aria-hidden="true" size={16} />
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
