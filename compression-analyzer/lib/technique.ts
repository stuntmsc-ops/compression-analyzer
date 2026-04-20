// Technique recommender.
//
// The settings engine answers "what knob positions?" This module answers
// the different, more educational question: "what compression *approach*
// does this source call for?" A single-compressor setup is the default,
// but some sources benefit dramatically from:
//
//   - Serial compression   (two compressors in series: peak-catcher +
//                           level-smoother). For sources where peaks
//                           and level swings are both independently
//                           problems — one compressor would have to
//                           choose between them and do neither well.
//   - Parallel compression (blend a crushed duplicate under the dry
//                           signal). Adds density/weight while
//                           preserving transients. Textbook technique
//                           for drums and bass; also the right call for
//                           sources that are already fairly consistent
//                           and would sound lifeless under further
//                           serial compression.
//   - Bus compression      (gentle glue on the master/2-bus, 1–2 dB
//                           GR max). Only applies to full-mix sources
//                           — heavy compression on the whole mix
//                           crushes whichever element happens to be
//                           loudest and throws the balance off.
//   - Standard             (a single compressor with the recommended
//                           settings is the right call). The default
//                           when no specialised technique is warranted.
//
// Decision is purely analytical — no user input beyond selectors. The
// content of each recommendation is written like a one-paragraph lesson
// with 3–4 numbered steps the producer can follow, so the tool acts as
// a coach rather than a calculator. Plan: "The tool now gives settings
// AND teaches technique."

import type { AudioAnalysisResult } from "./audioAnalysis";
import { dynamicRangeDb } from "./stats";
import type { InstrumentType } from "./types";

// ─── Public types ──────────────────────────────────────────────────

export type TechniqueId = "bus" | "serial" | "parallel" | "standard";

export type Technique = {
  id: TechniqueId;
  /** Short title shown in the card header, e.g. "Parallel compression". */
  title: string;
  /** One-sentence hook: what this technique achieves, in plain language. */
  tagline: string;
  /**
   * Why *this* source specifically got this recommendation. References
   * the measurement (crest, DR) or the instrument where relevant, so the
   * user sees the reasoning rather than a generic "try parallel."
   */
  reason: string;
  /** 3–4 numbered steps the producer can follow in their DAW. */
  steps: string[];
};

// ─── Decision thresholds ───────────────────────────────────────────
//
// All magic numbers live here, named and commented, so future tuning
// doesn't require reading the decision tree to figure out what changes.

/**
 * Crest factor (dB) above which a source is meaningfully "peaky" — the
 * same cutoff `explanations.ts` uses for the crest caveat. Shared
 * threshold so the warning and the technique advice agree about what
 * "sharp peaks" means.
 */
const SERIAL_CREST_DB = 18;

/**
 * Dynamic range (P90 − P10, dB) above which a source has meaningful
 * level variation on top of the peaks. Serial compression needs *both*
 * a peak problem and a level problem — one alone is handled by the
 * recommended single-pass settings.
 */
const SERIAL_DR_DB = 10;

/**
 * Dynamic range below which a source is already consistent enough that
 * further serial compression would flatten the life out of it. Stricter
 * than the consistency *caveat* (dr < 8) because this is a positive
 * prescription — we're recommending users actively change their
 * approach, not just warning them off a default.
 */
const PARALLEL_CONSISTENT_DR_DB = 6;

/** Companion threshold on stdDev for the "already-consistent" trigger. */
const PARALLEL_CONSISTENT_STDDEV_DB = 1.2;

/** Instruments that default to parallel compression regardless of measurement. */
const PARALLEL_DEFAULT_INSTRUMENTS: readonly InstrumentType[] = [
  "kick",
  "snare",
  "bass",
];

// ─── Main entry point ──────────────────────────────────────────────

export function recommendTechnique(
  analysis: AudioAnalysisResult,
  instrument: InstrumentType,
): Technique {
  // Full-mix is a hard rule — a 2-bus compressor is the only place
  // compression belongs on a finished mix, and the advice is the same
  // regardless of dynamics.
  if (instrument === "full-mix") {
    return BUS_TECHNIQUE;
  }

  const dr = dynamicRangeDb(analysis.loudnessOverTime.rmsDb);
  const stdDev = analysis.loudnessOverTime.stdDevDb;
  const crest = analysis.crestFactorDb;

  // Serial: both peaks and level variation are independently problems.
  // Checked before the drum/bass default because a drum performance with
  // extreme dynamics genuinely benefits more from serial than parallel.
  if (
    Number.isFinite(crest) &&
    crest > SERIAL_CREST_DB &&
    dr > SERIAL_DR_DB
  ) {
    return buildSerial(crest, dr);
  }

  // Drum/bass default: parallel is the textbook move for adding weight
  // without losing transient snap.
  if (PARALLEL_DEFAULT_INSTRUMENTS.includes(instrument)) {
    return buildParallelForPercussive(instrument);
  }

  // Already-consistent source (tighter cut than the caveat). Uses OR:
  // either signal alone is enough to say "this is already flat."
  const consistentByDr = dr > 0 && dr < PARALLEL_CONSISTENT_DR_DB;
  const consistentByStdDev =
    stdDev > 0 && stdDev < PARALLEL_CONSISTENT_STDDEV_DB;
  if (consistentByDr || consistentByStdDev) {
    return buildParallelForConsistent(dr, stdDev);
  }

  return STANDARD_TECHNIQUE;
}

