"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";

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
          Lock<span className="text-primary">Pulse</span>
          <span className="ml-2 hidden text-[10px] font-medium tracking-[0.16em] text-muted sm:inline">
            SYSTEM MONITOR
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={linkClass(href)}
              aria-current={pathname === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </div>

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

        {menuOpen && (
          <div
            id="mobile-navigation"
            className="order-3 mt-3 grid w-full gap-1 border-t border-border pt-3 md:hidden"
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
          </div>
        )}
      </nav>
    </header>
  );
}
