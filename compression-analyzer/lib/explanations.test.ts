import { describe, it, expect } from "vitest";
import type { AudioAnalysisResult } from "./audioAnalysis";
import type { CompressionSettings } from "./calibration";
import { buildExplanation, type ExplanationAdjustments } from "./explanations";

function mockAnalysis(
  overrides: Partial<AudioAnalysisResult> = {},
): AudioAnalysisResult {
  return {
    rms: 0.1,
    rmsDb: -20,
    peak: 0.9,
    peakDb: -0.9,
    crestFactorDb: 12,
    spectralCentroidHz: 2000,
    spectralRolloffHz: 8000,
    zeroCrossingRate: 1000,
    loudnessOverTime: {
      // Span roughly 11 dB at P10..P90 so no consistency caveat fires
      // by default. Tests that want the consistency branch override.
      rmsDb: [-25, -23, -22, -21, -20, -19, -18, -17, -16, -15, -14, -12],
      hopSeconds: 0.1,
      stdDevDb: 3.5,
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

const baseSettings: CompressionSettings = {
  thresholdDb: -10,
  ratio: 4,
  attackMs: 5,
  releaseMs: 100,
  kneeDb: 3,
  makeupDb: 2,
};
const baseAdj: ExplanationAdjustments = {
  crestDeviationDb: 0,
  targetPeakGrDb: 4,
};

describe("buildExplanation — commonMistake branches", () => {
  it("returns bus-compression caveat for full-mix regardless of measurements", () => {
    const exp = buildExplanation(
      mockAnalysis(),
      baseSettings,
      baseAdj,
      "full-mix",
    );
    expect(exp.commonMistake).toMatch(/bus compression/i);
  });

  it("returns consistency caveat when dynamic range is narrow", () => {
    // Alternating values 0.3 dB apart → tight DR, very low stdDev.
    const consistent = mockAnalysis({
      loudnessOverTime: {
        rmsDb: Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? -20 : -19.7)),
        hopSeconds: 0.1,
        stdDevDb: 0.15,
      },
    });
    const exp = buildExplanation(consistent, baseSettings, baseAdj, "vocal");
    expect(exp.commonMistake).toMatch(/already fairly consistent/i);
  });

  it("returns crest caveat when crest factor is above 18 dB", () => {
    const peaky = mockAnalysis({ crestFactorDb: 21, peakDb: -3 });
    const exp = buildExplanation(peaky, baseSettings, baseAdj, "vocal");
    expect(exp.commonMistake).toMatch(/peaks this sharp/i);
    // The prose references the measured crest and the recommended
    // threshold so the advice is actionable.
    expect(exp.commonMistake).toContain("21.0 dB");
  });

  it("returns running-hot caveat when clipping flag is set", () => {
    const hot = mockAnalysis({
      qualityFlags: { tooShort: false, clipping: true, silent: false },
      peakDb: -0.1,
    });
    const exp = buildExplanation(hot, baseSettings, baseAdj, "vocal");
    expect(exp.commonMistake).toMatch(/running hot/i);
  });

  it("returns quiet caveat when peak is below -18 dB", () => {
    const quiet = mockAnalysis({ peakDb: -25 });
    const exp = buildExplanation(quiet, baseSettings, baseAdj, "vocal");
    expect(exp.commonMistake).toMatch(/quiet signal/i);
  });

  it("returns null when no mistake pattern applies", () => {
    // Default mockAnalysis sits in the happy zone.
    const exp = buildExplanation(
      mockAnalysis({ peakDb: -6, rmsDb: -18 }),
      baseSettings,
      baseAdj,
      "vocal",
    );
    expect(exp.commonMistake).toBeNull();
  });

  it("prioritises full-mix caveat over all other triggers", () => {
    const everythingWrong = mockAnalysis({
      peakDb: -0.1,
      rmsDb: -5,
      crestFactorDb: 25,
      qualityFlags: { tooShort: false, clipping: true, silent: false },
    });
    const exp = buildExplanation(
      everythingWrong,
      baseSettings,
      baseAdj,
      "full-mix",
    );
    expect(exp.commonMistake).toMatch(/bus compression/i);
  });
});

describe("buildExplanation — summary prose", () => {
  it("mentions the instrument noun", () => {
    const analysis = mockAnalysis();
    expect(
      buildExplanation(analysis, baseSettings, baseAdj, "kick").summary,
    ).toMatch(/kick/i);
    expect(
      buildExplanation(analysis, baseSettings, baseAdj, "acoustic-guitar")
        .summary,
    ).toMatch(/acoustic guitar/i);
    // full-mix reads as "mix" in prose even though the key is "full-mix"
    expect(
      buildExplanation(analysis, baseSettings, baseAdj, "full-mix").summary,
    ).toMatch(/your mix/i);
    // "other" becomes "source" so the sentence doesn't say "your other"
    expect(
      buildExplanation(analysis, baseSettings, baseAdj, "other").summary,
    ).toMatch(/your source/i);
  });

  it("describes crest factor with appropriate band language", () => {
    const lowCrest = buildExplanation(
      mockAnalysis({ crestFactorDb: 3 }),
      baseSettings,
      baseAdj,
      "vocal",
    );
    expect(lowCrest.summary).toMatch(/heavily compressed/i);

    const highCrest = buildExplanation(
      mockAnalysis({ crestFactorDb: 22 }),
      baseSettings,
      baseAdj,
      "vocal",
    );
    expect(highCrest.summary).toMatch(/sharp transients/i);
  });
});

describe("buildExplanation — settingsRationale", () => {
  it("uses 'gentle' language for low ratios", () => {
    const exp = buildExplanation(
      mockAnalysis(),
      { ...baseSettings, ratio: 2 },
      baseAdj,
      "vocal",
    );
    expect(exp.settingsRationale).toMatch(/gentle/i);
  });

  it("uses 'aggressive' language for high ratios", () => {
    const exp = buildExplanation(
      mockAnalysis(),
      { ...baseSettings, ratio: 8 },
      baseAdj,
      "vocal",
    );
    expect(exp.settingsRationale).toMatch(/aggressive/i);
  });

  it("references the release time with behavioural prose", () => {
    const slow = buildExplanation(
      mockAnalysis(),
      { ...baseSettings, releaseMs: 300 },
      baseAdj,
      "vocal",
    );
    expect(slow.settingsRationale).toMatch(/300 ms release/);
    expect(slow.settingsRationale).toMatch(/glue/i);
  });
});
