import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Cpu, GitBranch, ShieldCheck } from "lucide-react";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import Reveal from "@/components/landing/Reveal";
import BenchmarkFamilies from "@/components/method/BenchmarkFamilies";
import DetectorOverview from "@/components/method/DetectorOverview";
import FeatureWindowDemo from "@/components/method/FeatureWindowDemo";
import MethodPipeline from "@/components/method/MethodPipeline";

const sections = [
  { id: "research", label: "Research question" },
  { id: "benchmark", label: "Benchmark" },
  { id: "collection", label: "Telemetry" },
  { id: "features", label: "Labels & features" },
  { id: "detectors", label: "Detectors" },
  { id: "protocol", label: "Protocol" },
  { id: "evaluation", label: "Evaluation" },
  { id: "limitations", label: "Limitations" },
] as const;

function MethodSection({
  id,
  number,
  eyebrow,
  title,
  lead,
  children,
  wide = false,
}: {
  id: string;
  number: string;
  eyebrow: string;
  title: string;
  lead: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-border py-14 sm:py-18 lg:py-20">
      <div className={wide ? "space-y-8" : "grid gap-8 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)] lg:gap-14"}>
        <Reveal className={wide ? "grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)] md:items-end md:gap-12" : "lg:sticky lg:top-28 lg:self-start"}>
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/[0.08] font-mono text-sm font-semibold text-primary">{number}</span>
            <div className="min-w-0 pt-0.5">
              <p className="lp-kicker">{eyebrow}</p>
              <h2 className="lp-section-heading mt-3 max-w-[17ch] text-3xl sm:text-4xl">{title}</h2>
            </div>
          </div>
          <p className={`lp-copy-lead max-w-md text-base leading-7 ${wide ? "mt-0 md:justify-self-end" : "mt-5"}`}>{lead}</p>
        </Reveal>
        <Reveal delay={0.04} className="min-w-0">{children}</Reveal>
      </div>
    </section>
  );
}

const featureGroups = [
  { name: "State & waits", items: "S-state fraction · futex fraction · whole-window futex fraction" },
  { name: "CPU progress", items: "CPU-time delta sum and max across threads" },
  { name: "Scheduling", items: "Voluntary / involuntary context-switch rates and changes" },
  { name: "Wait context", items: "Longest futex silence · sleep / I/O syscall fraction" },
  { name: "Thread population", items: "Live-thread count and change" },
] as const;

const limitations = [
  "Synthetic benchmark: 13 small programs with forced interleavings. Family-held-out testing probes generalization but cannot show how the models behave on arbitrary real programs.",
  "The test is small: 91 hangs and 89 healthy runs across three held-out families. A zero false-alarm count on 89 healthy runs still leaves uncertainty about the true rate.",
  "Every hang family blocks every live thread. Partial hangs, where one subsystem stalls while others continue, are not covered.",
  "No healthy family has all threads waiting in futex for a long time. B2 may false-alarm on an idle thread pool or a server waiting on condition variables; whether M2/M3 avoid that is untested.",
  "Collection ran on shared GitHub Actions VMs with 4 vCPUs, where scheduling noise affects timing. Fixed-work overhead runs were short (30–60 ms) and used 10 repetitions per mode.",
  "Platform coverage is Linux x86-64 with glibc pthreads. eBPF and perf sampling were not evaluated as partial-information alternatives.",
];

