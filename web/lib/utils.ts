/**
 * Format a millisecond value, rounded to whole ms by default. Values strictly between 0 and 0.5 ms read "<1 ms"
 * (e.g. B3 alerts at the MUTEX_REQ event itself) so they are not shown as a misleading "0 ms".
 */
export function formatMs(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (digits === 0 && value > 0 && value < 0.5) return "<1 ms";
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

/** "dining_philosophers" -> "dining philosophers" (no title case: "blocked on io" stays readable). */
export function familyLabel(family: string): string {
  return family.replaceAll("_", " ");
}
