import Link from "next/link";
import { ArrowDown, ArrowRight, Cpu, Eye, Moon, Radio, ScanSearch, Waves } from "lucide-react";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import Reveal from "@/components/landing/Reveal";
import AblationChart from "@/components/why-syscall/AblationChart";
import SyscallComparison from "@/components/why-syscall/SyscallComparison";

export default function WhySyscallPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-hidden bg-background text-text">
        <section className="relative isolate overflow-hidden border-b border-border">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_76%_38%,rgba(99,102,241,0.14),transparent_49%)]" />
          <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-14 sm:px-8 sm:py-18 lg:grid-cols-[0.78fr_1.22fr] lg:items-center lg:gap-14 lg:px-10 lg:py-24 xl:px-16">
            <Reveal>
              <p className="lp-kicker"><span className="lp-kicker-line" /><Eye aria-hidden="true" size={13} /> Signal interpretation / 02</p>
              <h1 className="mt-6 max-w-[11ch] text-4xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-5xl lg:text-[4.5rem]">CPU quiet is <span className="text-secondary">not a diagnosis.</span></h1>
              <p className="mt-6 max-w-lg border-l border-secondary/50 pl-4 text-base leading-7 text-muted sm:text-lg sm:leading-8">A sleeping worker and a hung worker can both consume almost no CPU. Syscall-related telemetry adds context about what each thread is waiting on.</p>
              <a href="#comparison" className="lp-button-primary group mt-8 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary">Compare the states <ArrowDown aria-hidden="true" size={16} className="transition-transform group-hover:translate-y-0.5" /></a>
              <div className="mt-8 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.15em] text-muted"><span className="text-warning">Ambiguous</span><span className="h-px w-10 bg-border" /> CPU-only observation</div>
            </Reveal>

            <Reveal delay={0.08}>
              <figure className="relative border-y border-border bg-[#0d1018] px-4 py-5 sm:px-7 sm:py-7">
                <figcaption className="flex items-center justify-between gap-3 border-b border-border pb-4">
                  <div><p className="text-sm font-semibold">The same quiet CPU reading</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[0.15em] text-muted">Two different thread stories</p></div>
                  <span className="border border-warning/25 bg-warning/[0.06] px-2.5 py-1 font-mono text-[9px] text-warning">CPU ALONE: INSUFFICIENT</span>
                </figcaption>
                <div className="mt-5 space-y-5">
                  {[{ name: "Healthy worker", syscall: "nanosleep", label: "planned pause", icon: Moon, color: "text-secondary", width: "w-[30%]" }, { name: "Hung worker", syscall: "futex", label: "blocked wait", icon: Waves, color: "text-danger", width: "w-[88%]" }].map((row) => {
                    const Icon = row.icon;
                    return <div key={row.name} className="grid gap-2 sm:grid-cols-[130px_1fr] sm:items-center"><div className="flex items-center gap-2"><Icon aria-hidden="true" size={14} className={row.color} /><p className="text-xs font-medium text-text">{row.name}</p></div><div className="min-w-0"><div className="relative h-5 overflow-hidden border border-border bg-background"><div className="absolute inset-y-0 left-0 w-full opacity-40" style={{ backgroundImage: "linear-gradient(90deg,transparent 0 9%,#252d40 9% 9.2%,transparent 9.2% 19%,#252d40 19% 19.2%,transparent 19.2% 29%,#252d40 29% 29.2%,transparent 29.2% 39%,#252d40 39% 39.2%,transparent 39.2% 49%,#252d40 49% 49.2%,transparent 49.2% 59%,#252d40 59% 59.2%,transparent 59.2% 69%,#252d40 69% 69.2%,transparent 69.2% 79%,#252d40 79% 79.2%,transparent 79.2% 89%,#252d40 89% 89.2%,transparent 89.2%)" }} /><div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-muted/70" /></div><div className="mt-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider"><span className={row.color}>{row.syscall}</span><span className="text-muted">{row.label}</span></div></div></div>;
                  })}
                </div>
                <div className="mt-5 flex items-center gap-3 border-t border-border pt-4"><Cpu aria-hidden="true" className="text-muted" size={15} /><p className="text-xs text-muted">Both traces look quiet from CPU activity alone.</p><ScanSearch aria-hidden="true" className="ml-auto text-secondary" size={16} /></div>
              </figure>
            </Reveal>
          </div>
        </section>

        <div id="comparison" className="scroll-mt-20"><SyscallComparison /></div>

        <section aria-labelledby="tier-title" className="border-y border-border bg-[#0d1017]">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-24 xl:px-16">
            <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr] lg:items-end lg:gap-14">
              <div><p className="lp-kicker"><span className="lp-kicker-line" />Collection architecture / 03</p><h2 id="tier-title" className="mt-5 max-w-[11ch] text-3xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-4xl lg:text-[3.2rem]">Observe behavior. Keep the oracle separate.</h2></div>
              <p className="max-w-2xl text-sm leading-7 text-muted sm:text-base">The syscall view described here comes from Tier P. Tier F captures synchronization events for the benchmark’s ground truth and wait-for-graph baseline. Tier F is never an ML input.</p>
            </div>
            <div className="mt-10 grid border-y border-border lg:grid-cols-2">
              <article className="relative py-6 pr-0 sm:py-8 lg:pr-10">
                <div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center border border-primary/30 bg-primary/10 text-primary"><Radio aria-hidden="true" size={18} /></span><div><p className="font-mono text-[10px] uppercase tracking-[0.17em] text-primary">Tier P / partial</p><h3 className="mt-1 text-lg font-semibold">External process sampling</h3></div></div>
                <p className="max-w-xl text-sm leading-6 text-muted">Every 5 ms, the launcher reads thread state, CPU time, context switches, and the current syscall from <code className="font-mono text-text">/proc</code>. Nothing is instrumented inside the target.</p>
                <div className="mt-5 flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted"><span className="border border-primary/25 bg-primary/[0.07] px-2 py-1">state</span><span className="border border-primary/25 bg-primary/[0.07] px-2 py-1">CPU time</span><span className="border border-primary/25 bg-primary/[0.07] px-2 py-1">context switches</span><span className="border border-primary/25 bg-primary/[0.07] px-2 py-1">syscall</span><ArrowRight aria-hidden="true" className="text-primary" size={14} /><span className="text-text">rules + ML</span></div>
              </article>
              <article className="border-t border-border py-6 sm:py-8 lg:border-l lg:border-t-0 lg:pl-10">
                <div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center border border-secondary/30 bg-secondary/[0.08] text-secondary"><ScanSearch aria-hidden="true" size={18} /></span><div><p className="font-mono text-[10px] uppercase tracking-[0.17em] text-secondary">Tier F / full trace</p><h3 className="mt-1 text-lg font-semibold">Synchronization instrumentation</h3></div></div>
                <p className="max-w-xl text-sm leading-6 text-muted">An <code className="font-mono text-text">LD_PRELOAD</code> shim records mutex, condition-variable, semaphore, and barrier events to derive labels and build the wait-for-graph baseline.</p>
                <div className="mt-5 flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted"><span className="border border-secondary/25 bg-secondary/[0.06] px-2 py-1">sync events</span><ArrowRight aria-hidden="true" className="text-secondary" size={14} /><span className="text-text">labels + B3</span><span className="ml-auto border border-danger/25 bg-danger/[0.05] px-2 py-1 text-danger">never ML input</span></div>
              </article>
            </div>
          </div>
        </section>

        <section id="ablation" aria-labelledby="ablation-title" className="scroll-mt-20 mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-24 xl:px-16">
          <div className="mb-8 max-w-2xl"><p className="lp-kicker"><span className="lp-kicker-line" />Feature ablation / 04</p><h2 id="ablation-title" className="mt-5 max-w-[13ch] text-3xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-4xl lg:text-[3.2rem]">Remove syscall features. Detection collapses on this test set.</h2><p className="mt-4 text-sm leading-7 text-muted">The ablation removes syscall-related inputs, retrains the model, and chooses its threshold on validation. The interactive comparison reports detections on held-out test runs.</p></div>
          <AblationChart />
          <p className="mt-4 text-xs leading-5 text-muted/80">Source: <code className="font-mono">results/phase4/ablation_table.md</code>. The test split has 180 runs: 91 hangs and 89 healthy runs.</p>
        </section>

        <section aria-labelledby="takeaway" className="border-t border-border bg-[#0d1017]">
          <div className="mx-auto grid max-w-[1440px] gap-7 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-[0.65fr_1.35fr] lg:items-start lg:gap-14 lg:px-10 lg:py-20 xl:px-16">
            <p className="lp-kicker"><span className="lp-kicker-line" />Key takeaway / 05</p>
            <div><h2 id="takeaway" className="max-w-4xl text-3xl font-semibold leading-[1.06] tracking-[-0.045em] sm:text-4xl lg:text-[3.4rem]">CPU silence tells us a thread is quiet. <span className="text-secondary">Syscall context helps explain why.</span></h2><p className="mt-5 max-w-3xl text-sm leading-7 text-muted">In LockPulse’s benchmark, syscall-related features were central to M2 and M3’s held-out test detections. The result is specific to this benchmark; broader workloads and additional hard negatives are needed before generalizing.</p><Link href="/method" className="group mt-7 inline-flex items-center gap-2 border-b border-secondary/40 pb-2 text-sm font-semibold text-text transition hover:border-secondary hover:text-secondary">Read the methodology <ArrowRight aria-hidden="true" size={15} className="transition-transform group-hover:translate-x-1" /></Link></div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