export default function MethodPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-hidden bg-background text-text [&_p:not(.font-mono)]:font-[var(--font-manrope)]">
        <header className="relative isolate overflow-hidden border-b border-border">
          <div aria-hidden="true" className="lp-grid-field pointer-events-none absolute inset-0 -z-10 opacity-50" />
          <div aria-hidden="true" className="pointer-events-none absolute right-0 top-0 -z-10 h-[28rem] w-[44rem] bg-[radial-gradient(ellipse_at_center,rgba(116,119,255,0.11),transparent_65%)]" />
          <div className="lp-container grid gap-10 py-14 sm:gap-12 sm:py-18 lg:grid-cols-[0.84fr_1.16fr] lg:items-center lg:gap-12 lg:py-20">
            <Reveal>
              <p className="lp-kicker">Method / experimental design</p>
              <h1 className="lp-page-title mt-5 max-w-[13ch]">From system signals to <span className="text-primary">held-out evidence.</span></h1>
              <p className="lp-copy-lead mt-5 max-w-xl text-base leading-7">Can partial, external thread telemetry detect hangs in program families unseen during training? LockPulse tests that question while keeping synchronization traces in a separate oracle path.</p>
              <div className="mt-9 flex flex-wrap gap-3"><a href="#research" className="lp-button-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary">Follow the system map <ArrowRight aria-hidden="true" size={16} /></a><Link href="/results" className="lp-button-secondary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary">View results</Link></div>
            </Reveal>
            <Reveal delay={0.08}><MethodPipeline /></Reveal>
          </div>
        </header>

        <nav aria-label="Methodology sections" className="sticky top-[80px] z-30 border-b border-border bg-background/95 backdrop-blur-xl">
          <ol className="lp-container flex gap-2 overflow-x-auto py-3">
            {sections.map((section, index) => <li key={section.id} className="shrink-0"><a href={`#${section.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-transparent px-3 text-sm text-muted transition-colors hover:border-border hover:bg-elevated/50 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-secondary"><span className="font-mono text-xs text-primary/90">0{index + 1}</span>{section.label}</a></li>)}
          </ol>
        </nav>

        <div className="lp-container">
          <MethodSection id="research" number="01" eyebrow="research question & system" title="Partial view. Family-held-out test." lead="A learned detector has value only if it can infer hangs from the limited signals available outside the target process.">
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              <article className="lp-panel rounded-2xl border border-border bg-surface/70 p-5 sm:p-6"><p className="text-base font-bold text-primary">Research question</p><p className="mt-3 text-base leading-7 text-muted">Can externally sampled thread-state and syscall telemetry detect hangs as well as a full-information detector, while using less intrusive observation?</p></article>
              <article className="lp-panel rounded-2xl border border-border bg-surface/70 p-5 sm:p-6"><p className="text-base font-bold text-secondary">Experimental comparison</p><p className="mt-3 text-base leading-7 text-muted">Tier P rules and ML operate on sampled process telemetry. Tier F supplies labels and trace-based baselines; its synchronization events are not model features.</p></article>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-wider text-muted"><span>Partial information</span><ArrowRight aria-hidden="true" size={13} className="text-primary" /><span>Held-out families</span><ArrowRight aria-hidden="true" size={13} className="text-secondary" /><span>Frozen test</span></div>
          </MethodSection>

          <MethodSection id="benchmark" number="02" eyebrow="benchmark design" title="Constructed hangs, difficult healthy cases." lead="Thirteen synthetic scenario families cover mutex deadlocks, synchronization hangs, and healthy workloads that can look quiet or blocked." wide>
            <BenchmarkFamilies />
          </MethodSection>

          <MethodSection id="collection" number="03" eyebrow="collection & telemetry" title="Two tiers. Different jobs." lead="Collection runs the benchmark under both tiers. Their output paths stay separate so the models only see the partial process view." wide>
            <div className="grid gap-4 lg:grid-cols-2">
              <article className="lp-panel rounded-2xl border border-primary/25 bg-primary/[0.035] p-5 sm:p-6">
                <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl border border-primary/25 bg-primary/[0.08] text-primary"><Cpu aria-hidden="true" size={18} /></span><div><p className="font-mono text-xs font-semibold uppercase tracking-[0.06em] text-primary">Tier P / partial</p><h3 className="mt-1 text-lg font-semibold text-text">External <code className="font-mono text-base">/proc</code> sampling</h3></div></div>
                <p className="mt-5 text-base leading-7 text-muted">Every 5 ms, the launcher reads each thread’s <code className="font-mono text-text">stat</code>, <code className="font-mono text-text">status</code>, and <code className="font-mono text-text">syscall</code>: state, CPU time, voluntary / involuntary context switches, current syscall, and live-thread count. Nothing runs inside the target.</p>
                <p className="mt-5 border-t border-border/80 pt-4 font-mono text-xs text-muted">RULES B1/B2 · ML M1/M2/M3</p>
              </article>
              <article className="lp-panel rounded-2xl border border-secondary/25 bg-secondary/[0.025] p-5 sm:p-6">
                <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl border border-secondary/25 bg-secondary/[0.07] text-secondary"><GitBranch aria-hidden="true" size={18} /></span><div><p className="font-mono text-xs font-semibold uppercase tracking-[0.06em] text-secondary">Tier F / full trace</p><h3 className="mt-1 text-lg font-semibold text-text"><code className="font-mono text-base">LD_PRELOAD</code> synchronization trace</h3></div></div>
                <p className="mt-5 text-base leading-7 text-muted">The shim interposes pthread mutex, condition-variable, semaphore, and barrier operations and records request, acquire, release, wait, signal, and barrier events. Tier F supports ground-truth labels and the wait-for graph baseline; B4 also uses its progress events. It is never an ML input.</p>
                <p className="mt-5 border-t border-border/80 pt-4 font-mono text-xs text-muted">LABELS / ORACLE · B3 GRAPH · B4 PROGRESS RULE</p>
              </article>
            </div>
          </MethodSection>

          <MethodSection id="features" number="04" eyebrow="labels & features" title="From trace events to causal windows." lead="The labeler combines trace progress with thread snapshots. The feature extractor independently builds rows from Tier P only." wide>
            <div className="grid gap-7 xl:grid-cols-[0.78fr_1.22fr]">
              <div className="rounded-2xl border border-border bg-surface/55 p-5 sm:p-7">
                <div className="flex items-end justify-between gap-3 border-b border-border pb-4"><div><p className="text-lg font-semibold text-text">Ground-truth procedure</p><p className="mt-1 text-sm text-muted">How each run receives its label</p></div><span className="font-mono text-xs text-secondary">5 STEPS</span></div>
                <ol className="ml-3 mt-5 space-y-4 border-l border-secondary/25 pl-5">
                  {["Successful exit is labeled healthy.", "For a watchdog-killed run, t0 is the last Tier F progress event (or exec time if no progress was recorded).", "A hang requires every live thread to remain blocked without progress. Uncertain or incomplete runs are ambiguous and excluded.", "A hang is labeled a deadlock only when the final mutex wait-for graph contains a cycle.", "A 5 ms onset tolerance accounts for the sampling interval and small oracle timing differences."].map((item, index) => <li key={item} className="relative grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3 text-sm leading-6 text-muted"><span className="-ml-[2.15rem] grid size-7 place-items-center rounded-full border border-secondary/30 bg-surface font-mono text-xs text-secondary">0{index + 1}</span><span>{item}</span></li>)}
                </ol>
              </div>
              <div className="min-w-0">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><p className="text-lg font-semibold text-text">Tier P feature set</p><p className="font-mono text-xs text-primary">13 SIGNALS · 5 GROUPS</p></div>
                <div className="divide-y divide-border border-y border-border">
                  {featureGroups.map((group, index) => <div key={group.name} className="grid gap-1 py-3 sm:grid-cols-[minmax(150px,0.55fr)_1fr] sm:gap-5"><p className="text-sm font-semibold text-text"><span className="mr-3 font-mono text-xs text-primary/80">0{index + 1}</span>{group.name}</p><p className="text-sm leading-6 text-muted">{group.items}</p></div>)}
                </div>
                <div className="mt-6"><FeatureWindowDemo /></div>
                <p className="mt-4 max-w-3xl text-base leading-7 text-muted">One row per 5 ms tick. Features use only samples at or before the current tick; the first W ticks are warm-up. The row label is whether the tick is at or after t0. No Tier F data, family, seed, split, run duration, or exit reason enters the model features.</p>
              </div>
            </div>
          </MethodSection>

          <MethodSection id="detectors" number="05" eyebrow="detector architecture" title="Rules and learned models." lead="The Tier P models are compared with partial-view rules and Tier F baselines. Filter the matrix to inspect each telemetry path." wide>
            <DetectorOverview />
          </MethodSection>

          <MethodSection id="protocol" number="06" eyebrow="training & test protocol" title="Tune before opening the test." lead="Families, not just runs, are separated. Validation selects settings; the held-out test is evaluated after the configuration is frozen." wide>
            <div className="grid gap-3 md:grid-cols-3">
              {[{ name: "Train", count: "359 runs", detail: "Fit candidate models; every fourth tick per run." }, { name: "Validation", count: "240 runs", detail: "Choose W, hyperparameters, and alert thresholds." }, { name: "Held-out test", count: "180 runs", detail: "Frozen configuration; final one-shot evaluation." }].map((step, index) => <article key={step.name} className={`lp-panel rounded-2xl border p-5 sm:p-6 ${index === 2 ? "border-success/30 bg-success/[0.035]" : "border-border bg-surface/65"}`}><p className="font-mono text-xs uppercase tracking-[0.06em] text-muted">0{index + 1} / {step.name}</p><p className={`mt-4 text-2xl font-semibold tracking-[-0.04em] ${index === 2 ? "text-success" : "text-text"}`}>{step.count}</p><p className="mt-3 text-sm leading-6 text-muted">{step.detail}</p></article>)}
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <p className="text-sm leading-6 text-muted"><span className="font-semibold text-secondary">Training & selection</span><br />M1 logistic regression, M2 random forest, and M3 histogram gradient boosting use fixed random seeds. Training uses every fourth tick per run; validation scores each tick. W, hyperparameters, and thresholds are chosen on validation.</p>
              <div className="hidden h-px w-12 bg-border sm:block" />
              <p className="text-sm leading-6 text-muted"><span className="font-semibold text-success">Threshold & freeze</span><br />Maximize detection subject to false alarms ≤5% of runs, then favor lower median delay. If infeasible, choose the lowest false-alarm option. Hash and freeze settings before the one-shot test; no retuning.</p>
            </div>
            <p className="mt-4 border-l border-warning/40 pl-3 text-sm leading-6 text-muted">780 configured runs; one ambiguous run is excluded, leaving 779 analyzed: 359 train, 240 validation, 180 test.</p>
          </MethodSection>

          <MethodSection id="evaluation" number="07" eyebrow="evaluation & results" title="Evidence from the held-out families." lead="The final test contains 180 benchmark runs: 91 hangs and 89 healthy runs across dining philosophers, semaphore never posted, and blocked on I/O." wide>
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {[{ id: "B2", name: "Futex-silence rule", delay: "69 ms median" }, { id: "M2", name: "Random forest", delay: "47 ms median" }, { id: "M3", name: "Gradient boosting", delay: "55 ms median" }].map((item) => <article key={item.id} className="lp-panel rounded-2xl border border-border bg-surface/65 p-5 sm:p-6"><p className="font-mono text-xs font-semibold text-primary">{item.id}</p><p className="mt-2 text-base font-semibold text-text">{item.name}</p><p className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-success">91<span className="text-muted">/91</span></p><p className="mt-1 text-sm text-muted">hangs detected</p><p className="mt-4 border-t border-border pt-4 font-mono text-xs text-muted">0 / 89 healthy false alarms</p><p className="mt-2 font-mono text-xs text-secondary">{item.delay}</p></article>)}
              </div>
              <div className="mt-3 rounded-xl border border-warning/20 bg-warning/[0.035] px-4 py-4 text-sm leading-6 text-muted">These are experimental held-out benchmark results, not a guarantee of production performance. Source: <code className="font-mono text-text">results/phase4/REPORT.md</code> and <code className="font-mono text-text">test_table.md</code>.</div>
            </>
            <div className="mt-5 grid gap-4 border-b border-border pb-5 sm:grid-cols-2">
              <p className="text-sm leading-6 text-muted"><span className="font-semibold text-secondary">Detection evaluation</span><br />Detection rate counts hangs alerted on time; false alarms are reported per run, and delay is measured from estimated t0. Score-based alerts require three consecutive ticks; PR-AUC uses window-level scores.</p>
              <p className="text-sm leading-6 text-muted"><span className="font-semibold text-secondary">Instrumentation overhead</span><br />Fixed-work runs compare untraced, Tier P, Tier F, and combined modes (10 repetitions). Slowdown was 1.15× / 1.78× / 1.73× on high_contention and 1.00× / 1.21× / 1.21× on prodcons_correct (P / F / both); short-run timing noise limits interpretation.</p>
            </div>
            <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-border bg-surface/45 p-5 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-2xl text-sm leading-6 text-muted">The frozen ML models match the best hand-made Tier P rule on this test set; M2 and M3 alert earlier at the median. The project does not claim that ML is necessary here.</p><Link href="/results" className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-text hover:text-secondary">Inspect detector results <ArrowRight aria-hidden="true" size={14} /></Link></div>
          </MethodSection>

          <MethodSection id="limitations" number="08" eyebrow="limitations" title="What the experiment leaves open." lead="The results are bounded by the synthetic suite, small held-out sample, and single platform environment." wide>
            <ul className="grid gap-x-8 sm:grid-cols-2">
              {limitations.map((item, index) => <li key={item} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 border-t border-border py-5"><span className="grid size-8 place-items-center rounded-lg border border-warning/20 bg-warning/[0.04] font-mono text-xs text-warning">0{index + 1}</span><p className="text-sm leading-6 text-muted">{item}</p></li>)}
            </ul>
            <div className="mt-6 flex items-center gap-3 text-sm leading-6 text-muted"><ShieldCheck aria-hidden="true" className="shrink-0 text-success" size={17} />These constraints define what the current benchmark supports; they are not claims about untested workloads.</div>
          </MethodSection>
        </div>
      </main>
      <Footer />
    </>
  );
}
