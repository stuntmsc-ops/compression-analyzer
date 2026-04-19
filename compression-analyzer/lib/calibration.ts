// Calibration data for the compression recommendation engine.
//
// This file is pure reference data — no runtime logic. The engine
// (Day 14+) composes a final CompressionSettings by combining:
//
//   1. An InstrumentPrior — how the source naturally wants to be
//      compressed (time constants, knee character, expected crest range)
//   2. A GoalProfile — what the user is trying to accomplish (how much
//      gain reduction, how aggressive the ratio, how fast/slow relative
//      to the instrument's base time constants)
//   3. Measurements from AudioAnalysisResult — the actual RMS, peak,
//      and crest of the user's audio, which drive threshold and ratio
//      fine-tuning
//
// Values are drawn from standard mixing practice — the kind of numbers
// a working engineer reaches for first, not magic constants. They are
// the *starting point*, not the final answer. The engine adjusts them
// based on what it measures.

import type { InstrumentType, Genre, CompressionGoal } from "./types";

/**
 * A complete set of compressor settings, as a mixing engineer would
 * read them off a plugin GUI. All fields use conventional units.
 */
export type CompressionSettings = {
  /** Threshold in dB. Negative — signal above this gets compressed. */
  thresholdDb: number;
  /** Compression ratio. 4 means 4:1 (4dB in → 1dB out above threshold). */
  ratio: number;
  /** Attack time in milliseconds. Time to reach ~63% of target GR. */
  attackMs: number;
  /** Release time in milliseconds. Time to recover ~63% back toward 0 GR. */
  releaseMs: number;
  /** Soft-knee width in dB. 0 = hard knee. */
  kneeDb: number;
  /** Makeup gain in dB, applied post-compression. */
  makeupDb: number;
};

/**
 * Per-instrument character that doesn't change based on the user's goal.
 * Captures "how a vocal wants to be compressed" vs "how a kick wants to
 * be compressed" — the time constants and knee shape that flatter the
 * source regardless of how much compression you apply.
 */
export type InstrumentPrior = {
  /**
   * Baseline attack in ms for this source. Chosen to sit in the sweet
   * spot between "catches transients" and "preserves the initial punch
   * that makes the source recognisable". Goal profiles multiply this.
   */
  attackMs: number;
  /** Baseline release in ms. Musical pacing for the source. */
  releaseMs: number;
  /**
   * Baseline knee width in dB. Softer on sustained/harmonically-rich
   * sources (vocals, piano), harder on transient-heavy sources (drums).
   * Goal profiles add a delta.
   */
  kneeDb: number;
  /**
   * Expected crest-factor range (dB) for a "typical" recording of this
   * source. If the measured crest sits inside this band the engine
   * treats it as unremarkable and uses the base ratio. If it lands
   * above or below, the engine adjusts the ratio (see Day 14).
   */
  typicalCrestDb: readonly [number, number];
  /** Human-readable rationale, surfaced by the UI as "why these settings". */
  notes: string;
};

/**
 * Per-goal behaviour — what to do TO the source, independent of what
 * the source is. A "control peaks" goal on a vocal and on a bass uses
 * different time constants (because the sources differ), but both use
 * the same goal-level strategy: fast-ish response, moderate ratio,
 * target a few dB of GR on the peaks.
 */
export type GoalProfile = {
  /**
   * Target amount of gain reduction in dB *at the peak* of the signal.
   * The engine sets threshold so that the loudest moment hits roughly
   * this much GR (given the ratio). Small number = gentle compression,
   * large number = heavy.
   */
  targetPeakGrDb: number;
  /**
   * Base ratio before crest-factor adjustment. The engine raises it
   * for already-flat material (low measured crest) and lowers it for
   * very peaky material (high measured crest) to avoid over-compressing.
   */
  baseRatio: number;
  /**
   * Multiplier applied to the instrument's attack. <1 makes the attack
   * faster (control-peaks), >1 makes it slower (add-warmth / pumping).
   */
  attackMult: number;
  /** Multiplier applied to the instrument's release. */
  releaseMult: number;
  /**
   * Knee width delta in dB added to the instrument's knee. Negative =
   * harder knee (more obvious character), positive = softer knee (more
   * transparent).
   */
  kneeDeltaDb: number;
  /**
   * Makeup strategy. "auto" recovers roughly the gain that was reduced.
   * A numeric dB value asks the engine to target that post-compression
   * RMS relative to the input (used by aggressive goals that want the
   * output deliberately louder or quieter).
   */
  makeupStrategy: "auto" | { relativeDb: number };
  /** Human-readable rationale. */
  notes: string;
};

// ─── Instrument priors ─────────────────────────────────────────────

