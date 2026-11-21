"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useState } from "react";
import StatusBadge from "@/components/shared/StatusBadge";

const links = [
  { href: "/", label: "Home" },
  { href: "/replay", label: "Replay" },
  { href: "/results", label: "Results" },
  { href: "/why-syscall", label: "Why Syscall" },
  { href: "/method", label: "Method" },
] as const;

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const toggleTheme = () => {
    const currentTheme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    try {
      window.localStorage.setItem("lockpulse-theme", nextTheme);
    } catch {
      // Fall back to a small preference cookie when local storage is unavailable.
    }
    document.cookie = `lockpulse-theme=${nextTheme}; path=/; max-age=31536000; samesite=lax`;
  };

  const linkClass = (href: string) => {
    const active = pathname === href;
    return [
      "rounded-md px-3 py-2 text-sm font-medium transition-colors",
      active
        ? "bg-primary/10 text-text"
        : "text-muted hover:bg-surface hover:text-text",
    ].join(" ");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 px-5 py-3 sm:px-6"
      >
        <Link
          href="/"
          className="rounded-md text-lg font-bold tracking-tight text-text focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary"
          aria-label="LockPulse home"
          onClick={() => setMenuOpen(false)}
        >
          Lock<span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Pulse</span>
          <span className="ml-2 hidden text-[10px] font-medium tracking-[0.16em] text-muted sm:inline">
            SYSTEM MONITOR
          </span>
        </Link>

        <div className="hidden items-center gap-1 rounded-xl border border-border/80 bg-surface/55 p-1 md:flex">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`${linkClass(href)} relative`}
              aria-current={pathname === href ? "page" : undefined}
            >
              <span className="relative z-10">{label}</span>
              {pathname === href && <motion.span layoutId="active-nav" className="absolute inset-0 rounded-md bg-primary/12" transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }} />}
            </Link>
          ))}
        </div>

        <StatusBadge tone="preview" className="hidden md:inline-flex">RESEARCH PREVIEW</StatusBadge>

        <StatusBadge tone="preview" className="hidden sm:inline-flex md:hidden">RESEARCH PREVIEW</StatusBadge>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle color theme"
          title="Toggle light and dark mode"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface/70 text-secondary transition hover:border-secondary/40 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        >
          <Sun aria-hidden="true" size={17} className="theme-icon-dark" />
          <Moon aria-hidden="true" size={17} className="theme-icon-light" />
        </button>

        <button
          type="button"
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-border text-text transition hover:border-primary/60 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary md:hidden"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
        </button>

        <AnimatePresence initial={false}>
          {menuOpen && (
          <motion.div
            id="mobile-navigation"
            initial={reduceMotion ? false : { opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
            className="order-3 mt-3 grid w-full gap-1 overflow-hidden border-t border-border pt-3 md:hidden"
          >
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={linkClass(href)}
                aria-current={pathname === href ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </Link>
            ))}
          </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
}
