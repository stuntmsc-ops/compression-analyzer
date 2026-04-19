/**
 * Classifier thresholds for the audio profile labels.
 *
 * ─── Day 14 calibration target ────────────────────────────────────
 *
 * This is the single file to edit when tuning the "Loud / Peaky /
 * Wide" labels against reference audio. Every classifier is a small
 * ladder of thresholds — pick the boundary, run a known reference
 * track through the app, check the label reads true, adjust.
 *
 * Each threshold has a reference anchor in the comment above it —
 * an example of a real-world source that should land in that band.
 * Those anchors are the calibration targets, not academic definitions.
 *
 * Conventions:
 *   - Every classifier returns a { label, description } pair. Label
 *     is the short adjective ("Loud"), description is the plain-English
 *     sentence ("typical for finished masters"). The card renders
 *     them as "Label — description".
 *   - Thresholds read top-down from "worst" to "best" for metrics
 *     where higher is louder/hotter (rmsDb, peakDb), and low-to-high
 *     for metrics where higher means more variation/brightness
 *     (crestDb, rangeDb, centroidHz). Pick whichever direction
 *     reads most natural for the metric.
 */

export type Tag = { label: string; description: string };

// ─── Level: RMS (dB) ───────────────────────────────────────────────
//
// Calibration anchors:
//   -6 dB:  loud EDM / hyperpop master, right at the ceiling
//   -12 dB: modern pop master, finished and competitive
//   -18 dB: rock / indie mix before mastering
//   -28 dB: classical or jazz recording, plenty of headroom
//   -45 dB: quiet ambient tail or room tone
//
export function classifyRmsDb(rmsDb: number): Tag {
  if (!Number.isFinite(rmsDb))
    return { label: "Silent", description: "no measurable level" };
  if (rmsDb >= -9)
    return {
      label: "Very loud",
      description: "close to digital full scale",
    };
  if (rmsDb >= -15)
    return { label: "Loud", description: "typical for finished masters" };
  if (rmsDb >= -24)
    return { label: "Moderate", description: "normal mixing level" };
  if (rmsDb >= -40)
    return { label: "Quiet", description: "well below typical track level" };
  return { label: "Near silent", description: "likely noise floor or pre-roll" };
}

// ─── Level: Peak (dB) ──────────────────────────────────────────────
//
// Calibration anchors:
//   -0.1 dB: brickwall-limited master, ceiling hit
//   -1 dB:  master with a touch of true-peak margin
//   -6 dB:  healthy mix, ready for mastering
//   -18 dB: conservative tracking level
//   -30 dB: quiet section or near-silent passage
//
export function classifyPeakDb(peakDb: number): Tag {
  if (!Number.isFinite(peakDb))
    return { label: "Silent", description: "no measurable peak" };
  if (peakDb >= -0.1)
    return {
      label: "Peaking",
      description: "at full scale, check for clipping",
    };
  if (peakDb >= -3)
    return { label: "Hot", description: "minimal headroom remaining" };
  if (peakDb >= -12)
    return { label: "Healthy", description: "safe headroom for processing" };
  if (peakDb >= -24)
    return { label: "Low", description: "plenty of room, may need gain" };
  return { label: "Very low", description: "signal is quiet overall" };
}

// ─── Level: Crest factor (dB) ──────────────────────────────────────
//
// Peak-to-RMS ratio. How "peaky" the signal is. Derives from AES-17
// RMS, so a pure sine reads ~0 dB here (not the traditional 3 dB from
// textbook crest-factor derivations) — match DAW plugin conventions.
//
// Calibration anchors:
//   3 dB:   heavily limited modern master, transients squashed
//   7 dB:   typical streaming-loudness pop master
//   11 dB:  mixed content with gentle compression
//   15 dB:  dynamic recording, natural transients intact
//   21 dB+: raw / uncompressed drums, solo classical piano
//
export function classifyCrestDb(crestDb: number): Tag {
  if (crestDb <= 0)
    return { label: "—", description: "no peak-to-average spread measured" };
  if (crestDb < 5)
    return {
      label: "Very compressed",
      description: "peaks already heavily tamed",
    };
  if (crestDb < 9)
    return { label: "Limited", description: "peaks are under control" };
  if (crestDb < 13)
    return { label: "Moderate", description: "balanced transient content" };
  if (crestDb < 19)
    return { label: "Peaky", description: "sharp transients present" };
  return {
    label: "Very peaky",
    description: "extreme peak-to-average spread",
  };
}