export const INSTRUMENT_PRIORS: Readonly<Record<InstrumentType, InstrumentPrior>> = {
  vocal: {
    attackMs: 8,
    releaseMs: 120,
    kneeDb: 6,
    typicalCrestDb: [14, 22],
    notes:
      "Vocals reward a moderately fast attack that still lets the initial consonant through, paired with a release slow enough to track the phrase. A soft knee keeps compression transparent on sustained notes.",
  },
  kick: {
    attackMs: 15,
    releaseMs: 60,
    kneeDb: 2,
    typicalCrestDb: [10, 18],
    notes:
      "Slow attack preserves the beater click that defines the kick's identity; fast release lets it breathe between hits. A harder knee keeps the compression feeling punchy rather than squashed.",
  },
  snare: {
    attackMs: 5,
    releaseMs: 80,
    kneeDb: 2,
    typicalCrestDb: [12, 20],
    notes:
      "Fast attack catches the stick transient without losing all the snap. Medium release lets the shell ring decay naturally. Hard knee suits the short, percussive envelope.",
  },
  bass: {
    attackMs: 20,
    releaseMs: 150,
    kneeDb: 4,
    typicalCrestDb: [8, 14],
    notes:
      "Slower attack lets the pick/slap attack through before clamping the sustain — bass needs its transient to stay audible in a mix. Long release preserves body and avoids pumping on sustained notes.",
  },
  "acoustic-guitar": {
    attackMs: 10,
    releaseMs: 100,
    kneeDb: 6,
    typicalCrestDb: [14, 22],
    notes:
      "Acoustic instruments are dynamic by nature. Moderate attack preserves pick definition, soft knee keeps the compression transparent on the rich harmonic content.",
  },
  "electric-guitar": {
    attackMs: 12,
    releaseMs: 80,
    kneeDb: 3,
    typicalCrestDb: [10, 18],
    notes:
      "Electric guitar already has amplifier compression baked in. Medium attack/release sits on top of that without double-clamping. Knee kept firmish for a tight, forward sound.",
  },
  piano: {
    attackMs: 8,
    releaseMs: 140,
    kneeDb: 5,
    typicalCrestDb: [12, 22],
    notes:
      "Piano attacks are fast and important — a short attack time catches transient peaks without dulling the strike. Long release tracks sustained chords; soft knee stays natural.",
  },
  "full-mix": {
    attackMs: 30,
    releaseMs: 200,
    kneeDb: 8,
    typicalCrestDb: [8, 16],
    notes:
      "Mix-bus compression earns its keep by being invisible. Slow attack avoids clamping drum transients; long release stays out of the way of musical phrases; very soft knee smooths everything into cohesion.",
  },
  other: {
    attackMs: 15,
    releaseMs: 120,
    kneeDb: 4,
    typicalCrestDb: [10, 20],
    notes:
      "Balanced starting point for uncategorised sources. Engine will lean harder on measured crest factor to refine the settings.",
  },
} as const;

// ─── Goal profiles ─────────────────────────────────────────────────

export const GOAL_PROFILES: Readonly<Record<CompressionGoal, GoalProfile>> = {
  "control-peaks": {
    targetPeakGrDb: 4,
    baseRatio: 4,
    attackMult: 0.5,
    releaseMult: 0.6,
    kneeDeltaDb: -2,
    makeupStrategy: "auto",
    notes:
      "Peak control uses a faster attack and a moderately high ratio so transient spikes get caught. Faster release lets the compressor reset before the next peak. Target ~4dB GR on the loudest moments — enough to tame, not so much that it colours the sound.",
  },
  "add-warmth": {
    targetPeakGrDb: 2,
    baseRatio: 2,
    attackMult: 1.5,
    releaseMult: 1.3,
    kneeDeltaDb: 2,
    makeupStrategy: "auto",
    notes:
      "Warmth comes from very gentle, slow compression that barely touches transients but gently hugs the body of the signal. Low ratio, slow attack, softer knee. The goal is coloration, not control.",
  },
  "parallel-punch": {
    targetPeakGrDb: 10,
    baseRatio: 6,
    attackMult: 0.3,
    releaseMult: 0.5,
    kneeDeltaDb: -4,
    makeupStrategy: { relativeDb: 0 },
    notes:
      "Aggressive compression designed to be blended underneath the dry signal. Very fast attack and high ratio deliberately squash transients; the resulting sustain and thickness get blended in parallel, not used as the primary signal.",
  },
  "smooth-consistency": {
    targetPeakGrDb: 5,
    baseRatio: 3,
    attackMult: 1.2,
    releaseMult: 1.1,
    kneeDeltaDb: 1,
    makeupStrategy: "auto",
    notes:
      "Moderate ratio, moderate time constants, slightly softer knee. The aim is evening out phrase-to-phrase level variation without the listener noticing compression is happening. A touch slower than peak-control to stay transparent.",
  },
  "aggressive-pumping": {
    targetPeakGrDb: 8,
    baseRatio: 8,
    attackMult: 1.8,
    releaseMult: 2.0,
    kneeDeltaDb: -3,
    makeupStrategy: "auto",
    notes:
      "The goal here is audible compression character — you want to hear it breathing. Slow attack + slow release makes the pump rhythmic and obvious. High ratio + harder knee makes each pump decisive rather than subtle.",
  },
} as const;

