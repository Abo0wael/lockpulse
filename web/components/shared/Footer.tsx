import Link from "next/link";
import { Activity } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-border/75 bg-background">
      <div className="lp-container grid gap-8 py-10 sm:py-12 lg:py-14">
        <div className="max-w-2xl">
          <p className="lp-kicker">Research interface / Linux</p>
          <Link href="/" aria-label="LockPulse overview" className="group mt-5 inline-flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary">
            <span className="grid size-10 place-items-center rounded-[11px] border border-primary/35 bg-primary/[0.1] text-secondary transition-colors group-hover:border-secondary/55"><Activity aria-hidden="true" size={18} /></span>
            <span className="text-xl font-semibold leading-none tracking-[-0.055em] text-text">Lock<span className="text-secondary">Pulse</span></span>
          </Link>
          <p className="mt-5 max-w-3xl text-base leading-8 text-muted">
            Researching hang detection in multithreaded Linux programs through sampled thread-state telemetry and syscall context.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="lp-badge">System programming</span>
            <span className="lp-badge">Experimental benchmark</span>
          </div>
        </div>

      </div>

      <div className="border-t border-border/80">
        <div className="lp-container flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4 font-mono text-[11px] uppercase tracking-[0.06em] text-muted/75">
          <span>System programming · Linux · 2026</span>
          <span>LockPulse <span className="px-1.5 text-border-strong">/</span> ECU</span>
        </div>
      </div>
    </footer>
  );
}
