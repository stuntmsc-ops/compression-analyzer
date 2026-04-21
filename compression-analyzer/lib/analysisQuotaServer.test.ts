import { randomUUID } from "crypto";
import { beforeEach, describe, it, expect } from "vitest";
import {
  utcDateKey,
  quotaRedisKey,
  readUsageCount,
  tryIncrementUsage,
  resetMemoryQuotaForTests,
  normalizeQuotaRestBaseUrl,
  looksLikeUpstashVectorOrSearchRestUrl,
  quotaUnavailableResponseBody,
} from "./analysisQuotaServer";
import { FREE_DAILY_ANALYSIS_LIMIT } from "./quotaConstants";

beforeEach(() => {
  resetMemoryQuotaForTests();
});

describe("utcDateKey", () => {
  it("returns UTC YYYY-MM-DD", () => {
    const d = new Date(Date.UTC(2026, 3, 20, 12, 0, 0));
    expect(utcDateKey(d)).toBe("2026-04-20");
  });
});

describe("quotaRedisKey", () => {
  it("includes date and session id", () => {
    expect(quotaRedisKey("sid-1", "2026-04-20")).toBe("ca:q:v1:2026-04-20:sid-1");
  });
});

describe("normalizeQuotaRestBaseUrl", () => {
  it("trims and strips trailing slashes", () => {
    expect(normalizeQuotaRestBaseUrl("  https://x.example/  ///")).toBe(
      "https://x.example",
    );
  });
  it("removes mistaken /pipeline suffix", () => {
    expect(normalizeQuotaRestBaseUrl("https://x.example/pipeline")).toBe(
      "https://x.example",
    );
  });
  it("upgrades http to https", () => {
    expect(normalizeQuotaRestBaseUrl("http://x.example/foo/")).toBe(
      "https://x.example/foo",
    );
  });
  it("strips wrapping quotes", () => {
    expect(normalizeQuotaRestBaseUrl('"https://x.example/pipeline"')).toBe(
      "https://x.example",
    );
  });
});

describe("quotaUnavailableResponseBody", () => {
  it("includes skipReason matching the code", () => {
    const b = quotaUnavailableResponseBody("vector_or_search_host");
    expect(b.ok).toBe(false);
    expect(b.skipReason).toBe("vector_or_search_host");
    expect(b.error).toContain("Search or Vector");
  });
});

describe("looksLikeUpstashVectorOrSearchRestUrl", () => {
  it("flags Upstash Search hostnames", () => {
    expect(
      looksLikeUpstashVectorOrSearchRestUrl(
        "https://model-bluebird-26459-gcp-usc1-search.upstash.io",
      ),
    ).toBe(true);
  });
  it("flags Upstash Vector hostnames", () => {
    expect(
      looksLikeUpstashVectorOrSearchRestUrl(
        "https://my-index-vector.upstash.io",
      ),
    ).toBe(true);
  });
  it("does not flag Redis REST hostnames", () => {
    expect(
      looksLikeUpstashVectorOrSearchRestUrl(
        "https://us1-merry-cat-32748.upstash.io",
      ),
    ).toBe(false);
  });
  it("does not flag non-upstash hosts", () => {
    expect(looksLikeUpstashVectorOrSearchRestUrl("https://redis.example.com")).toBe(
      false,
    );
  });
});

describe("memory-backed quota", () => {
  it("increments up to the cap then refuses", async () => {
    const sid = randomUUID();
    for (let i = 0; i < FREE_DAILY_ANALYSIS_LIMIT; i++) {
      const r = await tryIncrementUsage(sid, "memory", null);
      expect(r.accepted).toBe(true);
      expect(r.used).toBe(i + 1);
    }
    const last = await tryIncrementUsage(sid, "memory", null);
    expect(last.accepted).toBe(false);
    expect(last.used).toBe(FREE_DAILY_ANALYSIS_LIMIT);
  });

  it("readUsageCount matches increments for a fresh session", async () => {
    const s = randomUUID();
    const date = utcDateKey();
    expect(await readUsageCount(s, date, "memory", null)).toBe(0);
    await tryIncrementUsage(s, "memory", null);
    expect(await readUsageCount(s, date, "memory", null)).toBe(1);
  });
});
