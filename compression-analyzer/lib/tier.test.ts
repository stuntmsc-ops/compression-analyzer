import { describe, it, expect } from "vitest";
import {
  readPaidUnlocked,
  writePaidUnlocked,
  clearPaidUnlocked,
  PAID_TIER_STORAGE_KEY,
} from "./tier";

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

describe("paid tier flag", () => {
  it("round-trips write/read/clear", () => {
    const s = makeMemoryStorage();
    expect(readPaidUnlocked(s)).toBe(false);
    expect(writePaidUnlocked(s)).toBe(true);
    expect(readPaidUnlocked(s)).toBe(true);
    expect(clearPaidUnlocked(s)).toBe(true);
    expect(readPaidUnlocked(s)).toBe(false);
  });

  it("returns true only for exact truthy marker", () => {
    const s = makeMemoryStorage();
    s.setItem(PAID_TIER_STORAGE_KEY, "1");
    expect(readPaidUnlocked(s)).toBe(true);
    s.setItem(PAID_TIER_STORAGE_KEY, "true");
    expect(readPaidUnlocked(s)).toBe(false);
  });

  it("returns false when storage is null", () => {
    expect(readPaidUnlocked(null)).toBe(false);
  });
});
