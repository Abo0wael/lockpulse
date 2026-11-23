import type { ReactNode } from "react";

const styles = {
  preview: "border-warning/25 bg-warning/5 text-warning",
  healthy: "border-success/25 bg-success/5 text-success",
  hang: "border-danger/25 bg-danger/5 text-danger",
  deadlock: "border-danger/25 bg-danger/5 text-danger",
} as const;

export default function StatusBadge({
  tone,
  children,
  className = "",
}: {
  tone: keyof typeof styles;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex min-h-7 items-center gap-2 rounded-md border px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.05em] ${styles[tone]} ${className}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
      {children}
    </span>
  );
}
