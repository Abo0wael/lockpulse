import Link from "next/link";
import { Activity, ArrowUpRight } from "lucide-react";

const links = [
  { href: "/", label: "Overview" },
  { href: "/replay", label: "Replay" },
  { href: "/results", label: "Results" },
  { href: "/why-syscall", label: "Why Syscall" },
  { href: "/method", label: "Methodology" },
] as const;

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-[#080a0f]">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-10 sm:px-8 sm:py-12 lg:grid-cols-[1fr_auto] lg:items-end lg:px-10 xl:px-16">
        <div>
          <Link href="/" aria-label="LockPulse overview" className="inline-flex items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary">
            <span className="grid h-8 w-8 place-items-center border border-primary/30 bg-primary/[0.07] text-primary"><Activity aria-hidden="true" size={15} /></span>
            <span className="text-base font-semibold tracking-[-0.05em] text-text">Lock<span className="text-primary">Pulse</span></span>
          </Link>
          <p className="mt-4 max-w-lg text-sm leading-6 text-muted">Researching hang detection in multithreaded Linux programs through sampled thread-state telemetry and syscall context.</p>
          <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.15em] text-muted/75">System programming · Linux · 2026</p>
        </div>

        <nav aria-label="Footer navigation" className="lg:pb-1">
          <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.15em] text-muted">Explore LockPulse</p>
          <ul className="flex max-w-xl flex-wrap gap-x-5 gap-y-3 lg:justify-end">
            {links.map(({ href, label }) => <li key={href}><Link href={href} className="group inline-flex items-center gap-1 rounded-sm text-xs text-muted transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary">{label}<ArrowUpRight aria-hidden="true" className="opacity-0 transition-opacity group-hover:opacity-100" size={11} /></Link></li>)}
          </ul>
        </nav>
      </div>
      <div className="border-t border-border/70"><div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-3 font-mono text-[8px] uppercase tracking-[0.14em] text-muted/65 sm:px-8 lg:px-10 xl:px-16"><span>Experimental benchmark</span><span>LockPulse / ECU</span></div></div>
    </footer>
  );
}
