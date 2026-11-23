"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Activity, ArrowUpRight, Menu, Moon, Sun, X } from "lucide-react";
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
  const toggleTheme = () => {
    const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    try { window.localStorage.setItem("lockpulse-theme", nextTheme); } catch { /* Cookie below keeps the preference when storage is unavailable. */ }
    document.cookie = `lockpulse-theme=${nextTheme}; path=/; max-age=31536000; samesite=lax`;
  };
  const linkClass = (href: string, mobile = false) => {
    const active = pathname === href;
    return mobile
      ? `relative flex min-h-14 items-center justify-between rounded-lg px-4 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${active ? "bg-elevated text-text" : "text-muted hover:bg-elevated/70 hover:text-text"}`
      : `relative inline-flex min-h-12 items-center px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${active ? "text-text" : "text-muted hover:text-text"}`;
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/96 backdrop-blur-xl">
      <nav aria-label="Main navigation" className="lp-container flex min-h-[80px] items-center justify-between gap-4">
        <Link href="/" aria-label="LockPulse overview" onClick={() => setMenuOpen(false)} className="group inline-flex min-w-0 shrink-0 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary">
          <span className="relative grid size-11 place-items-center overflow-hidden rounded-lg border border-primary/35 bg-primary/10 text-secondary transition-colors group-hover:border-secondary/55"><Activity aria-hidden="true" size={20} strokeWidth={1.8} /><span aria-hidden="true" className="absolute bottom-1.5 right-1.5 size-1 rounded-full bg-primary" /></span>
          <span className="min-w-0"><span className="block text-xl font-bold leading-none tracking-[-0.055em] text-text">Lock<span className="text-secondary">Pulse</span></span><span className="mt-1.5 hidden font-mono text-[11px] uppercase tracking-[0.08em] text-muted sm:block">Linux systems intelligence</span></span>
        </Link>
        <div className="hidden items-center gap-1 lg:flex">
          {links.map(({ href, label }) => <Link key={href} href={href} className={linkClass(href)} aria-current={pathname === href ? "page" : undefined}>
            {pathname === href && <motion.span layoutId="nav-active" className="absolute inset-x-3 bottom-0 h-0.5 bg-secondary" transition={{ duration: reduceMotion ? 0 : 0.2 }} />}
            <span className="relative z-10">{label}</span>
          </Link>)}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={toggleTheme} aria-label="Toggle color theme" title="Toggle light and dark mode" className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-surface text-secondary transition hover:border-secondary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"><Sun aria-hidden="true" size={17} className="theme-icon-dark" /><Moon aria-hidden="true" size={17} className="theme-icon-light" /></button>
          <button type="button" className="inline-flex size-11 items-center justify-center rounded-lg border border-border bg-surface text-text transition hover:border-secondary/50 hover:text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary lg:hidden" aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X aria-hidden="true" size={19} /> : <Menu aria-hidden="true" size={19} />}</button>
        </div>
      </nav>
      <AnimatePresence initial={false}>
        {menuOpen && <motion.div id="mobile-navigation" initial={reduceMotion ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={reduceMotion ? undefined : { opacity: 0, height: 0 }} transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }} className="overflow-hidden border-t border-border bg-background lg:hidden" onKeyDown={(event) => { if (event.key === "Escape") setMenuOpen(false); }}>
          <div className="lp-container grid gap-1 py-3"><p className="lp-kicker mb-1 px-3">Navigate</p>
            {links.map(({ href, label }, index) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} onClick={() => setMenuOpen(false)} className={linkClass(href, true)}><span className="flex items-center gap-3"><span className="font-mono text-[11px] text-primary/90">0{index + 1}</span>{label}</span>{pathname === href ? <span aria-hidden="true" className="size-1.5 rounded-full bg-secondary" /> : <ArrowUpRight aria-hidden="true" className="text-muted/70" size={14} />}</Link>)}
          </div>
        </motion.div>}
      </AnimatePresence>
    </header>
  );
}
