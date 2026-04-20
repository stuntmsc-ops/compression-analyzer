import { describe, it, expect } from "vitest";
import { parseSelectorHash, serializeSelectorHash } from "./urlState";
import { DEFAULT_SELECTOR_STATE, type SelectorState } from "./types";

describe("parseSelectorHash", () => {
  it("returns empty for an empty hash", () => {
    expect(parseSelectorHash("")).toEqual({});
  });

  it("returns empty for a lone '#'", () => {
    expect(parseSelectorHash("#")).toEqual({});
  });

  it("extracts a single valid selector", () => {
    expect(parseSelectorHash("#instrument=bass")).toEqual({
      instrument: "bass",
    });
  });

  it("extracts all three selectors when present and valid", () => {
    expect(
      parseSelectorHash("#instrument=kick&genre=rock&goal=add-warmth"),
    ).toEqual({
      instrument: "kick",
      genre: "rock",
      goal: "add-warmth",
    });
  });

  it("drops values outside the closed instrument set", () => {
    expect(parseSelectorHash("#instrument=tuba")).toEqual({});
  });

  it("drops values outside the closed genre set", () => {
    expect(parseSelectorHash("#genre=jazz-fusion")).toEqual({});
  });

  it("drops values outside the closed goal set", () => {
    expect(parseSelectorHash("#goal=make-loud")).toEqual({});
  });

  it("keeps valid keys and drops invalid ones in the same hash", () => {
    expect(
      parseSelectorHash(
        "#instrument=vocal&genre=nonsense&goal=control-peaks",
      ),
    ).toEqual({
      instrument: "vocal",
      goal: "control-peaks",
    });
  });

  it("ignores unrelated keys", () => {
    expect(parseSelectorHash("#instrument=vocal&utm_source=twitter")).toEqual(
      { instrument: "vocal" },
    );
  });

  it("accepts hash string without the leading '#'", () => {
    expect(parseSelectorHash("instrument=vocal")).toEqual({
      instrument: "vocal",
    });
  });

  it("is key-order-independent", () => {
    expect(
      parseSelectorHash("#goal=control-peaks&genre=rock&instrument=kick"),
    ).toEqual({
      instrument: "kick",
      genre: "rock",
      goal: "control-peaks",
    });
  });
});

describe("serializeSelectorHash", () => {
  it("emits all three keys in a stable order", () => {
    const state: SelectorState = {
      instrument: "bass",
      genre: "edm",
      goal: "parallel-punch",
    };
    expect(serializeSelectorHash(state)).toBe(
      "instrument=bass&genre=edm&goal=parallel-punch",
    );
  });

  it("does not prepend '#' (callers add it themselves)", () => {
    expect(
      serializeSelectorHash(DEFAULT_SELECTOR_STATE).startsWith("#"),
    ).toBe(false);
  });

  it("is deterministic for a given state", () => {
    const a = serializeSelectorHash(DEFAULT_SELECTOR_STATE);
    const b = serializeSelectorHash(DEFAULT_SELECTOR_STATE);
    expect(a).toBe(b);
  });
});

describe("parse ∘ serialize roundtrip", () => {
  it("recovers any valid SelectorState", () => {
    const states: SelectorState[] = [
      { instrument: "vocal", genre: "hip-hop", goal: "control-peaks" },
      { instrument: "full-mix", genre: "lofi", goal: "aggressive-pumping" },
      { instrument: "other", genre: "other", goal: "smooth-consistency" },
      { instrument: "acoustic-guitar", genre: "pop", goal: "add-warmth" },
    ];
    for (const s of states) {
      expect(parseSelectorHash("#" + serializeSelectorHash(s))).toEqual(s);
    }
  });
});
