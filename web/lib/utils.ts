/** Format a millisecond value while keeping missing measurements explicit. */
export function formatMs(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)} ms`;
}

/** Format a ratio in [0, 1] as a percentage. */
export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

/** Joins conditional class names without introducing a styling dependency. */
export function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
