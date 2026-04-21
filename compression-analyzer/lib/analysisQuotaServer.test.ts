import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  utcDateKey,
  quotaRedisKey,
  readUsageCount,
  tryIncrementUsage,
  resetMemoryQuotaForTests,
  normalizeQuotaRestBaseUrl,
  looksLikeUpstashVectorOrSearchRestUrl,
  quotaUnavailableResponseBody,
  resolveQuotaBackend,
  getQuotaEnvDiagnosticHint,
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

const QUOTA_ENV_KEYS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
] as const;

describe("resolveQuotaBackend env pairing", () => {
  let saved: Partial<
    Record<(typeof QUOTA_ENV_KEYS)[number], string | undefined>
  >;

  beforeEach(() => {
    saved = {};
    for (const k of QUOTA_ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of QUOTA_ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("uses KV_* when UPSTASH_* are empty strings", () => {
    process.env.UPSTASH_REDIS_REST_URL = "";
    process.env.UPSTASH_REDIS_REST_TOKEN = "";
    process.env.KV_REST_API_URL = "https://us1-example.upstash.io";
    process.env.KV_REST_API_TOKEN = "tok";
    const r = resolveQuotaBackend();
    expect(r.backend).toBe("redis");
    expect(r.rest?.baseUrl).toBe("https://us1-example.upstash.io");
    expect(r.rest?.token).toBe("tok");
  });

  it("prefers UPSTASH_* when both pairs are complete", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://us1-a.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "t1";
    process.env.KV_REST_API_URL = "https://us1-b.upstash.io";
    process.env.KV_REST_API_TOKEN = "t2";
    const r = resolveQuotaBackend();
    expect(r.backend).toBe("redis");
    expect(r.rest?.baseUrl).toBe("https://us1-a.upstash.io");
    expect(r.rest?.token).toBe("t1");
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

const DIAG_ENV_KEYS = [
  ...QUOTA_ENV_KEYS,
  "UPSTASH_SEARCH_REST_URL",
  "UPSTASH_SEARCH_REST_TOKEN",
] as const;

describe("getQuotaEnvDiagnosticHint", () => {
  let saved: Partial<Record<(typeof DIAG_ENV_KEYS)[number], string | undefined>>;

  beforeEach(() => {
    saved = {};
    for (const k of DIAG_ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of DIAG_ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("flags Search env without Redis", () => {
    process.env.UPSTASH_SEARCH_REST_URL = "https://example-search.upstash.io";
    process.env.UPSTASH_SEARCH_REST_TOKEN = "tok";
    expect(getQuotaEnvDiagnosticHint()).toContain("Search or Vector");
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
