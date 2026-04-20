// Explanations generator.
//
// Turns raw measurements + chosen settings into plain-English prose a
// mixing engineer could say out loud to a student. Three outputs:
//
//   summary           — one sentence describing the source in terms of
//                       dynamics, transient content, and level
//   settingsRationale — two sentences tying ratio + attack + release
//                       back to what the source needs
//   commonMistake     — one sentence warning if the audio has a
//                       characteristic that would make the default
//                       advice misleading (already-consistent, too
//                       peaky to crush, running hot, etc.), null
//                       otherwise
//
// Pure functions — no React, no DOM, no async. Can be unit-tested in
// isolation, and every branch is a prose template keyed to a measurement
// band. Tweak copy here, not in the component.

import type { AudioAnalysisResult } from "./audioAnalysis";
import type { CompressionSettings } from "./calibration";
import { dynamicRangeDb } from "./stats";
import type { InstrumentType } from "./types";

// ─── Public types ──────────────────────────────────────────────────

export type Explanation = {
  summary: string;
  settingsRationale: string;
  commonMistake: string | null;
};

/**
 * Subset of the recommendation's `adjustments` block that the
 * explanation generator needs. Declared separately so we don't pull in
 * `CompressionRecommendation` (which would make the engine and this
 * module co-dependent at the type level).
 */
export type ExplanationAdjustments = {
  crestDeviationDb: number;
  targetPeakGrDb: number;
};

// ─── Entry point ───────────────────────────────────────────────────

export function buildExplanation(
  analysis: AudioAnalysisResult,
  settings: CompressionSettings,
  adjustments: ExplanationAdjustments,
  instrument: InstrumentType,
): Explanation {
  return {
    summary: describeSource(analysis, instrument),
    settingsRationale: explainSettings(settings, adjustments),
    commonMistake: pickCommonMistake(analysis, settings, instrument),
  };
}

// ─── Source description ────────────────────────────────────────────

/**
 * Natural-language noun for each instrument, used in "Your {noun}..."
 * openings. Differs from the UI option labels: kebab-case values become
 * spaces ("acoustic guitar"), "full-mix" reads as "mix", and the "other"
 * fallback becomes "source" so the sentence doesn't say "your other".
 */
const INSTRUMENT_NOUN: Readonly<Record<InstrumentType, string>> = {
  vocal: "vocal",
  kick: "kick",
  snare: "snare",
  bass: "bass",
  "acoustic-guitar": "acoustic guitar",
  "electric-guitar": "electric guitar",
  piano: "piano",
  "full-mix": "mix",
  other: "source",
};

function describeSource(
  analysis: AudioAnalysisResult,
  instrument: InstrumentType,
): string {
  const noun = INSTRUMENT_NOUN[instrument];
  const dr = dynamicRangeDb(analysis.loudnessOverTime.rmsDb);
  return `Your ${noun} has ${describeDynamics(dr)}, ${describeCrest(analysis.crestFactorDb)}, and ${describePeak(analysis.peakDb)}.`;
}

function describeDynamics(dr: number): string {
  if (dr < 5) return `very tight dynamics (${dr.toFixed(1)} dB range)`;
  if (dr < 10) return `tight dynamics (${dr.toFixed(1)} dB range)`;
  if (dr < 15) return `moderate dynamics (${dr.toFixed(1)} dB range)`;
  if (dr < 20) return `wide dynamics (${dr.toFixed(1)} dB range)`;
  return `very wide dynamics (${dr.toFixed(1)} dB range)`;
}

function describeCrest(crest: number): string {
  if (crest < 5) return `heavily compressed peaks (${crest.toFixed(1)} dB crest)`;
  if (crest < 9) return `limited peaks (${crest.toFixed(1)} dB crest)`;
  if (crest < 13) return `balanced transient content (${crest.toFixed(1)} dB crest)`;
  if (crest < 19) return `sharp transients (${crest.toFixed(1)} dB crest)`;
  return `very sharp transients (${crest.toFixed(1)} dB crest)`;
}

function describePeak(peak: number): string {
  if (peak >= -0.5) return `peaks at full scale`;
  if (peak >= -3) return `minimal headroom (peak at ${peak.toFixed(1)} dB)`;
  if (peak >= -12) return `healthy headroom (peak at ${peak.toFixed(1)} dB)`;
  if (peak >= -24) return `conservative level (peak at ${peak.toFixed(1)} dB)`;
  return `quiet level (peak at ${peak.toFixed(1)} dB)`;
}

// ─── Settings rationale ────────────────────────────────────────────

function explainSettings(
  settings: CompressionSettings,
  adjustments: ExplanationAdjustments,
): string {
  const { ratio, attackMs, releaseMs } = settings;

  // Sentence 1: ratio + attack together — they act as a pair, because
  // "what ratio catches which peaks how fast" is one mental model.
  const character = ratioCharacter(ratio);
  const opener = aAn(character);
  const ratioSentence =
    `${opener} ${character} ${formatRatio(ratio)} ratio with a ${attackSpeedLabel(attackMs)} ${formatMs(attackMs)} ms attack ` +
    `${ratioAttackAction(ratio, attackMs, adjustments.crestDeviationDb)}.`;

  // Sentence 2: release — stands alone, different mental model
  // ("how fast does it let go").
  const releaseSentence = `The ${formatMs(releaseMs)} ms release ${releaseBehaviour(releaseMs)}.`;

  return `${ratioSentence} ${releaseSentence}`;
}

