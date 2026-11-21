import Link from "next/link";
import { Activity, ArrowRight, Clock3, Layers3, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
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
  { value: "91/91", label: "Hang detections", detail: "B2 · M2 · M3 · held-out hangs", icon: Activity, tone: "text-success" },
  { value: "0", label: "False alarms", detail: "B2 · M2 · M3 · across 89 healthy runs", icon: ShieldCheck, tone: "text-success" },
  { value: "47–69 ms", label: "Median detection delay", detail: "M2 47 ms · M3 55 ms · B2 69 ms", icon: Clock3, tone: "text-secondary" },
  { value: "13", label: "Benchmark families", detail: "7 hang scenarios · 6 hard negatives", icon: Layers3, tone: "text-primary" },
];

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-hidden bg-background text-text">
        <section aria-labelledby="hero-title" className="relative isolate overflow-hidden border-b border-border">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_77%_42%,rgba(84,76,186,0.18),transparent_45%),linear-gradient(90deg,transparent_45%,rgba(66,220,232,0.035))]" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-[4.5%] hidden w-px bg-gradient-to-b from-transparent via-border-strong/70 to-transparent xl:block" />

          <div className="lp-container grid items-center gap-9 pb-12 pt-10 sm:gap-12 sm:pb-16 sm:pt-14 lg:grid-cols-[0.78fr_1.22fr] lg:gap-8 lg:py-16 xl:gap-12 xl:py-20">
            <Reveal className="relative z-10 max-w-2xl lg:pl-2">
              <p className="lp-kicker"><span className="lp-kicker-line" />Linux thread observability <span className="text-muted/70">/ SYSTEMS INTELLIGENCE</span></p>
              <h1 id="hero-title" className="mt-6 max-w-[12ch] text-[3.15rem] font-semibold leading-[0.94] tracking-[-0.065em] sm:mt-8 sm:text-6xl lg:text-[4.4rem] xl:text-[5.45rem]">
                Detect the silence.<br /><span className="text-secondary">Understand the</span> <span className="text-primary">deadlock.</span>
              </h1>
              <p className="mt-6 max-w-xl border-l border-secondary/50 pl-4 text-base leading-7 text-muted sm:mt-7 sm:text-lg sm:leading-8">
                LockPulse analyzes thread-state telemetry and syscall context to distinguish real hangs from legitimate sleeping and waiting.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-4 sm:mt-8">
                <Link href="/replay" className="lp-button-primary group min-h-12 px-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary">
                  Explore a recorded run <ArrowRight aria-hidden="true" size={17} className="transition-transform group-hover:translate-x-1" />
                </Link>
                <a href="#evidence" className="group inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-medium text-muted transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary">
                  View held-out evidence <span aria-hidden="true" className="text-secondary transition-transform group-hover:translate-y-0.5">↓</span>
                </a>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-border/80 pt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted sm:mt-9 sm:gap-x-6">
                <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="size-1.5 rounded-full bg-secondary" />5 ms external sampling</span>
                <span>Linux · pthreads</span>
                <span>Held-out benchmark</span>
              </div>
            </Reveal>

            <Reveal delay={0.08} className="relative min-w-0 lg:-mr-4 xl:-mr-8">
              <div aria-hidden="true" className="absolute -inset-8 -z-10 bg-[radial-gradient(ellipse_at_50%_48%,rgba(87,82,198,0.17),transparent_66%)]" />
              <DeadlockAnimation />
              <p className="mt-3 px-1 text-right font-mono text-[9px] uppercase tracking-[0.12em] text-muted/75 sm:text-[10px]">
                Two-thread mutex cycle · illustrative sequence · not host monitoring
              </p>
            </Reveal>
          </div>
        </section>

        <section id="evidence" aria-labelledby="evidence-title" className="scroll-mt-24 border-b border-border bg-[#0b1019]">
          <div className="lp-container py-10 sm:py-12 lg:py-14">
            <div className="mb-6 flex flex-col gap-3 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="lp-kicker"><span className="lp-kicker-line" />Research evidence / held-out test</p>
                <h2 id="evidence-title" className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">Measured on this benchmark.</h2>
              </div>
              <p className="max-w-xl text-xs leading-5 text-muted sm:text-sm">Frozen B2 futex-silence rule, M2 random forest, and M3 gradient boosting. Synthetic benchmark results; not a production guarantee.</p>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4 md:gap-x-0 md:gap-y-0">
              {metrics.map((metric, index) => {
                const Icon = metric.icon;
                return (
                  <Reveal key={metric.label} delay={index * 0.07} className={`min-w-0 ${index % 2 === 1 ? "border-l border-border pl-4 sm:pl-6 md:pl-7" : ""} ${index >= 2 ? "md:border-l md:border-border md:pl-7" : ""}`}>
                    <div className="flex min-h-[112px] flex-col justify-between gap-2 pr-2 sm:min-h-[128px] sm:pr-5 md:px-5 md:first:pl-0">
                      <div className="flex items-center justify-between gap-2">
                        <dt className="font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-muted sm:text-[10px] sm:tracking-[0.15em]">{metric.label}</dt>
                        <Icon aria-hidden="true" size={16} className={`hidden shrink-0 sm:block ${metric.tone}`} />
                      </div>
                      <dd className={`whitespace-nowrap text-[2rem] font-semibold leading-none tracking-[-0.06em] sm:text-4xl lg:text-[2.55rem] ${metric.tone}`}>{metric.value}</dd>
                      <p className="text-[10px] leading-4 text-muted sm:text-xs sm:leading-5">{metric.detail}</p>
                    </div>
                  </Reveal>
                );
              })}
            </dl>
            <p className="mt-6 border-t border-border/70 pt-3 text-[11px] leading-5 text-muted sm:text-xs">Held-out test scope: 91 hangs and 89 healthy runs across three held-out benchmark families.</p>
          </div>
        </section>

        <section aria-labelledby="quiet-title" className="relative border-b border-border">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_16%_42%,rgba(66,220,232,0.055),transparent_42%)]" />
          <div className="lp-container relative py-14 sm:py-18 lg:py-24">
            <div className="mb-8 grid gap-5 lg:grid-cols-[0.75fr_1.25fr] lg:items-end lg:gap-12">
              <Reveal>
                <p className="lp-kicker"><span className="lp-kicker-line" />Quiet does not mean stuck</p>
                <h2 id="quiet-title" className="mt-4 max-w-[12ch] text-3xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-4xl lg:text-[3.35rem]">One quiet CPU. Two different stories.</h2>
              </Reveal>
              <Reveal delay={0.06}>
                <p className="max-w-2xl text-sm leading-7 text-muted sm:text-base">A sleeping worker can pause and resume normally. A hung worker may remain blocked. CPU-only monitoring can see little activity in both; syscall context shows what the thread is waiting on.</p>
              </Reveal>
            </div>
            <Reveal delay={0.08}>
              <ThreadComparison />
            </Reveal>
          </div>
        </section>

        <section aria-labelledby="closing-title" className="relative overflow-hidden bg-[#0b1019]">
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-2/3 bg-[radial-gradient(ellipse_at_90%_50%,rgba(140,124,255,0.13),transparent_63%)]" />
          <Reveal className="lp-container relative grid gap-5 py-12 sm:py-16 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12 lg:py-20">
            <div>
              <p className="lp-kicker"><span className="lp-kicker-line" />Systems behavior / made inspectable</p>
              <h2 id="closing-title" className="mt-4 max-w-[17ch] text-3xl font-semibold leading-[1.04] tracking-[-0.05em] sm:text-4xl lg:text-[3.25rem]">Observe the wait. Understand why progress stopped.</h2>
            </div>
            <p className="max-w-md border-l border-primary/45 pl-4 text-sm leading-7 text-muted sm:text-base">LockPulse combines sampled thread state and syscall context with a separate synchronization trace to examine wait relationships.</p>
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  );
}
