import { ArrowDown, Cpu, Eye, ScanSearch } from "lucide-react";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import ActionLink from "@/components/shared/ActionLink";
import Reveal from "@/components/landing/Reveal";
import AblationChart from "@/components/why-syscall/AblationChart";
import SyscallComparison from "@/components/why-syscall/SyscallComparison";

export default function WhySyscallPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 bg-background text-text">
        <section className="relative isolate overflow-hidden border-b border-border">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_75%_35%,rgba(99,102,241,0.14),transparent_50%)]" />
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:py-24">
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-secondary">
                <Eye aria-hidden="true" size={14} /> WHY SYSCALL VISIBILITY MATTERS
              </p>
              <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                A quiet CPU can hide a very different <span className="text-primary">thread state.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
                A sleeping worker and a hung worker may both use almost no CPU. LockPulse samples the current
                syscall along with thread state, CPU time, and context switches to tell these situations apart.
              </p>
              <ActionLink href="#ablation" className="mt-8">
                See the ablation result <ArrowDown aria-hidden="true" size={16} />
              </ActionLink>
            </Reveal>

            <Reveal delay={0.08}>
            <div className="rounded-2xl border border-border bg-surface/90 p-5 shadow-2xl shadow-black/20 ring-1 ring-white/[0.025] transition-transform duration-300 hover:-translate-y-1 sm:p-7">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <p className="text-sm font-semibold">Same CPU signal</p>
                  <p className="mt-1 font-mono text-xs text-muted">low activity · different context</p>
                </div>
                <span className="rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 font-mono text-[10px] text-warning">AMBIGUOUS ALONE</span>
              </div>
              <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="rounded-xl border border-secondary/20 bg-secondary/5 p-4">
                  <MoonIcon />
                  <p className="mt-3 text-xs font-semibold text-secondary">PLANNED PAUSE</p>
                  <p className="mt-1 font-mono text-sm">nanosleep</p>
                </div>
                <span className="font-mono text-xs text-muted">vs</span>
                <div className="rounded-xl border border-danger/20 bg-danger/5 p-4">
                  <HangIcon />
                  <p className="mt-3 text-xs font-semibold text-danger">BLOCKED WAIT</p>
                  <p className="mt-1 font-mono text-sm">futex</p>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-border bg-background p-4">
                <div className="flex items-center gap-3">
                  <Cpu aria-hidden="true" size={17} className="text-muted" />
                  <p className="text-sm text-muted">CPU-only view</p>
                  <span className="ml-auto font-mono text-xs text-warning">both quiet</span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <ScanSearch aria-hidden="true" size={17} className="text-secondary" />
                  <p className="text-sm text-muted">Add syscall context</p>
                  <span className="ml-auto font-mono text-xs text-success">more informative</span>
                </div>
              </div>
              <p className="mt-4 text-xs leading-5 text-muted">
                An individual syscall is not a verdict; the detector considers syscall features over sampled behavior.
              </p>
            </div>
            </Reveal>
          </div>
        </section>

        <Reveal><SyscallComparison /></Reveal>

        <section id="ablation" aria-labelledby="ablation-title" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20 sm:px-6 lg:py-24">
          <div className="mb-9 max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary">FEATURE ABLATION</p>
            <h2 id="ablation-title" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Remove syscall features. Detection collapses on this test set.
            </h2>
            <p className="mt-4 leading-7 text-muted">
              The ablation removes syscall-related inputs, re-trains the model, and chooses its threshold on
              validation. The table below reports the resulting detection counts on held-out test runs.
            </p>
          </div>
          <Reveal><AblationChart /></Reveal>
          <p className="mt-4 text-xs leading-5 text-muted/80">
            Source: <code className="font-mono">results/phase4/ablation_table.md</code>. The test split includes 180 runs total,
            with 91 hangs and 89 healthy runs.
          </p>
        </section>

        <section aria-labelledby="takeaway" className="border-t border-border bg-surface/35">
          <Reveal className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:py-20">
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-6 sm:p-9">
              <p className="text-xs font-semibold tracking-[0.2em] text-secondary">KEY TAKEAWAY</p>
              <h2 id="takeaway" className="mt-3 max-w-3xl text-2xl font-bold tracking-tight sm:text-3xl">
                CPU silence tells us a thread is quiet. Syscall context helps explain why.
              </h2>
              <p className="mt-4 max-w-3xl leading-7 text-muted">
                In LockPulse’s benchmark, syscall-related features let the Tier P detectors distinguish sleep
                behavior from persistent blocked waits. The ablation shows they were central to M2 and M3’s test
                detections; broader workloads and additional hard negatives are still needed before generalizing.
              </p>
            </div>
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  );
}

function MoonIcon() {
  return <span aria-hidden="true" className="relative block h-2 w-2 rounded-full bg-secondary shadow-[0_0_14px_rgba(56,189,248,0.8)] after:absolute after:inset-0 after:animate-ping after:rounded-full after:bg-secondary/60" />;
}

function HangIcon() {
  return <span aria-hidden="true" className="relative block h-2 w-2 rounded-full bg-danger shadow-[0_0_14px_rgba(251,113,133,0.8)] after:absolute after:inset-0 after:animate-ping after:rounded-full after:bg-danger/60" />;
}
