import { describe, it, expect } from "vitest";
import type { CompressionSettings } from "./calibration";
import {
  computeDeltas,
  deltaLabelDb,
  deltaLabelMs,
  deltaLabelRatio,
} from "./delta";

describe("deltaLabelDb", () => {
  it("returns signed label for positive change", () => {
    expect(deltaLabelDb(2.5)).toBe("+2.5 dB");
  });

  it("returns signed label for negative change", () => {
    expect(deltaLabelDb(-1.3)).toBe("-1.3 dB");
  });

  it("returns null for exactly zero", () => {
    expect(deltaLabelDb(0)).toBeNull();
  });

  it("filters changes below the noise floor", () => {
    expect(deltaLabelDb(0.04)).toBeNull();
    expect(deltaLabelDb(-0.04)).toBeNull();
  });

  it("keeps a label at the noise-floor boundary", () => {
    // epsilon is strict less-than so 0.05 is the first value that passes
    expect(deltaLabelDb(0.05)).not.toBeNull();
  });
});

describe("deltaLabelRatio", () => {
  it("returns unit-less signed label", () => {
    expect(deltaLabelRatio(0.5)).toBe("+0.5");
    expect(deltaLabelRatio(-0.3)).toBe("-0.3");
  });

  it("returns null for sub-epsilon changes", () => {
    expect(deltaLabelRatio(0)).toBeNull();
    expect(deltaLabelRatio(0.04)).toBeNull();
  });
});

describe("deltaLabelMs", () => {
  it("uses one decimal for magnitudes below 10 ms", () => {
    expect(deltaLabelMs(3.4)).toBe("+3.4 ms");
    expect(deltaLabelMs(-1.5)).toBe("-1.5 ms");
  });

  it("rounds to integer at magnitudes 10 ms and above", () => {
    expect(deltaLabelMs(15.7)).toBe("+16 ms");
    expect(deltaLabelMs(-22.2)).toBe("-22 ms");
  });

  it("returns null for sub-0.5 ms changes", () => {
    expect(deltaLabelMs(0.3)).toBeNull();
    expect(deltaLabelMs(-0.4)).toBeNull();
  });

  it("keeps a label at the 0.5 ms boundary", () => {
    expect(deltaLabelMs(0.5)).toBe("+0.5 ms");
  });
});

describe("computeDeltas", () => {
  const prev: CompressionSettings = {
    thresholdDb: -10,
    ratio: 3,
    attackMs: 5,
    releaseMs: 100,
    kneeDb: 3,
    makeupDb: 2,
  };

  it("returns all null when settings are identical", () => {
    expect(computeDeltas(prev, prev)).toEqual({
      threshold: null,
      ratio: null,
      makeup: null,
      attack: null,
      release: null,
      knee: null,
    });
  });

  it("reports per-field signed deltas when settings change", () => {
    const next: CompressionSettings = {
      ...prev,
      thresholdDb: -15,
      ratio: 4,
      releaseMs: 150,
    };
    const d = computeDeltas(next, prev);
    expect(d.threshold).toBe("-5.0 dB");
    expect(d.ratio).toBe("+1.0");
    expect(d.release).toBe("+50 ms");
    expect(d.attack).toBeNull();
    expect(d.knee).toBeNull();
    expect(d.makeup).toBeNull();
  });

  it("uses each field's appropriate formatter", () => {
    // 6 fields all move at once, each through its own epsilon + unit.
    const next: CompressionSettings = {
      thresholdDb: prev.thresholdDb + 2.5, // dB
      ratio: prev.ratio + 0.4, // ratio
      attackMs: prev.attackMs + 3, // ms < 10, one decimal
      releaseMs: prev.releaseMs + 25, // ms >= 10, integer
      kneeDb: prev.kneeDb - 1.5, // dB negative
      makeupDb: prev.makeupDb + 0.5, // dB positive
    };
    const d = computeDeltas(next, prev);
    expect(d.threshold).toBe("+2.5 dB");
    expect(d.ratio).toBe("+0.4");
    expect(d.attack).toBe("+3.0 ms");
    expect(d.release).toBe("+25 ms");
    expect(d.knee).toBe("-1.5 dB");
    expect(d.makeup).toBe("+0.5 dB");
  });
});
