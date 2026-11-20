import { Activity, LockKeyhole } from "lucide-react";

function ThreadNode({ label, lock }: { label: string; lock: string }) {
  return (
    <div className="relative z-10 flex min-h-[92px] flex-col justify-between rounded-xl border border-border bg-[#171b26]/95 p-3 shadow-lg shadow-black/20 sm:p-4">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted sm:text-xs">{label}</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-text sm:text-base">{lock}</p>
        <p className="mt-1 font-mono text-[10px] text-danger sm:text-xs">BLOCKED · futex</p>
      </div>
    </div>
  );
}

function LockNode({ label, owner }: { label: string; owner: string }) {
  return (
    <div className="relative z-10 flex min-h-[92px] flex-col justify-between rounded-xl border border-secondary/25 bg-[#121a24]/95 p-3 shadow-lg shadow-black/20 sm:p-4">
      <div className="flex items-center gap-2 text-secondary">
        <LockKeyhole aria-hidden="true" size={15} />
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] sm:text-xs">RESOURCE</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-text sm:text-base">{label}</p>
        <p className="mt-1 font-mono text-[10px] text-secondary sm:text-xs">HELD BY {owner}</p>
      </div>
    </div>
  );
}

export default function DeadlockAnimation() {
  return (
    <section
      aria-label="Illustrative two-thread deadlock: Thread A holds Lock A and waits for Lock B; Thread B holds Lock B and waits for Lock A."
      className="relative overflow-hidden rounded-2xl border border-border bg-[#0f121a] shadow-2xl shadow-black/35"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(99,102,241,0.12),transparent_66%)]" />
      <header className="relative flex items-center justify-between border-b border-border px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="rounded-lg border border-primary/20 bg-primary/10 p-2 text-primary"><Activity aria-hidden="true" size={17} /></span>
          <div>
            <p className="text-sm font-semibold">Wait-for graph</p>
            <p className="mt-0.5 font-mono text-[10px] text-muted">Illustrative deadlock trace</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-danger/30 bg-danger/10 px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-wide text-danger sm:px-3 sm:text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-danger" /> CYCLE FOUND
        </span>
      </header>

      <div className="relative px-4 py-6 sm:px-6 sm:py-7">
        <div className="relative grid h-[268px] grid-cols-2 grid-rows-2 gap-x-8 gap-y-16 sm:h-[294px] sm:gap-x-16 sm:gap-y-20">
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <marker id="wait-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L5,2.5 L0,5 z" fill="#fb7185" /></marker>
              <marker id="hold-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L5,2.5 L0,5 z" fill="#38bdf8" /></marker>
            </defs>
            <path d="M43 24 C48 17 52 17 57 24" fill="none" stroke="#fb7185" strokeWidth="0.65" strokeDasharray="1.5 1.5" markerEnd="url(#wait-arrow)" />
            <path d="M76 39 C82 47 82 53 76 61" fill="none" stroke="#38bdf8" strokeWidth="0.65" markerEnd="url(#hold-arrow)" />
            <path d="M57 76 C52 83 48 83 43 76" fill="none" stroke="#fb7185" strokeWidth="0.65" strokeDasharray="1.5 1.5" markerEnd="url(#wait-arrow)" />
            <path d="M24 61 C18 53 18 47 24 39" fill="none" stroke="#38bdf8" strokeWidth="0.65" markerEnd="url(#hold-arrow)" />
          </svg>

          <ThreadNode label="Thread A" lock="Waiting for Lock B" />
          <LockNode label="Lock B" owner="THREAD B" />
          <LockNode label="Lock A" owner="THREAD A" />
          <ThreadNode label="Thread B" lock="Waiting for Lock A" />
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-muted sm:text-xs">
          <span className="inline-flex items-center gap-2"><span className="h-2 w-4 rounded-sm border border-danger/50" />Waiting edge</span>
          <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 bg-secondary" />Ownership edge</span>
        </div>
        <span className="rounded-md border border-danger/20 bg-danger/5 px-2.5 py-1.5 font-mono text-[10px] text-danger">CIRCULAR WAIT</span>
      </footer>
    </section>
  );
}