function ratioCharacter(r: number): string {
  if (r < 2.5) return "gentle";
  if (r < 4) return "moderate";
  if (r < 6) return "firm";
  return "aggressive";
}

function attackSpeedLabel(a: number): string {
  if (a < 5) return "fast";
  if (a < 15) return "moderate";
  if (a < 30) return "slower";
  return "slow";
}

function ratioAttackAction(
  ratio: number,
  attackMs: number,
  crestDeviationDb: number,
): string {
  // Describe what the ratio × attack combination actually accomplishes,
  // incorporating the crest context so the sentence explains WHY as well
  // as WHAT. Combinations ordered roughly most-to-least aggressive.
  const fast = attackMs < 10;
  const highRatio = ratio >= 5;

  if (highRatio && fast && crestDeviationDb < -2) {
    return "pushes the ratio up because the source is already consistent — there are few hard peaks to catch, so more ratio translates into more evening-out";
  }
  if (highRatio && fast) {
    return "will catch peaks hard — the compressor clamps before the transient escapes";
  }
  if (highRatio && !fast) {
    return "lets the transient through untouched before applying heavy compression to the body";
  }
  if (!highRatio && fast && crestDeviationDb > 2) {
    return "keeps the ratio gentler than usual because the source is peakier than typical — too much ratio here would crush the transients that give it impact";
  }
  if (!highRatio && fast) {
    return "catches peaks firmly while leaving the body of the sound alone";
  }
  if (!highRatio && !fast) {
    return "sits mostly transparent, gently hugging only the loudest moments";
  }
  return "balances transient control with dynamic evening-out";
}

function releaseBehaviour(ms: number): string {
  if (ms < 40) return "recovers quickly, keeping the character tight and punchy";
  if (ms < 100) return "resets between phrases without audible pumping";
  if (ms < 200) return "tracks musical phrasing smoothly";
  return "stays clamped across phrases — compression acts more as glue than control";
}

// ─── Common-mistake detection ──────────────────────────────────────

function pickCommonMistake(
  analysis: AudioAnalysisResult,
  settings: CompressionSettings,
  instrument: InstrumentType,
): string | null {
  // Priority order matters — we only show one mistake. Each branch is
  // "if this is true, the default advice needs a caveat more urgent
  // than anything below it."

  // 1. Full-mix has its own caution regardless of measurements — heavy
  //    bus compression is a well-known mix-killer.
  if (instrument === "full-mix") {
    return "Heavy bus compression kills a mix. Aim for 1–2 dB peak GR at most — if you want more dynamic control, compress the individual elements first.";
  }

  // 2. Already-consistent source — further compression flattens more
  //    than it helps. Either condition triggers: narrow P90-P10 range
  //    OR very low stdDev across the loudness series.
  const dr = dynamicRangeDb(analysis.loudnessOverTime.rmsDb);
  const stdDev = analysis.loudnessOverTime.stdDevDb;
  const drSignalIsConsistent = dr > 0 && dr < 8;
  const stdDevSignalIsConsistent = stdDev > 0 && stdDev < 1.5;
  if (drSignalIsConsistent || stdDevSignalIsConsistent) {
    return "This signal is already fairly consistent. Heavy compression here will make it sound lifeless — consider parallel compression, or accept that the settings below will only nudge rather than transform.";
  }

  // 3. Peakier than typical — warn about crushing transients. Reference
  //    the actual threshold so the advice is actionable rather than
  //    generic.
  if (analysis.crestFactorDb > 18) {
    return `With peaks this sharp (${analysis.crestFactorDb.toFixed(1)} dB crest), don't pull the threshold below ${settings.thresholdDb.toFixed(1)} dB — you'll crush the transients that give the source its impact. If more taming is needed, raise the ratio before lowering the threshold.`;
  }

  // 4. Running hot — clipping flag or very-loud RMS (matches the
  //    "Very loud" classifier band at ≥ -9 dB).
  if (analysis.qualityFlags.clipping || analysis.rmsDb > -9) {
    return "The signal is already running hot. Compressing further leaves no room to breathe — consider pulling the source level down before compressing, or back the ratio off by a notch.";
  }

  // 5. Very quiet source — compression mostly acts as level-raise. Not
  //    wrong, but the user should know that's what's happening.
  if (analysis.peakDb < -18) {
    return `This is a quiet signal (peak at ${analysis.peakDb.toFixed(1)} dB). Most of the "compression" here is really just level raise — if you want actual dynamic control, normalise or limit the source first, then compress.`;
  }

  return null;
}

// ─── Formatting helpers ────────────────────────────────────────────

function formatRatio(r: number): string {
  return Number.isInteger(r) ? `${r}:1` : `${r.toFixed(1)}:1`;
}

function formatMs(ms: number): string {
  // ≥ 10 ms: integer reads naturally in prose. < 10 ms: keep the
  // decimal so "1.5 ms" doesn't round to "2 ms" in the explanation
  // while the card still shows "1.5 ms".
  return ms >= 10 ? Math.round(ms).toString() : ms.toFixed(1);
}

/**
 * Pick "A" or "An" for a following word based on its first letter.
 * Simple vowel check — doesn't handle edge cases like "honour" or
 * "university", but all of our prose feeds in from closed-set adjective
 * lists so the simple rule covers every case.
 */
function aAn(word: string): string {
  return /^[aeiou]/i.test(word) ? "An" : "A";
}

// Dynamic range (P90 − P10) lives in ./stats now — the technique
// recommender is the third consumer the original local copy anticipated.
