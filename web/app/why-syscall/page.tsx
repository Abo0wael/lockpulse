import Link from "next/link";
import { ArrowDown, ArrowRight, Cpu, Moon, Radio, ScanSearch, Waves } from "lucide-react";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import Reveal from "@/components/landing/Reveal";
import AblationChart from "@/components/why-syscall/AblationChart";
import SyscallComparison from "@/components/why-syscall/SyscallComparison";

export default function WhySyscallPage() {
  return (
    <>
      <Navbar />
      <main className="lp-why-atmosphere flex-1 overflow-hidden bg-background text-text">
        <section className="relative isolate overflow-hidden border-b border-border">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_76%_38%,rgba(99,102,241,0.14),transparent_49%)]" />
          <div className="lp-container grid gap-12 py-16 sm:gap-14 sm:py-20 lg:grid-cols-[0.78fr_1.22fr] lg:items-center lg:gap-16 lg:py-24">
            <Reveal>
              <p className="lp-kicker text-secondary">Signal interpretation / 02</p>
              <h1 className="lp-page-title mt-6 max-w-[12ch]">CPU quiet is <span className="text-secondary">not a diagnosis.</span></h1>
              <p className="lp-copy-lead mt-6 max-w-xl border-l border-secondary/50 pl-5">A sleeping worker and a hung worker can both consume almost no CPU. Syscall-related telemetry adds context about what each thread is waiting on.</p>
              <a href="#comparison" className="lp-button-primary group mt-8 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary">Compare the states <ArrowDown aria-hidden="true" size={16} className="transition-transform group-hover:translate-y-0.5" /></a>
              <div className="mt-8 flex flex-wrap items-center gap-3 text-sm font-semibold text-muted"><span className="text-warning">Ambiguous</span><span>CPU-only observation</span></div>
            </Reveal>

            <Reveal delay={0.08}>
              <figure className="lp-panel-interactive relative rounded-2xl border border-border bg-surface/80 p-4 shadow-lg shadow-black/10 sm:p-6 lg:p-7">
                <figcaption className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-5">
                  <div><p className="text-base font-semibold sm:text-lg">The same quiet CPU reading</p><p className="mt-1 font-mono text-xs uppercase tracking-[0.07em] text-muted">Two different thread stories</p></div>
                  <span className="rounded-full border border-warning/25 bg-warning/[0.06] px-3 py-1.5 font-mono text-xs text-warning">CPU alone: insufficient</span>
                </figcaption>
                <div className="mt-6 space-y-6">
                  {[{ name: "Healthy worker", syscall: "nanosleep", label: "planned pause", icon: Moon, color: "text-secondary", width: "w-[30%]" }, { name: "Hung worker", syscall: "futex", label: "blocked wait", icon: Waves, color: "text-danger", width: "w-[88%]" }].map((row) => {
                    const Icon = row.icon;
                    return <div key={row.name} className="grid gap-3 sm:grid-cols-[150px_1fr] sm:items-center"><div className="flex items-center gap-2.5"><Icon aria-hidden="true" size={16} className={row.color} /><p className="text-sm font-semibold text-text sm:text-base">{row.name}</p></div><div className="min-w-0"><div className="relative h-6 overflow-hidden rounded-full border border-border bg-background"><div className="absolute inset-y-0 left-0 w-full opacity-40" style={{ backgroundImage: "linear-gradient(90deg,transparent 0 9%,var(--chart-grid) 9% 9.2%,transparent 9.2% 19%,var(--chart-grid) 19% 19.2%,transparent 19.2% 29%,var(--chart-grid) 29% 29.2%,transparent 29.2% 39%,var(--chart-grid) 39% 39.2%,transparent 39.2% 49%,var(--chart-grid) 49% 49.2%,transparent 49.2% 59%,var(--chart-grid) 59% 59.2%,transparent 59.2% 69%,var(--chart-grid) 69% 69.2%,transparent 69.2% 79%,var(--chart-grid) 79% 79.2%,transparent 79.2% 89%,var(--chart-grid) 89% 89.2%,transparent 89.2%)" }} /><div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-muted/70" /></div><div className="mt-2 flex items-center justify-between gap-3 font-mono text-xs uppercase tracking-wide"><span className={row.color}>{row.syscall}</span><span className="text-muted">{row.label}</span></div></div></div>;
                  })}
                </div>
                <div className="mt-6 flex items-center gap-3 border-t border-border/80 pt-5"><Cpu aria-hidden="true" className="text-muted" size={16} /><p className="text-sm leading-6 text-muted">Both traces look quiet from CPU activity alone.</p><ScanSearch aria-hidden="true" className="ml-auto shrink-0 text-secondary" size={17} /></div>
              </figure>
            </Reveal>
          </div>
        </section>

        <div id="comparison" className="scroll-mt-20"><SyscallComparison /></div>

        <section aria-labelledby="tier-title" className="border-y border-border bg-surface/70">
          <div className="lp-container py-16 sm:py-20 lg:py-24">
            <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-end lg:gap-14">
              <div><p className="lp-kicker">Collection architecture / 03</p><h2 id="tier-title" className="lp-section-heading mt-5 max-w-[19ch]">Observe behavior. Keep the oracle separate.</h2></div>
              <p className="max-w-2xl text-sm leading-7 text-muted sm:text-base">The syscall view described here comes from Tier P. Tier F captures synchronization events for the benchmark’s ground truth and wait-for-graph baseline. Tier F is never an ML input.</p>
            </div>
            <div className="mt-10 grid gap-4 lg:grid-cols-2 lg:gap-5">
              <article className="lp-panel-interactive relative rounded-2xl border border-border bg-surface/80 p-5 sm:p-7">
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
                <div className="mb-5 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary"><Radio aria-hidden="true" size={18} /></span><div><p className="font-mono text-xs uppercase tracking-[0.07em] text-primary">Tier P / partial</p><h3 className="mt-1 text-xl font-semibold">External process sampling</h3></div></div>
                <p className="max-w-xl text-base leading-7 text-muted">Every 5 ms, the launcher reads thread state, CPU time, context switches, and the current syscall from <code className="font-mono text-text">/proc</code>. Nothing is instrumented inside the target.</p>
                <div className="mt-6 flex flex-wrap items-center gap-2 font-mono text-xs text-muted"><span className="rounded-full border border-primary/25 bg-primary/[0.07] px-3 py-1.5">state</span><span className="rounded-full border border-primary/25 bg-primary/[0.07] px-3 py-1.5">CPU time</span><span className="rounded-full border border-primary/25 bg-primary/[0.07] px-3 py-1.5">context switches</span><span className="rounded-full border border-primary/25 bg-primary/[0.07] px-3 py-1.5">syscall</span><ArrowRight aria-hidden="true" className="text-primary" size={15} /><span className="text-text">rules + ML</span></div>
              </article>
              <article className="lp-panel-interactive relative rounded-2xl border border-border bg-surface/80 p-5 sm:p-7">
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-secondary/60 to-transparent" />
                <div className="mb-5 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl border border-secondary/30 bg-secondary/[0.08] text-secondary"><ScanSearch aria-hidden="true" size={18} /></span><div><p className="font-mono text-xs uppercase tracking-[0.07em] text-secondary">Tier F / full trace</p><h3 className="mt-1 text-xl font-semibold">Synchronization instrumentation</h3></div></div>
                <p className="max-w-xl text-base leading-7 text-muted">An <code className="font-mono text-text">LD_PRELOAD</code> shim records mutex, condition-variable, semaphore, and barrier events to derive labels and build the wait-for-graph baseline.</p>
                <div className="mt-6 flex flex-wrap items-center gap-2 font-mono text-xs text-muted"><span className="rounded-full border border-secondary/25 bg-secondary/[0.06] px-3 py-1.5">sync events</span><ArrowRight aria-hidden="true" className="text-secondary" size={15} /><span className="text-text">labels + B3</span><span className="ml-auto rounded-full border border-danger/25 bg-danger/[0.05] px-3 py-1.5 text-danger">never ML input</span></div>
              </article>
            </div>
          </div>
        </section>

        <section id="ablation" aria-labelledby="ablation-title" className="scroll-mt-20 lp-container py-16 sm:py-20 lg:py-24">
          <div className="mb-9 max-w-3xl"><p className="lp-kicker">Feature ablation / 04</p><h2 id="ablation-title" className="lp-section-heading mt-5 max-w-[14ch]">Remove syscall features. Detection collapses on this test set.</h2><p className="lp-copy-lead mt-5">The ablation removes syscall-related inputs, retrains the model, and chooses its threshold on validation. The interactive comparison reports detections on held-out test runs.</p></div>
          <AblationChart />
          <p className="mt-4 text-xs leading-5 text-muted/80">Source: <code className="font-mono">results/phase4/ablation_table.md</code>. The test split has 180 runs: 91 hangs and 89 healthy runs.</p>
        </section>

        <section aria-labelledby="takeaway" className="border-t border-border bg-surface/45">
          <div className="lp-container py-14 sm:py-18 lg:py-20">
            <Reveal>
              <div className="lp-panel relative grid gap-8 overflow-hidden rounded-3xl p-6 sm:p-9 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:p-12">
                <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 size-96 rounded-full bg-primary/[0.08] blur-3xl" />
                <div className="relative">
                  <p className="lp-kicker text-secondary">Key takeaway / 05</p>
                  <h2 id="takeaway" className="mt-5 max-w-[17ch] text-3xl font-bold leading-[1.08] tracking-[-0.045em] text-text sm:text-4xl lg:text-5xl">CPU silence tells us a thread is quiet. <span className="text-secondary">Syscall context helps explain why.</span></h2>
                </div>
                <div className="relative lg:border-l lg:border-border lg:pl-10">
                  <p className="lp-copy-lead max-w-2xl">In LockPulse’s benchmark, syscall-related features were central to M2 and M3’s held-out test detections. The result is specific to this benchmark; broader workloads and additional hard negatives are needed before generalizing.</p>
                  <Link href="/method" className="lp-button-secondary group mt-6">Read the methodology <ArrowRight aria-hidden="true" size={17} className="transition-transform group-hover:translate-x-1" /></Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
