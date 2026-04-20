// Delta annotations for the recommendation card.
//
// Small signed labels shown under each compressor setting tile so the
// user can see how much a selector toggle moved each field. Pure
// formatters — no React, no refs — so they can be unit-tested in
// isolation and reused if any other surface (future mix-bus page,
// preset comparison, etc.) wants the same shape.
//
// Epsilons filter floating-point noise from the recommendation engine
// so unchanged fields don't flicker "+0.0" when a selector toggle
// happens to leave them alone. The thresholds match the precision of
// the on-screen value formatters:
//
//   • dB and ratio are shown to one decimal, so < 0.05 is below the
//     displayable resolution anyway.
//   • ms is shown as integer at ≥ 10 ms and one decimal below, so
//     0.5 ms is the tightest meaningful step.

import type { CompressionSettings } from "./calibration";

export const DELTA_EPSILON_DB = 0.05;
export const DELTA_EPSILON_RATIO = 0.05;
export const DELTA_EPSILON_MS = 0.5;

/**
 * Format a signed dB delta ("+2.5 dB", "-0.7 dB") or null if the
 * change is below the noise floor. Negative numbers carry the minus
 * sign from `toFixed` directly; positive numbers get an explicit `+`
 * so the direction is unambiguous at a glance.
 */
export function deltaLabelDb(diff: number): string | null {
  if (Math.abs(diff) < DELTA_EPSILON_DB) return null;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff.toFixed(1)} dB`;
}

/** Format a signed ratio delta ("+0.3", "-0.5") — unit-less, one decimal. */
export function deltaLabelRatio(diff: number): string | null {
  if (Math.abs(diff) < DELTA_EPSILON_RATIO) return null;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff.toFixed(1)}`;
}

/**
 * Format a signed ms delta. Matches the tile's value formatter:
 * integer for magnitudes ≥ 10 ms, one decimal below. Keeps the delta
 * visually consistent with the main number even when the main number
 * happens to be integer and the delta spans the boundary.
 */
export function deltaLabelMs(diff: number): string | null {
  if (Math.abs(diff) < DELTA_EPSILON_MS) return null;
  const sign = diff > 0 ? "+" : "";
  const magnitude =
    Math.abs(diff) >= 10 ? Math.round(diff).toString() : diff.toFixed(1);
  return `${sign}${magnitude} ms`;
}

/**
 * Bundle of per-field delta labels. `null` for any field that didn't
 * move beyond its epsilon so the UI can render an empty slot instead
 * of a misleading "+0.0".
 */
export type SettingsDeltas = {
  threshold: string | null;
  ratio: string | null;
  makeup: string | null;
  attack: string | null;
  release: string | null;
  knee: string | null;
};

/**
 * Compute every field delta between two compressor setting bundles.
 * Returns a fully-populated struct (any field can still be null) so
 * the UI can indexed-access each tile's delta without conditional
 * defaults in three separate places.
 */
export function computeDeltas(
  current: CompressionSettings,
  prev: CompressionSettings,
): SettingsDeltas {
  return {
    threshold: deltaLabelDb(current.thresholdDb - prev.thresholdDb),
    ratio: deltaLabelRatio(current.ratio - prev.ratio),
    makeup: deltaLabelDb(current.makeupDb - prev.makeupDb),
    attack: deltaLabelMs(current.attackMs - prev.attackMs),
    release: deltaLabelMs(current.releaseMs - prev.releaseMs),
    knee: deltaLabelDb(current.kneeDb - prev.kneeDb),
  };
}
