import { describe, it, expect } from "vitest";
import type { AudioAnalysisResult } from "./audioAnalysis";
import { recommendTechnique } from "./technique";

/**
 * Base fixture: a "just about average" source — medium crest, medium
 * dynamic range, no quality flags tripped. Every test overrides just
 * the one or two fields that matter for its branch so reader attention
 * stays on the decision logic under test.
 */
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
    // ~8 dB P90-P10 range — sits in the neutral zone between the
    // "already consistent" (< 6) and "serial trigger" (> 10) thresholds.
    loudnessOverTime: {
      rmsDb: [-25, -23, -22, -21, -20, -19, -18, -17, -16, -15, -14, -13],
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

/** A loudness series with a tight P90-P10 spread (~2 dB). */
function tightSeries() {
  return {
    rmsDb: Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? -20 : -18)),
    hopSeconds: 0.1,
    stdDevDb: 1.0,
  };
}

/** A loudness series with a wide P90-P10 spread (~15 dB). */
function wideSeries() {
  return {
    rmsDb: [-35, -32, -29, -26, -23, -20, -17, -14, -11, -10, -9, -8],
    hopSeconds: 0.1,
    stdDevDb: 8,
  };
}

describe("recommendTechnique — full-mix", () => {
  it("always returns bus compression for full-mix, regardless of measurements", () => {
    // Deliberately pathological: high crest + wide DR would otherwise
    // trigger serial. Full-mix overrides everything.
    const t = recommendTechnique(
      mockAnalysis({ crestFactorDb: 22, loudnessOverTime: wideSeries() }),
      "full-mix",
    );
    expect(t.id).toBe("bus");
  });

  it("bus content mentions 1-2 dB GR and 2-bus placement", () => {
    const t = recommendTechnique(mockAnalysis(), "full-mix");
    expect(t.steps.join(" ")).toMatch(/1.{1,2}2 dB/); // "1-2 dB" or "1–2 dB"
    expect(t.steps.join(" ")).toMatch(/2-bus|master/);
  });
});

describe("recommendTechnique — serial trigger", () => {
  it("returns serial when crest > 18 AND dr > 10", () => {
    const t = recommendTechnique(
      mockAnalysis({ crestFactorDb: 22, loudnessOverTime: wideSeries() }),
      "vocal",
    );
    expect(t.id).toBe("serial");
  });

  it("does NOT trigger serial when only crest is high (dr normal)", () => {
    // Peaky source, but level is stable — a single fast compressor
    // handles the peaks. Serial is overkill.
    const t = recommendTechnique(
      mockAnalysis({ crestFactorDb: 22 }),
      "vocal",
    );
    expect(t.id).not.toBe("serial");
  });

  it("does NOT trigger serial when only dr is wide (crest normal)", () => {
    // Wide level swings but smooth transients — a single slow
    // compressor smooths the level. Serial is overkill.
    const t = recommendTechnique(
      mockAnalysis({ crestFactorDb: 10, loudnessOverTime: wideSeries() }),
      "vocal",
    );
    expect(t.id).not.toBe("serial");
  });

  it("serial reason prose references the actual measured values", () => {
    const t = recommendTechnique(
      mockAnalysis({ crestFactorDb: 22, loudnessOverTime: wideSeries() }),
      "vocal",
    );
    // Quotes the crest reading so the advice reads as responsive to
    // the user's actual source, not a generic template.
    expect(t.reason).toContain("22.0 dB");
  });
});

describe("recommendTechnique — parallel (percussive default)", () => {
  it.each(["kick", "snare", "bass"] as const)(
    "returns parallel for %s even at moderate dynamics",
    (inst) => {
      const t = recommendTechnique(mockAnalysis(), inst);
      expect(t.id).toBe("parallel");
    },
  );

  it("percussive-parallel prose names the instrument", () => {
    expect(recommendTechnique(mockAnalysis(), "kick").reason).toMatch(
      /kick/i,
    );
    expect(recommendTechnique(mockAnalysis(), "snare").reason).toMatch(
      /snare/i,
    );
    expect(recommendTechnique(mockAnalysis(), "bass").reason).toMatch(
      /bass/i,
    );
  });

  it("serial still wins over percussive default when dynamics are extreme", () => {
    // A live drum performance with both peaks and level swings
    // genuinely benefits from serial more than parallel.
    const t = recommendTechnique(
      mockAnalysis({ crestFactorDb: 22, loudnessOverTime: wideSeries() }),
      "kick",
    );
    expect(t.id).toBe("serial");
  });
});

describe("recommendTechnique — parallel (already-consistent)", () => {
  it("triggers parallel on narrow DR for a melodic source", () => {
    const t = recommendTechnique(
      mockAnalysis({ loudnessOverTime: tightSeries() }),
      "vocal",
    );
    expect(t.id).toBe("parallel");
  });

  it("triggers parallel on low stdDev even if DR series has too few samples", () => {
    // Short series: dynamicRangeDb returns 0 (< 10 finite samples).
    // stdDev < 1.2 still triggers the OR branch.
    const t = recommendTechnique(
      mockAnalysis({
        loudnessOverTime: { rmsDb: [-20, -19], hopSeconds: 0.1, stdDevDb: 0.5 },
      }),
      "vocal",
    );
    expect(t.id).toBe("parallel");
  });

  it("consistent-parallel prose references the measurement evidence", () => {
    const t = recommendTechnique(
      mockAnalysis({ loudnessOverTime: tightSeries() }),
      "vocal",
    );
    // Tight series → DR drives the prose — expect "X dB of level variation".
    expect(t.reason).toMatch(/dB of level variation/);
  });
});

describe("recommendTechnique — standard default", () => {
  it("returns standard for moderate-dynamics melodic sources", () => {
    const t = recommendTechnique(mockAnalysis(), "vocal");
    expect(t.id).toBe("standard");
  });

  it.each([
    "acoustic-guitar",
    "electric-guitar",
    "piano",
    "other",
  ] as const)("returns standard for %s at moderate dynamics", (inst) => {
    const t = recommendTechnique(mockAnalysis(), inst);
    expect(t.id).toBe("standard");
  });
});

describe("recommendTechnique — robustness", () => {
  it("does not throw on non-finite crest (e.g. silent file)", () => {
    expect(() =>
      recommendTechnique(
        mockAnalysis({ crestFactorDb: -Infinity, peakDb: -Infinity }),
        "vocal",
      ),
    ).not.toThrow();
  });

  it("returns a non-null technique in every case", () => {
    // Guarantee the caller can always render something — no conditional
    // nulls to thread through the component tree.
    const all: AudioAnalysisResult[] = [
      mockAnalysis(),
      mockAnalysis({ crestFactorDb: 25 }),
      mockAnalysis({ loudnessOverTime: tightSeries() }),
      mockAnalysis({ crestFactorDb: -Infinity }),
    ];
    for (const a of all) {
      expect(recommendTechnique(a, "vocal")).not.toBeNull();
    }
  });

  it("every technique has at least three steps", () => {
    const cases: Array<[Partial<AudioAnalysisResult>, string]> = [
      [{ crestFactorDb: 22, loudnessOverTime: wideSeries() }, "vocal"],
      [{ loudnessOverTime: tightSeries() }, "vocal"],
      [{}, "kick"],
      [{}, "full-mix"],
      [{}, "vocal"],
    ];
    for (const [overrides, inst] of cases) {
      const t = recommendTechnique(
        mockAnalysis(overrides),
        inst as never,
      );
      expect(t.steps.length).toBeGreaterThanOrEqual(3);
      expect(t.steps.length).toBeLessThanOrEqual(4);
    }
  });
});
