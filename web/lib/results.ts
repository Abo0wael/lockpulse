import type { ResultRow } from "@/lib/types";
import { formatProbability } from "@/lib/replay";

/**
 * Frozen model thresholds (results/phase3/chosen.json, hashed in results/phase4/frozen.json). The setting strings in
 * the result tables round to 4 decimals, so M3's 0.9999936 reads "threshold=1"; the site shows the frozen precision.
 */
export const FROZEN_THRESHOLDS: Record<string, number> = {
  M1: 0.9995786914147528,
  M2: 0.9946978848834604,
  M3: 0.9999935937508133,
};

export function formatSetting(row: ResultRow): string {
  const thr = FROZEN_THRESHOLDS[row.detector];
  if (thr == null) return row.setting;
  return row.setting.replace(/threshold=[\d.]+/, `threshold=${formatProbability(thr)}`);
}
