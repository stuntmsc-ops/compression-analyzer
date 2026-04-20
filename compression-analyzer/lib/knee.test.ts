import { describe, it, expect } from "vitest";
import {
  kneeCharacter,
  kneeCharacterTitle,
  KNEE_HARD_MAX_DB,
  KNEE_MEDIUM_MAX_DB,
} from "./knee";

describe("kneeCharacter", () => {
  it("labels 0 dB as hard (true hard knee)", () => {
    expect(kneeCharacter(0)).toBe("hard");
  });

  it("labels values just below the hard/medium cutoff as hard", () => {
    expect(kneeCharacter(KNEE_HARD_MAX_DB - 0.5)).toBe("hard");
  });

  it("labels the hard/medium cutoff itself as medium (exclusive lower)", () => {
    expect(kneeCharacter(KNEE_HARD_MAX_DB)).toBe("medium");
  });

  it("labels values just below the medium/soft cutoff as medium", () => {
    expect(kneeCharacter(KNEE_MEDIUM_MAX_DB - 0.5)).toBe("medium");
  });

  it("labels the medium/soft cutoff itself as soft (inclusive)", () => {
    expect(kneeCharacter(KNEE_MEDIUM_MAX_DB)).toBe("soft");
  });

  it("labels large knees as soft", () => {
    expect(kneeCharacter(10)).toBe("soft");
  });

  it("treats NaN as hard (defensive floor)", () => {
    expect(kneeCharacter(Number.NaN)).toBe("hard");
  });

  it("treats negative input as hard (engine clamps at 0, but belt-and-braces)", () => {
    expect(kneeCharacter(-1)).toBe("hard");
  });

  // Spot-check the canonical engine outputs called out in knee.ts's
  // comment so a calibration retune that breaks the mapping shows up
  // as a failing test rather than a silently-wrong label.
  it.each([
    { kneeDb: 0, character: "hard", scenario: "kick + control-peaks" },
    { kneeDb: 4, character: "medium", scenario: "vocal + control-peaks" },
    { kneeDb: 8, character: "soft", scenario: "vocal + add-warmth" },
    { kneeDb: 9, character: "soft", scenario: "full-mix + smooth-consistency" },
  ])("$scenario → $kneeDb dB → $character", ({ kneeDb, character }) => {
    expect(kneeCharacter(kneeDb)).toBe(character);
  });
});

describe("kneeCharacterTitle", () => {
  it("title-cases each bucket", () => {
    expect(kneeCharacterTitle(0)).toBe("Hard");
    expect(kneeCharacterTitle(4)).toBe("Medium");
    expect(kneeCharacterTitle(8)).toBe("Soft");
  });

  it("follows the same floors as kneeCharacter", () => {
    expect(kneeCharacterTitle(KNEE_HARD_MAX_DB - 0.5)).toBe("Hard");
    expect(kneeCharacterTitle(KNEE_HARD_MAX_DB)).toBe("Medium");
  });
});
