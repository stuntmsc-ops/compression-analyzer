// Compression recommendation engine.
//
// Composes a CompressionSettings bundle from four inputs:
//
//   1. InstrumentPrior    — how the source naturally wants to be compressed
//                           (time constants, knee character, expected crest).
//   2. GoalProfile        — what the user is trying to do to it
//                           (target GR at peak, base ratio, mult factors).
//   3. GenreModifier      — aesthetic preference layered on top of the
//                           goal (hip-hop punchy, R&B warm, lo-fi coloured,
//                           …). Multiplicative scalars around 1.0.
//   4. AudioAnalysisResult — the user's actual audio. Peak anchors the
//                           threshold; crest factor nudges the ratio so
//                           already-flat sources get a higher ratio and
//                           peakier sources get a gentler one.
//
// Composition order: prior → goal → genre. The goal decides intent
// (how much GR, what shape), the genre flavours the intent, the crest
// adjustment responds to what the source actually needs. The ratio
// clamp is applied on goal bounds only, so no combination of genre +
// crest can push the ratio into a regime the user didn't ask for.
//
// Day 18 will add templated "why" sentences using the `adjustments`
// block and the prior/goal/genre `notes` strings.
//
// Returns null for unanalysable input (silent file, non-finite peak) —
// the caller guards the UI on null rather than rendering nonsense.

import type { AudioAnalysisResult } from "./audioAnalysis";
import {
  INSTRUMENT_PRIORS,
  GOAL_PROFILES,
  GENRE_MODIFIERS,
  RATIO_ADJUSTMENT,
  type CompressionSettings,
  type InstrumentPrior,
  type GoalProfile,
  type GenreModifier,
} from "./calibration";
import type { InstrumentType, Genre, CompressionGoal } from "./types";

// ─── Public type ───────────────────────────────────────────────────

export type CompressionRecommendation = {
  settings: CompressionSettings;
  /**
   * Prior / goal / genre references exposed so callers can render
   * explanations without re-looking-up into the calibration tables and
   * without this file owning the UI copy.
   */
  prior: InstrumentPrior;
  goal: GoalProfile;
  genre: GenreModifier;
  adjustments: {
    /** Measured crest minus midpoint of `prior.typicalCrestDb`. */
    crestDeviationDb: number;
    /** Scalar applied to `goal.baseRatio` from the crest nudge (before clamp). */
    crestRatioMult: number;
    /** Scalar applied to `goal.baseRatio` from the genre modifier. */
    genreRatioMult: number;
    /** Target gain reduction at peak used to derive threshold. */
    targetPeakGrDb: number;
  };
};

// ─── Main entry point ──────────────────────────────────────────────