// ─── Technique content ────────────────────────────────────────────

const BUS_TECHNIQUE: Technique = {
  id: "bus",
  title: "Bus compression (gentle glue)",
  tagline:
    "Treat the master as one performance — soften peaks and knit the mix together without audibly compressing any single element.",
  reason:
    "On a full mix, heavy compression crushes whichever element happens to be loudest in the moment and throws the balance off. The goal is subtle — listeners should feel cohesion, not compression.",
  steps: [
    "Place a single compressor on the master or 2-bus — after individual-track processing, before the final limiter.",
    "Use a slow attack (10–30 ms) so transients pass through, and a medium or auto release so the compressor breathes with the music.",
    "Aim for 1–2 dB of gain reduction on the loudest sections — more than that and the mix will start to pump.",
    "Bypass and re-engage while listening. If the difference isn't subtle, raise the threshold.",
  ],
};

const STANDARD_TECHNIQUE: Technique = {
  id: "standard",
  title: "Standard single-pass compression",
  tagline:
    "One compressor with the settings above is all this source needs — not peaky enough to need serial, not flat enough to need parallel.",
  reason:
    "The source sits in a reasonable dynamic range. A single compressor can catch the peaks and shape the level together without compromise.",
  steps: [
    "Insert a single compressor on the track.",
    "Dial in the threshold, ratio, attack, and release from the card above.",
    "Watch the gain-reduction meter — you should see roughly 3–5 dB on peaks and about half that on average.",
    "If compression starts to pump or sound pinched, raise the threshold 1–2 dB or lengthen the release.",
  ],
};

function buildSerial(crestDb: number, drDb: number): Technique {
  return {
    id: "serial",
    title: "Serial compression",
    tagline:
      "Two compressors doing one job each, instead of one compressor doing two jobs badly.",
    reason: `Your source has ${crestDb.toFixed(1)} dB crest and ${drDb.toFixed(1)} dB of level variation. One compressor would have to choose between catching fast peaks and smoothing the long-term level — its attack is either too fast (dulls the body) or too slow (lets peaks through). Splitting the work across two compressors lets each one be tuned for exactly one job.`,
    steps: [
      "Insert two compressors in series on this track.",
      "First compressor — peak catcher: fast attack (1–3 ms), high ratio (6:1–10:1), threshold set so it only catches the top 2–4 dB of the loudest peaks.",
      "Second compressor — level smoother: slower attack (10–20 ms), lower ratio (2:1–3:1), targeting 3–5 dB of gain reduction on average passages.",
      "Total gain reduction across both should feel musical — roughly 4–6 dB combined at the loudest moments, not 10+.",
    ],
  };
}

function buildParallelForPercussive(instrument: InstrumentType): Technique {
  const noun =
    instrument === "kick"
      ? "kick"
      : instrument === "snare"
        ? "snare"
        : "bass";
  return {
    id: "parallel",
    title: "Parallel compression",
    tagline:
      "Blend a crushed duplicate underneath the dry signal — weight and density without losing transient snap.",
    reason: `${capitalise(noun)} tracks benefit from parallel compression almost universally. The dry signal keeps its attack intact while the compressed copy adds sustain and body underneath — the best of both worlds.`,
    steps: [
      "Send the track to a parallel bus (or duplicate the track).",
      "On the parallel copy, set a fast attack, 8:1–10:1 ratio, and pull the threshold low enough for 8–12 dB of gain reduction.",
      "Blend the parallel bus in underneath the dry — start around 20–30% and adjust by ear.",
      "If the low end muddies up, high-pass the parallel bus above 100–150 Hz so only the midrange density blends in.",
    ],
  };
}

function buildParallelForConsistent(drDb: number, stdDevDb: number): Technique {
  // Pick whichever measurement actually tripped the branch for the
  // prose — "3.2 dB range" reads more concretely than quoting both.
  const usingDr = drDb > 0 && drDb < PARALLEL_CONSISTENT_DR_DB;
  const evidence = usingDr
    ? `only ${drDb.toFixed(1)} dB of level variation`
    : `a ${stdDevDb.toFixed(1)} dB loudness stdDev`;
  return {
    id: "parallel",
    title: "Parallel compression",
    tagline:
      "Layer density on top of a signal that's already consistent — keep the original dynamics intact and blend in thickness underneath.",
    reason: `This source is already fairly consistent (${evidence} across the clip). Heavy serial compression would flatten it further and make it sound lifeless; parallel leaves the dry signal untouched and adds weight from the crushed copy underneath.`,
    steps: [
      "Send the track to a parallel bus (or duplicate the track).",
      "On the parallel copy, use a fast attack, 8:1–10:1 ratio, and threshold low enough for 8–12 dB of gain reduction — crushing it is the point.",
      "Blend the parallel bus in at 15–25% underneath the original. The dry signal should still dominate.",
      "A/B against the dry track frequently. If the character changes, pull the blend back.",
    ],
  };
}

// ─── Small helper ─────────────────────────────────────────────────

function capitalise(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
