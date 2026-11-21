import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface/40">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:px-6 md:flex-row md:items-end md:justify-between">
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
          <p className="mt-4 font-mono text-[10px] tracking-[0.16em] text-muted/75">SYSTEM PROGRAMMING RESEARCH · 2026</p>
        </div>
        <span className="font-mono text-xs text-muted">LINUX · THREAD HANG ANALYSIS</span>
      </div>
    </footer>
  );
}
