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

  const linkClass = (href: string) => `relative rounded-sm px-2.5 py-2 text-[12px] font-medium tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${pathname === href ? "text-text" : "text-muted hover:text-text"}`;

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-background/95 backdrop-blur-xl">
      <nav aria-label="Main navigation" className="mx-auto flex min-h-[68px] max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-10 xl:px-16">
        <Link href="/" aria-label="LockPulse overview" onClick={() => setMenuOpen(false)} className="group inline-flex shrink-0 items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary">
          <span className="grid h-8 w-8 place-items-center border border-primary/35 bg-primary/[0.09] text-primary transition-colors group-hover:border-primary/65"><Activity aria-hidden="true" size={16} /></span>
          <span className="text-[17px] font-semibold tracking-[-0.055em] text-text">Lock<span className="text-primary">Pulse</span></span>
          <span className="ml-1 hidden border-l border-border pl-3 font-mono text-[8px] uppercase tracking-[0.15em] text-muted lg:inline">Thread observability</span>
        </Link>

        <div className="hidden items-center gap-0.5 md:flex">
          {links.map(({ href, label }) => (
            <Link key={href} href={href} className={linkClass(href)} aria-current={pathname === href ? "page" : undefined}>
              {label}
              {pathname === href && <motion.span layoutId="nav-active" className="absolute inset-x-2.5 -bottom-[13px] h-px bg-secondary" transition={{ duration: reduceMotion ? 0 : 0.2 }} />}
            </Link>
          ))}
        </div>

        <Link href="/replay" className="hidden min-h-9 items-center gap-2 border border-border px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-text transition-colors hover:border-primary/45 hover:text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary xl:inline-flex">
          Open replay <ArrowUpRight aria-hidden="true" size={13} />
        </Link>

        <button type="button" className="inline-flex h-10 w-10 items-center justify-center border border-border text-text transition-colors hover:border-primary/45 md:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary" aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? <X aria-hidden="true" size={18} /> : <Menu aria-hidden="true" size={18} />}
        </button>
      </nav>

      <motion.div id="mobile-navigation" aria-hidden={!menuOpen} inert={!menuOpen} initial={false} animate={{ opacity: menuOpen ? 1 : 0, height: menuOpen ? "auto" : 0 }} transition={{ duration: reduceMotion ? 0 : 0.22 }} className="overflow-hidden border-t border-border bg-background md:hidden">
        <div className="mx-auto grid max-w-[1440px] gap-1 px-5 py-3 sm:px-8">
          {links.map(({ href, label }, index) => (
            <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} onClick={() => setMenuOpen(false)} className={`flex min-h-11 items-center justify-between border-b border-border/70 px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-secondary ${pathname === href ? "text-text" : "text-muted hover:text-text"}`}>
              <span className="flex items-center gap-3"><span className="font-mono text-[9px] text-primary/80">0{index + 1}</span>{label}</span>
              {pathname === href && <span className="h-1.5 w-1.5 rounded-full bg-secondary" />}
            </Link>
          ))}
        </div>
      </motion.div>
    </header>
  );
}
