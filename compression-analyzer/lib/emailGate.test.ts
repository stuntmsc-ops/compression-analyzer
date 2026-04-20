import { describe, it, expect } from "vitest";
import {
  readSubmitted,
  writeSubmitted,
  clearSubmitted,
  EMAIL_GATE_STORAGE_KEY,
} from "./emailGate";

// In-memory Storage implementation — matches the subset of the
// Storage interface the helpers actually touch. Avoids pulling in jsdom
// just to exercise three methods.
function makeMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    key(i: number) {
      return Array.from(map.keys())[i] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

// Storage stub where the mutating methods throw — simulates Safari
// private mode or an iframe with storage disabled. Read still returns
// null (i.e. "not submitted").
function makeThrowingStorage(): Storage {
  const err = () => {
    throw new Error("storage disabled");
  };
  return {
    get length(): number {
      return 0;
    },
    clear: err,
    getItem: () => null,
    key: () => null,
    removeItem: err,
    setItem: err,
  };
}

describe("readSubmitted", () => {
  it("returns false for a fresh storage", () => {
    expect(readSubmitted(makeMemoryStorage())).toBe(false);
  });

  it("returns true only when the exact truthy value is set", () => {
    const s = makeMemoryStorage();
    s.setItem(EMAIL_GATE_STORAGE_KEY, "1");
    expect(readSubmitted(s)).toBe(true);
  });

  it("returns false for any non-'1' stored value", () => {
    const s = makeMemoryStorage();
    s.setItem(EMAIL_GATE_STORAGE_KEY, "true");
    expect(readSubmitted(s)).toBe(false);
  });

  it("returns false when storage is null (SSR / unavailable)", () => {
    expect(readSubmitted(null)).toBe(false);
  });

  it("returns false when storage throws on read", () => {
    const s: Storage = {
      ...makeMemoryStorage(),
      getItem: () => {
        throw new Error("denied");
      },
    };
    expect(readSubmitted(s)).toBe(false);
  });
});

describe("writeSubmitted", () => {
  it("persists the truthy flag and returns true", () => {
    const s = makeMemoryStorage();
    expect(writeSubmitted(s)).toBe(true);
    expect(s.getItem(EMAIL_GATE_STORAGE_KEY)).toBe("1");
  });

  it("returns false when storage is null", () => {
    expect(writeSubmitted(null)).toBe(false);
  });

  it("returns false without throwing when storage rejects writes", () => {
    expect(writeSubmitted(makeThrowingStorage())).toBe(false);
  });
});

describe("clearSubmitted", () => {
  it("removes the flag and returns true", () => {
    const s = makeMemoryStorage();
    writeSubmitted(s);
    expect(readSubmitted(s)).toBe(true);
    expect(clearSubmitted(s)).toBe(true);
    expect(readSubmitted(s)).toBe(false);
  });

  it("returns false when storage is null", () => {
    expect(clearSubmitted(null)).toBe(false);
  });
});

describe("read/write round-trip", () => {
  it("a write is visible on subsequent reads", () => {
    const s = makeMemoryStorage();
    expect(readSubmitted(s)).toBe(false);
    writeSubmitted(s);
    expect(readSubmitted(s)).toBe(true);
  });
});
