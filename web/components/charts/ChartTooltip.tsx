export default function ChartTooltip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted shadow-lg">{children}</span>;
}
