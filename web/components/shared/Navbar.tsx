"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Activity, ArrowUpRight, Menu, X } from "lucide-react";
import { useState } from "react";

const links = [
  { href: "/", label: "Overview" },
  { href: "/replay", label: "Replay" },
  { href: "/results", label: "Results" },
  { href: "/why-syscall", label: "Why Syscall" },
  { href: "/method", label: "Methodology" },
] as const;

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const reduceMotion = useReducedMotion() ?? false;

  const linkClass = (href: string, mobile = false) => {
    const active = pathname === href;
    return mobile
      ? `relative flex min-h-12 items-center justify-between rounded-lg px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${active ? "bg-elevated text-text" : "text-muted hover:bg-elevated/70 hover:text-text"}`
      : `relative rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${active ? "text-text" : "text-muted hover:text-text"}`;
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/90 bg-background/90 backdrop-blur-2xl">
      <nav aria-label="Main navigation" className="lp-container flex min-h-[76px] items-center justify-between gap-4">
        <Link
          href="/"
          aria-label="LockPulse overview"
          onClick={() => setMenuOpen(false)}
          className="group inline-flex min-w-0 shrink-0 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary"
        >
          <span className="relative grid size-10 place-items-center overflow-hidden rounded-[11px] border border-primary/35 bg-[linear-gradient(145deg,rgba(140,124,255,0.2),rgba(66,220,232,0.07))] text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors group-hover:border-secondary/55">
            <Activity aria-hidden="true" size={19} strokeWidth={1.8} />
            <span aria-hidden="true" className="absolute bottom-1.5 right-1.5 size-1 rounded-full bg-primary" />
          </span>
          <span className="min-w-0">
            <span className="block text-[18px] font-semibold leading-none tracking-[-0.055em] text-text">Lock<span className="text-secondary">Pulse</span></span>
            <span className="mt-1.5 hidden font-mono text-[9px] uppercase tracking-[0.16em] text-muted sm:block">Linux systems intelligence</span>
          </span>
        </Link>

        <div className="hidden items-center gap-0.5 rounded-xl border border-border/80 bg-surface/75 p-1 md:flex">
          {links.map(({ href, label }) => (
            <Link key={href} href={href} className={linkClass(href)} aria-current={pathname === href ? "page" : undefined}>
              {pathname === href && <motion.span layoutId="nav-active" className="absolute inset-0 -z-0 rounded-lg border border-border-strong/70 bg-elevated shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]" transition={{ duration: reduceMotion ? 0 : 0.2 }} />}
              <span className="relative z-10">{label}</span>
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/replay"
            className="hidden min-h-10 items-center gap-2 rounded-lg border border-secondary/30 bg-secondary/[0.07] px-3.5 text-xs font-semibold text-text transition hover:border-secondary/60 hover:bg-secondary/[0.12] hover:text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary xl:inline-flex"
          >
            Open replay <ArrowUpRight aria-hidden="true" size={14} />
          </Link>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-lg border border-border bg-surface text-text transition hover:border-secondary/50 hover:text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary md:hidden"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X aria-hidden="true" size={19} /> : <Menu aria-hidden="true" size={19} />}
          </button>
        </div>
      </nav>

      <motion.div
        id="mobile-navigation"
        aria-hidden={!menuOpen}
        inert={!menuOpen}
        initial={false}
        animate={{ opacity: menuOpen ? 1 : 0, height: menuOpen ? "auto" : 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.2, 0.7, 0.2, 1] }}
        className="overflow-hidden border-t border-border bg-background md:hidden"
        onKeyDown={(event) => { if (event.key === "Escape") setMenuOpen(false); }}
      >
        <div className="lp-container grid gap-1 py-3">
          <p className="lp-kicker mb-1 px-3"><span className="lp-kicker-line" />Navigate</p>
          {links.map(({ href, label }, index) => (
            <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} onClick={() => setMenuOpen(false)} className={linkClass(href, true)}>
              <span className="flex items-center gap-3"><span className="font-mono text-[10px] text-primary/90">0{index + 1}</span>{label}</span>
              {pathname === href ? <span aria-hidden="true" className="size-1.5 rounded-full bg-secondary shadow-[0_0_10px_rgba(66,220,232,0.45)]" /> : <ArrowUpRight aria-hidden="true" className="text-muted/70" size={14} />}
            </Link>
          ))}
          <Link href="/replay" onClick={() => setMenuOpen(false)} className="lp-button-primary mt-2 w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary">
            Open recorded replay <ArrowUpRight aria-hidden="true" size={15} />
          </Link>
        </div>
      </motion.div>
    </header>
  );
}
