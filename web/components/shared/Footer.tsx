import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/replay", label: "Replay" },
  { href: "/results", label: "Results" },
  { href: "/why-syscall", label: "Why Syscall" },
  { href: "/method", label: "Method" },
] as const;

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <Link
            href="/"
            className="rounded-sm text-lg font-bold tracking-tight text-text focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary"
          >
            Lock<span className="text-primary">Pulse</span>
          </Link>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
            A research project exploring hang detection in multithreaded Linux
            programs through thread-state telemetry and syscall information.
          </p>
          <p className="mt-5 font-mono text-xs text-muted/75">
            SYSTEM PROGRAMMING PROJECT · 2026
          </p>
        </div>

        <nav aria-label="Footer navigation">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 md:justify-end">
            {links.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="rounded-sm text-sm text-muted transition-colors hover:text-secondary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