export function recommendCompression(
  analysis: AudioAnalysisResult,
  instrument: InstrumentType,
  genre: Genre,
  goal: CompressionGoal,
): CompressionRecommendation | null {
  // Reject silent / unmeasurable input. A finite peak is the hinge the
  // threshold formula depends on; without one the math blows up.
  if (!Number.isFinite(analysis.peakDb)) return null;

  const prior = INSTRUMENT_PRIORS[instrument];
  const goalProfile = GOAL_PROFILES[goal];
  const genreMod = GENRE_MODIFIERS[genre];

  // Attack / release / knee compose prior × goal × genre. The knee
  // floor at 0 prevents hard-knee goals + genres from pushing a
  // low-knee prior into negative territory (meaningless on a plugin GUI).
  const attackMs = roundMs(
    prior.attackMs * goalProfile.attackMult * genreMod.attackMult,
  );
  const releaseMs = roundMs(
    prior.releaseMs * goalProfile.releaseMult * genreMod.releaseMult,
  );
  const kneeDb = roundDb(
    Math.max(
      0,
      prior.kneeDb + goalProfile.kneeDeltaDb + genreMod.kneeDeltaDb,
    ),
  );

  // Ratio: goal.baseRatio × crest-factor nudge × genre nudge, then
  // clamped to the goal's [minMult, maxMult] bounds. The clamp stays
  // anchored to the goal — genre shouldn't be able to turn a gentle
  // warmth goal into aggressive compression just because it's hip-hop.
  const crestDeviationDb = computeCrestDeviation(analysis.crestFactorDb, prior);
  const crestRatioMult = computeRatioMult(crestDeviationDb);
  const boundedRatio = clamp(
    goalProfile.baseRatio * crestRatioMult * genreMod.ratioMult,
    goalProfile.baseRatio * RATIO_ADJUSTMENT.minMult,
    goalProfile.baseRatio * RATIO_ADJUSTMENT.maxMult,
  );
  const ratio = roundRatio(boundedRatio);

  // Threshold: the dB level below the peak at which a hard-knee
  // compressor with this ratio produces `targetPeakGrDb` of GR on the
  // peak. Derivation:
  //    GR = (I − T) × (1 − 1/R)
  //    I − T = GR × R / (R − 1)
  //    T = I − GR × R / (R − 1)
  // The max() guard on the denominator is cheap insurance against
  // future refactors that loosen the ratio clamp.
  const inputOvershootDb =
    (goalProfile.targetPeakGrDb * ratio) / Math.max(ratio - 1, 0.01);
  const thresholdDb = roundDb(analysis.peakDb - inputOvershootDb);

  // Makeup: "auto" estimates average GR as half of peak GR — a sane
  // starting point for typical music (true ratio of avg-to-peak GR
  // depends on dynamics, but 0.5 is a better default than parity).
  // Explicit `relativeDb` goals (parallel-punch uses 0 — the dry signal
  // carries the level) pass through directly.
  const rawMakeupDb =
    goalProfile.makeupStrategy === "auto"
      ? goalProfile.targetPeakGrDb * 0.5
      : goalProfile.makeupStrategy.relativeDb;
  const makeupDb = roundDb(rawMakeupDb);

  return {
    settings: { thresholdDb, ratio, attackMs, releaseMs, kneeDb, makeupDb },
    prior,
    goal: goalProfile,
    genre: genreMod,
    adjustments: {
      crestDeviationDb,
      crestRatioMult,
      genreRatioMult: genreMod.ratioMult,
      targetPeakGrDb: goalProfile.targetPeakGrDb,
    },
  };
}

// ─── Crest-to-ratio adjustment ─────────────────────────────────────

function computeCrestDeviation(
  measuredCrestDb: number,
  prior: InstrumentPrior,
): number {
  if (!Number.isFinite(measuredCrestDb)) return 0;
  const [low, high] = prior.typicalCrestDb;
  return measuredCrestDb - (low + high) / 2;
}

/**
 * Map crest deviation (measured − typical-midpoint, dB) to a multiplier
 * on `goal.baseRatio`:
 *
 *   flatter than typical  → maxMult  (already-consistent source, a higher
 *                                     ratio evens it out further)
 *   peakier than typical  → minMult  (transient-heavy source, a lower
 *                                     ratio avoids crushing the peaks)
 *
 * Saturates at ±`RATIO_ADJUSTMENT.saturationDb`. The two halves are
 * interpolated separately so the midpoint (deviation = 0) always lands
 * on exactly 1.0, regardless of how asymmetric minMult/maxMult are.
 */
function computeRatioMult(crestDeviationDb: number): number {
  const { minMult, maxMult, saturationDb } = RATIO_ADJUSTMENT;
  const t = clamp(crestDeviationDb / saturationDb, -1, 1);
  return t >= 0 ? lerp(1, minMult, t) : lerp(1, maxMult, -t);
}

// ─── Rounding to plugin-GUI-readable steps ─────────────────────────
//
// The engine produces continuous values; a compressor plugin dials in
// discrete steps. Each helper rounds to the step size a typical plugin
// GUI would let the user pick, so recommendations look like real settings
// rather than suspicious-feeling decimals.

function roundRatio(r: number): number {
  return r < 10 ? roundToNearest(r, 0.1) : roundToNearest(r, 0.5);
}

function roundMs(ms: number): number {
  if (ms < 1) return roundToNearest(ms, 0.1);
  if (ms < 10) return roundToNearest(ms, 0.5);
  if (ms < 100) return roundToNearest(ms, 1);
  return roundToNearest(ms, 5);
}

function roundDb(db: number): number {
  return roundToNearest(db, 0.5);
}

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

// ─── Numeric helpers ───────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