// ─── Genre modifiers ───────────────────────────────────────────────

/**
 * Per-genre multiplicative character, applied on top of the
 * instrument × goal composition. Captures aesthetic preferences that
 * cut across instrument + goal — "hip-hop wants punchy and forward",
 * "R&B wants warm and round", "lo-fi uses compression as an effect".
 *
 * All fields are relative — 1.0 means "no adjustment". The engine
 * multiplies these into the base values after the goal multipliers,
 * which stacks the genre flavour on top of the goal's intent without
 * redefining what the goal wants to do.
 */
export type GenreModifier = {
  /** Additional scalar on attack time. <1 faster, >1 slower. */
  attackMult: number;
  /** Additional scalar on release time. <1 faster, >1 slower. */
  releaseMult: number;
  /** Additional scalar on ratio. >1 more aggressive, <1 gentler. */
  ratioMult: number;
  /** Additional delta on knee width (dB). Negative = harder. */
  kneeDeltaDb: number;
  /** Human-readable rationale, surfaced by the UI "why" panel. */
  notes: string;
};

export const GENRE_MODIFIERS: Readonly<Record<Genre, GenreModifier>> = {
  "hip-hop": {
    attackMult: 0.7,
    releaseMult: 0.85,
    ratioMult: 1.15,
    kneeDeltaDb: -1,
    notes:
      "Hip-hop and trap lean on punchy, forward compression — a faster attack grabs transients and a slightly harder knee gives the compressor more grip. The result feels deliberate and modern.",
  },
  rnb: {
    attackMult: 1.2,
    releaseMult: 1.1,
    ratioMult: 0.9,
    kneeDeltaDb: 1,
    notes:
      "R&B flatters body and warmth. Slower attack lets the initial consonant through, softer knee keeps the compressor invisible, slightly lower ratio preserves the room and breath of the performance.",
  },
  pop: {
    attackMult: 0.9,
    releaseMult: 0.95,
    ratioMult: 1.1,
    kneeDeltaDb: 0,
    notes:
      "Pop compression is tight and radio-ready — enough ratio and speed to stay consistent across a verse/chorus/bridge, but never so aggressive that it calls attention to itself.",
  },
  rock: {
    attackMult: 1.3,
    releaseMult: 0.9,
    ratioMult: 0.9,
    kneeDeltaDb: -1,
    notes:
      "Rock lives on its transients. Slower attack preserves the pick and stick attack, gentler ratio leaves dynamic push intact, and a slightly harder knee keeps the compression feeling decisive rather than smeared.",
  },
  edm: {
    attackMult: 0.85,
    releaseMult: 0.7,
    ratioMult: 1.1,
    kneeDeltaDb: 0,
    notes:
      "Electronic production wants tight, punchy compression with a fast release — the quick recovery feeds into the pump-and-release aesthetic that gives EDM its forward motion.",
  },
  lofi: {
    attackMult: 1.1,
    releaseMult: 1.3,
    ratioMult: 1.25,
    kneeDeltaDb: -2,
    notes:
      "Lo-fi treats compression as a colour, not a tool. Slower release and higher ratio make the pumping audible; harder knee adds the nonlinear character that keeps the sound feeling hand-made rather than transparent.",
  },
  other: {
    attackMult: 1,
    releaseMult: 1,
    ratioMult: 1,
    kneeDeltaDb: 0,
    notes:
      "No genre-specific adjustment — settings reflect the source and goal only.",
  },
} as const;

// ─── Ratio-from-crest adjustment ───────────────────────────────────

/**
 * Bounds within which the engine may multiply GoalProfile.baseRatio
 * based on measured crest factor. Tight bounds keep the recommendation
 * defensible — we'll never recommend 20:1 on a gentle-warmth goal just
 * because the source happened to be flat.
 */
export const RATIO_ADJUSTMENT = {
  /** Minimum multiplier applied to base ratio regardless of crest. */
  minMult: 0.6,
  /** Maximum multiplier applied to base ratio regardless of crest. */
  maxMult: 1.5,
  /**
   * Difference in dB between measured crest and the midpoint of the
   * instrument's typicalCrestDb range at which the multiplier reaches
   * its extremes. ±6 dB means a source that's 6dB peakier than typical
   * gets the minMult (gentler ratio), and one 6dB flatter gets maxMult.
   */
  saturationDb: 6,
} as const;