// ─── Dynamics: Dynamic range (dB, P90 − P10) ───────────────────────
//
// How much the loudness varies between loud and quiet sections.
// Uses P90−P10 so the result is robust to silent edges.
//
// Calibration anchors:
//   3 dB:   brickwall-limited sustained tone, no swells
//   7 dB:   modern pop, tightly controlled
//   12 dB:  typical rock / indie track
//   18 dB:  dynamic live recording, quiet verse → loud chorus
//   25 dB+: classical performance with pianissimo → fortissimo
//
export function classifyDynamicRangeDb(rangeDb: number): Tag {
  if (rangeDb < 5)
    return { label: "Very tight", description: "loudness barely varies" };
  if (rangeDb < 10)
    return { label: "Tight", description: "consistent loudness throughout" };
  if (rangeDb < 15)
    return {
      label: "Moderate",
      description: "noticeable but contained variation",
    };
  if (rangeDb < 20)
    return { label: "Wide", description: "significant volume variation" };
  return {
    label: "Very wide",
    description: "highly dynamic, large level swings",
  };
}

// ─── Dynamics: Consistency (%, within ±3 dB of median) ─────────────
//
// Fraction of non-silent windows that sit within ±3 dB of the track's
// median loudness. Complements dynamic range — a highly variable track
// can still have a dominant "home" level.
//
// Calibration anchors:
//   95%: squashed limiter mastered track, nearly flat
//   80%: pop mix, consistent verse-to-chorus
//   65%: rock track with some quiet breakdowns
//   45%: dynamic recording, verses clearly quieter than choruses
//   20%: classical or film score with big swings
//
export function classifyConsistencyPct(pct: number): Tag {
  if (pct >= 85)
    return {
      label: "Very consistent",
      description: "nearly uniform level throughout",
    };
  if (pct >= 70)
    return {
      label: "Consistent",
      description: "mostly uniform with occasional variation",
    };
  if (pct >= 50)
    return {
      label: "Moderate",
      description: "some sections are noticeably louder",
    };
  if (pct >= 30)
    return { label: "Variable", description: "significant level swings" };
  return {
    label: "Very variable",
    description: "highly dynamic, constant level change",
  };
}

// ─── Tonal character: Spectral centroid (Hz) ───────────────────────
//
// "Center of mass" of the magnitude spectrum. Rough brightness proxy.
//
// Calibration anchors:
//   400 Hz:   sub-bass-heavy content (808s, low drones)
//   1000 Hz:  warm male vocal, low-mid-forward mix
//   2500 Hz:  full-range music, balanced mix, typical vocal
//   5500 Hz:  bright pop master, female vocal, cymbal-rich
//   8000 Hz+: hi-hat loop, sibilant vocal, lo-fi noise
//
export function classifyCentroidHz(hz: number): Tag {
  if (hz < 500)
    return { label: "Bass-heavy", description: "energy concentrated low" };
  if (hz < 1500)
    return { label: "Warm", description: "low-mid focused" };
  if (hz < 4000)
    return {
      label: "Mid-focused",
      description: "balanced, consistent with vocals and full-range music",
    };
  if (hz < 7000)
    return {
      label: "Bright",
      description: "emphasis on presence and highs",
    };
  return {
    label: "Very bright",
    description: "airy, percussive, or cymbal-like",
  };
}
