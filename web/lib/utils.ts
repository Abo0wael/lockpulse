export function formatMs(value: number | null | undefined, digits = 1) {
  return value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(digits)} ms`;
}

export function formatPercent(value: number | null | undefined, digits = 1) {
  return value == null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(digits)}%`;
}

export function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
