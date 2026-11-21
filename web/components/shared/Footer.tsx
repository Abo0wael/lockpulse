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
    <footer className="mt-auto border-t border-border bg-[#070a10]">
      <div className="lp-container grid gap-10 py-10 sm:py-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)] lg:gap-16 lg:py-14">
        <div className="max-w-2xl">
          <p className="lp-kicker"><span className="lp-kicker-line" />Research interface / Linux</p>
          <Link href="/" aria-label="LockPulse overview" className="group mt-5 inline-flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary">
            <span className="grid size-10 place-items-center rounded-[11px] border border-primary/35 bg-primary/[0.1] text-secondary transition-colors group-hover:border-secondary/55"><Activity aria-hidden="true" size={18} /></span>
            <span className="text-xl font-semibold leading-none tracking-[-0.055em] text-text">Lock<span className="text-secondary">Pulse</span></span>
          </Link>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted">
            Researching hang detection in multithreaded Linux programs through sampled thread-state telemetry and syscall context.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="lp-badge">System programming</span>
            <span className="lp-badge">Experimental benchmark</span>
          </div>
        </div>

        <nav aria-label="Footer navigation" className="lg:border-l lg:border-border lg:pl-10">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.17em] text-muted">Explore LockPulse</p>
            <span className="font-mono text-[10px] text-muted/70">05 / ROUTES</span>
          </div>
          <ul className="mt-2 grid grid-cols-2 gap-x-6 sm:grid-cols-3 lg:grid-cols-2">
            {links.map(({ href, label }, index) => (
              <li key={href} className="border-b border-border/70">
                <Link href={href} className="group flex min-h-12 items-center justify-between gap-2 rounded-sm pr-1 text-sm text-muted transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-secondary">
                  <span className="flex items-center gap-2.5"><span className="font-mono text-[9px] text-primary/75">0{index + 1}</span>{label}</span>
                  <ArrowUpRight aria-hidden="true" className="text-secondary opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 group-focus-visible:opacity-100" size={13} />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-border/80">
        <div className="lp-container flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 font-mono text-[9px] uppercase tracking-[0.13em] text-muted/75">
          <span>System programming · Linux · 2026</span>
          <span>LockPulse <span className="px-1.5 text-border-strong">/</span> ECU</span>
        </div>
      </div>
    </footer>
  );
}
