import { Activity, Database, GitCompareArrows, ShieldCheck } from "lucide-react";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import PageHeader from "@/components/shared/PageHeader";
import Reveal from "@/components/landing/Reveal";

const tiers = [
  { name: "Tier P · Partial telemetry", detail: "External /proc sampling every 5 ms: thread state, CPU time, context switches, and current syscall. This is the input available to the practical detectors.", icon: Activity, tone: "text-secondary" },
  { name: "Tier F · Full trace", detail: "An LD_PRELOAD synchronization trace records mutex, condition-variable, semaphore, and barrier events. It supports benchmark labels and the wait-for-graph baseline; ML models do not use it.", icon: Database, tone: "text-primary" },
];

const detectors = [
  ["B1", "Fixed timeout", "Alerts after a configured period without CPU progress."],
  ["B2", "Futex silence", "Alerts when all live threads remain in futex waits without context switches."],
  ["B3", "Wait-for graph", "Detects a cycle among threads waiting for mutexes; it cannot identify hangs without a mutex cycle."],
  ["B4", "Progress watchdog", "Uses full-trace progress events and a timeout as a benchmark baseline."],
  ["M1–M3", "Learned detectors", "Logistic regression, random forest, and gradient boosting use causal windows of Tier P features."],
];

export default function MethodPage() {
  return <><Navbar/><main className="flex-1 bg-background text-text">
    <PageHeader eyebrow="HOW LOCKPULSE WAS EVALUATED" title="A benchmark built to test what a detector can really see." description="LockPulse compares lightweight external sampling with a full synchronization trace across hanging programs and healthy workloads that can look deceptively quiet." tone="violet"/>
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-6 sm:py-16"><div className="grid gap-4 lg:grid-cols-2">{tiers.map(({ name, detail, icon: Icon, tone }, index)=><Reveal key={name} delay={index * 0.08}><article className="group relative h-full overflow-hidden rounded-2xl border border-border bg-surface/80 p-6 shadow-lg shadow-black/10 transition duration-300 hover:-translate-y-1 hover:border-primary/40 sm:p-8"><span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 transition group-hover:opacity-100"/><span className={`inline-flex rounded-xl border border-border bg-background p-3 ${tone}`}><Icon size={20} aria-hidden="true"/></span><h2 className="mt-5 text-xl font-semibold">{name}</h2><p className="mt-3 text-sm leading-6 text-muted">{detail}</p></article></Reveal>)}</div></section>
        <section className="border-y border-border bg-surface/35"><div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 sm:py-16"><div className="max-w-2xl"><p className="text-xs font-semibold tracking-[0.2em] text-secondary">DETECTOR FAMILIES</p><h2 className="mt-3 text-3xl font-bold tracking-tight">Compare rules with learned signals.</h2><p className="mt-3 text-sm leading-6 text-muted">Every detector is evaluated against the same held-out runs. The Tier P models use only information available to an external observer.</p></div><div className="mt-8 grid gap-3 md:grid-cols-2">{detectors.map(([id, name, detail], index)=><Reveal key={id} delay={index * 0.04}><article className="rounded-xl border border-border bg-surface/80 p-5 transition duration-200 hover:border-secondary/35 hover:bg-surface"><p className="font-mono text-xs font-semibold tracking-wider text-secondary">{id}</p><h3 className="mt-2 font-semibold">{name}</h3><p className="mt-2 text-sm leading-6 text-muted">{detail}</p></article></Reveal>)}</div></div></section>
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-6 sm:py-16"><div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]"><div><p className="text-xs font-semibold tracking-[0.2em] text-primary">EVALUATION</p><h2 className="mt-3 text-3xl font-bold tracking-tight">Thresholds are chosen before the test.</h2><p className="mt-4 text-sm leading-6 text-muted">Models are trained on training runs. Configuration and thresholds are selected using validation data, then frozen before the held-out test evaluation.</p></div><div className="space-y-3">{[[GitCompareArrows,"Train → validation → test","Keep model selection separate from final held-out evaluation."],[ShieldCheck,"Hard negatives","Include sleep, blocked I/O, lock contention, long critical sections, and correct synchronization patterns."],[Activity,"Report more than detection","Measure detection rate, alert delay, false alarms, and PR-AUC; interpret each against the benchmark scope."]].map(([Icon,title,description])=>{const ItemIcon=Icon as typeof Activity; return <article key={title as string} className="flex gap-4 rounded-xl border border-border bg-surface p-5"><ItemIcon className="mt-0.5 shrink-0 text-secondary" size={19} aria-hidden="true"/><div><h3 className="font-semibold">{title as string}</h3><p className="mt-1 text-sm leading-6 text-muted">{description as string}</p></div></article>;})}</div></div></section>
    <section className="border-t border-border bg-surface/35"><div className="mx-auto max-w-7xl px-5 py-10 sm:px-6"><p className="text-xs leading-5 text-muted">These results describe a synthetic benchmark. Performance on other programs and workloads requires additional evaluation.</p></div></section>
  </main><Footer/></>;
}
