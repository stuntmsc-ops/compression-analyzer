import { describe, it, expect } from "vitest";
import type { AudioAnalysisResult } from "./audioAnalysis";
import { recommendCompression } from "./recommendationEngine";

/**
 * Build an AudioAnalysisResult fixture with sane defaults, overridable
 * per-field. Kept permissive so most tests only set the one or two
 * properties they care about.
 */
function mockAnalysis(
  overrides: Partial<AudioAnalysisResult> = {},
): AudioAnalysisResult {
  return {
    rms: 0.1,
    rmsDb: -20,
    peak: 0.9,
    peakDb: -0.9,
    crestFactorDb: 18,
    spectralCentroidHz: 2000,
    spectralRolloffHz: 8000,
    zeroCrossingRate: 1000,
    loudnessOverTime: {
      rmsDb: [-20, -19, -21, -20, -18, -22, -19, -21, -20, -19],
      hopSeconds: 0.1,
      stdDevDb: 1,
    },
    duration: 5,
    sampleRate: 44100,
    numChannels: 2,
    numFrames: 100,
    frameSize: 2048,
    qualityFlags: { tooShort: false, clipping: false, silent: false },
    ...overrides,
  };
}

describe("recommendCompression", () => {
  it("returns null for non-finite peak (silent audio)", () => {
    const analysis = mockAnalysis({ peakDb: -Infinity });
    expect(
      recommendCompression(analysis, "vocal", "pop", "control-peaks"),
    ).toBeNull();
  });

  it("returns a recommendation with non-null settings for normal input", () => {
    const rec = recommendCompression(
      mockAnalysis(),
      "vocal",
      "pop",
      "control-peaks",
    );
    expect(rec).not.toBeNull();
    expect(rec!.settings).toBeDefined();
    expect(rec!.explanation).toBeDefined();
  });

  it("gives a flatter source a higher ratio than a peakier one", () => {
    // Vocal typical crest band is [14, 22] (midpoint 18). A source at
    // crest 10 is 8 dB flatter than typical → ratio multiplier goes UP.
    // A source at crest 26 is 8 dB peakier → ratio multiplier goes DOWN.
    const flat = recommendCompression(
      mockAnalysis({ crestFactorDb: 10 }),
      "vocal",
      "other",
      "control-peaks",
    );
    const peaky = recommendCompression(
      mockAnalysis({ crestFactorDb: 26 }),
      "vocal",
      "other",
      "control-peaks",
    );
    expect(flat!.settings.ratio).toBeGreaterThan(peaky!.settings.ratio);
  });

  it("keeps ratio anchored within the goal's [minMult, maxMult] bounds", () => {
    // Extreme combination: very flat source + ratio-boosting genre +
    // high-ratio goal. Ratio must still respect the goal's maxMult cap
    // (1.5× base) so the user never gets a ratio higher than the goal
    // would produce by itself.
    const rec = recommendCompression(
      mockAnalysis({ crestFactorDb: 0 }),
      "vocal",
      "lofi",
      "aggressive-pumping",
    );
    expect(rec).not.toBeNull();
    // aggressive-pumping baseRatio = 8, maxMult = 1.5 → ratio cap 12.
    expect(rec!.settings.ratio).toBeLessThanOrEqual(12);

    // Gentle goal + peaky source: can't drop below 0.6 × base.
    const gentle = recommendCompression(
      mockAnalysis({ crestFactorDb: 30 }),
      "vocal",
      "hip-hop",
      "add-warmth",
    );
    expect(gentle).not.toBeNull();
    // add-warmth baseRatio = 2, minMult = 0.6 → ratio floor 1.2.
    expect(gentle!.settings.ratio).toBeGreaterThanOrEqual(1.2);
  });

  it("composes attack time from prior × goal × genre multipliers", () => {
    // Vocal prior attack 8 ms × control-peaks 0.5 × pop 0.9 = 3.6 ms,
    // rounded to 0.5-step → 3.5 ms.
    const rec = recommendCompression(
      mockAnalysis(),
      "vocal",
      "pop",
      "control-peaks",
    );
    expect(rec!.settings.attackMs).toBeCloseTo(3.5, 2);
  });

  it("never returns a negative knee", () => {
    // Kick prior knee 2 dB, parallel-punch delta -4, lofi delta -2.
    // Unclamped would give -4 dB — clamp is max(0, …) at the source.
    const rec = recommendCompression(
      mockAnalysis(),
      "kick",
      "lofi",
      "parallel-punch",
    );
    expect(rec!.settings.kneeDb).toBeGreaterThanOrEqual(0);
  });

  it("auto makeup recovers roughly half of the target peak GR", () => {
    // control-peaks targetPeakGrDb = 4 → auto makeup = 2 dB.
    const rec = recommendCompression(
      mockAnalysis(),
      "vocal",
      "other",
      "control-peaks",
    );
    expect(rec!.settings.makeupDb).toBeCloseTo(2, 1);
  });

  it("parallel-punch passes its explicit relativeDb through to makeup", () => {
    const rec = recommendCompression(
      mockAnalysis(),
      "kick",
      "other",
      "parallel-punch",
    );
    expect(rec!.settings.makeupDb).toBe(0);
  });

  it("reports crestDeviationDb relative to instrument typical midpoint", () => {
    // Vocal typical [14, 22], midpoint 18. Measured crest 20 → deviation +2.
    const rec = recommendCompression(
      mockAnalysis({ crestFactorDb: 20 }),
      "vocal",
      "other",
      "control-peaks",
    );
    expect(rec!.adjustments.crestDeviationDb).toBe(2);
  });

  it("exposes the genre ratio multiplier in adjustments", () => {
    const rec = recommendCompression(
      mockAnalysis(),
      "vocal",
      "hip-hop",
      "control-peaks",
    );
    expect(rec!.adjustments.genreRatioMult).toBe(1.15);
  });

  it("derives threshold so peak hits approximately targetPeakGrDb of GR", () => {
    // Given known peak, ratio, target GR: verify the compressor-math
    // identity GR = (peak − threshold) × (1 − 1/ratio). Target is 4 dB
    // of gain reduction at the peak for control-peaks.
    const peakDb = -0.9;
    const rec = recommendCompression(
      mockAnalysis({ peakDb, crestFactorDb: 18 }),
      "vocal",
      "other",
      "control-peaks",
    );
    const { thresholdDb, ratio } = rec!.settings;
    const predictedGr = (peakDb - thresholdDb) * (1 - 1 / ratio);
    // Allow for rounding of threshold to 0.5 dB steps + ratio snapping.
    expect(Math.abs(predictedGr - 4)).toBeLessThan(1);
  });
});
