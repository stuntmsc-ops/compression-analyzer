// Server-side free-tier analysis counting (Day 23+).
//
// Uses Upstash Redis REST (or Vercel KV: KV_REST_*) when URL + token are set.
// Same behavior with `next dev` and on Vercel — both hit the public HTTPS REST
// API; you do not need to deploy to validate Redis quota wiring.
// Commands use POST (or PUT fallback) + JSON array on the REST root. We follow
// 301/302/307/308 manually with the same method+body — default fetch redirect
// can downgrade POST→GET and yield Upstash "Method Not Allowed".
// In NODE_ENV !== "production", missing credentials fall back to an in-memory
// Map so `npm run dev` works without Redis (not shared across serverless
// instances — fine for local iteration only).

import {
  FREE_DAILY_ANALYSIS_LIMIT,
  QUOTA_KEY_TTL_SEC,
} from "./quotaConstants";

export function utcDateKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function quotaRedisKey(sessionId: string, date: string): string {
  return `ca:q:v1:${date}:${sessionId}`;
}

/** Normalizes REST base URL (no trailing slash; strips accidental `/pipeline`). */
export function normalizeQuotaRestBaseUrl(raw: string): string {
  let u = raw.trim().replace(/\r/g, "");
  if (
    u.length >= 2 &&
    ((u.startsWith('"') && u.endsWith('"')) ||
      (u.startsWith("'") && u.endsWith("'")))
  ) {
    u = u.slice(1, -1).trim().replace(/\r/g, "");
  }
  u = u.replace(/\s/g, "");
  u = u.replace(/[\s/]+$/, "");
  if (/^http:\/\//i.test(u)) {
    u = `https://${u.replace(/^http:\/\//i, "")}`;
  }
  if (u.endsWith("/pipeline")) {
    u = u.slice(0, -"/pipeline".length).replace(/[\s/]+$/, "");
  }
  return u;
}

function stripEnvLine(value: string): string {
  let s = value.trim().replace(/\r/g, "");
  if (
    s.length >= 2 &&
    ((s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'")))
  ) {
    s = s.slice(1, -1).trim().replace(/\r/g, "");
  }
  return s;
}

function isObviousNonRestUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
  } catch {
    return true;
  }
}

/**
 * Upstash Search/Vector REST hosts (e.g. `*-search.upstash.io`) are not Redis;
 * POSTing Redis command arrays returns 405 Method Not Allowed.
 */
export function looksLikeUpstashVectorOrSearchRestUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (!h.endsWith(".upstash.io")) return false;
    return /-search\.upstash\.io$/i.test(h) || /-vector\.upstash\.io$/i.test(h);
  } catch {
    return false;
  }
}

const REDIRECT_PRESERVE_METHOD = new Set([301, 302, 307, 308]);

/**
 * Follows redirects without turning POST into GET (undici/fetch default for
 * some 301/302 chains).
 */
async function fetchRedisRestRaw(
  startUrl: string,
  token: string,
  body: string,
  method: "POST" | "PUT",
): Promise<Response> {
  let url = startUrl;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  for (let hop = 0; hop < 8; hop++) {
    const res = await fetch(url, {
      method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });

    if (REDIRECT_PRESERVE_METHOD.has(res.status)) {
      const loc = res.headers.get("Location");
      if (!loc) return res;
      url = new URL(loc, url).href;
      continue;
    }

    if (res.status === 303) {
      throw new Error(
        "Redis REST URL returned 303 See Other; use the final HTTPS REST URL from the Upstash or Vercel dashboard (no intermediate redirect pages).",
      );
    }

    return res;
  }

  throw new Error("Redis REST: too many redirects.");
}

export type QuotaRestCredentials = {
  baseUrl: string;
  token: string;
};

function getQuotaRestCredentials(): QuotaRestCredentials | null {
  const rawUrl =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const rawToken =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!rawUrl || !rawToken) return null;

  const url = stripEnvLine(rawUrl).replace(/\s/g, "");
  const token = stripEnvLine(rawToken);
  if (!url || !token) return null;

  const baseUrl = normalizeQuotaRestBaseUrl(url);

  if (looksLikeUpstashVectorOrSearchRestUrl(baseUrl)) {
    console.error(
      "[analysis-quota] UPSTASH_REDIS_REST_URL / KV_REST_API_URL points at Upstash Search or Vector (hostname contains -search or -vector before .upstash.io), not Redis. Open Upstash → Redis → your database → REST API and copy that URL and token. Ignoring these credentials.",
    );
    return null;
  }

  if (process.env.NODE_ENV !== "production" && isObviousNonRestUrl(baseUrl)) {
    console.warn(
      "[analysis-quota] REST URL is localhost or not a valid URL; ignoring Redis and using in-memory quota in development. Fix UPSTASH_REDIS_REST_URL / KV_REST_API_URL or unset it.",
    );
    return null;
  }

  return { baseUrl, token };
}

type UpstashRestPayload = { result?: unknown; error?: string };

async function parseUpstashResponse(
  res: Response,
  commandLabel: string,
): Promise<UpstashRestPayload> {
  const text = await res.text();
  let data: UpstashRestPayload;
  try {
    data = text ? (JSON.parse(text) as UpstashRestPayload) : {};
  } catch {
    throw new Error(
      `Redis REST returned non-JSON (HTTP ${res.status}) for ${commandLabel}.`,
    );
  }
  if (!res.ok || typeof data.error === "string") {
    const msg =
      typeof data.error === "string"
        ? data.error
        : `Redis REST failed (HTTP ${res.status}) for ${commandLabel}.`;
    const lower = msg.toLowerCase();
    const methodBlocked =
      lower.includes("method not allowed") ||
      (!res.ok && res.status === 405);
    const hint = methodBlocked
      ? " Deploying to Vercel will not fix this. Use the HTTPS REST URL and token from Upstash → Redis (not Search/Vector)—hostnames like *-search.upstash.io are Vector/Search, not Redis. For local work without Redis, remove UPSTASH_* and KV_REST_* from `.env.local` for in-memory quota."
      : "";
    throw new Error(msg + hint);
  }
  return data;
}

/** POST or PUT JSON command array to REST root — minimal headers. */
async function restPostCommand(
  creds: QuotaRestCredentials,
  command: unknown[],
  commandLabel: string,
): Promise<unknown> {
  const body = JSON.stringify(command);
  let res = await fetchRedisRestRaw(
    creds.baseUrl,
    creds.token,
    body,
    "POST",
  );
  if (res.status === 405) {
    res = await fetchRedisRestRaw(creds.baseUrl, creds.token, body, "PUT");
  }
  const data = await parseUpstashResponse(res, commandLabel);
  return data.result;
}

async function restGetCount(
  creds: QuotaRestCredentials,
  key: string,
): Promise<number> {
  const raw = await restPostCommand(creds, ["get", key], "GET counter");
  if (raw === null || raw === undefined) return 0;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

async function restEval(
  creds: QuotaRestCredentials,
  script: string,
  key: string,
  cap: number,
  ttl: number,
): Promise<unknown> {
  return restPostCommand(
    creds,
    ["eval", script, 1, key, String(cap), String(ttl)],
    "EVAL quota script",
  );
}

const memoryCounts = new Map<string, number>();

/** Clears the in-memory store — tests only. */
export function resetMemoryQuotaForTests(): void {
  memoryCounts.clear();
}

function memoryKey(sessionId: string, date: string): string {
  return `${date}:${sessionId}`;
}

export type QuotaBackend = "redis" | "memory" | "none";

export function resolveQuotaBackend(): {
  backend: QuotaBackend;
  rest: QuotaRestCredentials | null;
} {
  const rest = getQuotaRestCredentials();
  if (rest) return { backend: "redis", rest };
  if (process.env.NODE_ENV === "production") {
    return { backend: "none", rest: null };
  }
  return { backend: "memory", rest: null };
}

export async function readUsageCount(
  sessionId: string,
  date: string,
  backend: QuotaBackend,
  rest: QuotaRestCredentials | null,
): Promise<number> {
  const key = quotaRedisKey(sessionId, date);
  if (backend === "redis" && rest) {
    return restGetCount(rest, key);
  }
  if (backend === "memory") {
    return memoryCounts.get(memoryKey(sessionId, date)) ?? 0;
  }
  return 0;
}

/**
 * Atomically increment today's count if and only if it is still below
 * `FREE_DAILY_ANALYSIS_LIMIT` before the increment. Returns the count
 * after the operation (unchanged when already at the cap).
 */
export async function tryIncrementUsage(
  sessionId: string,
  backend: QuotaBackend,
  rest: QuotaRestCredentials | null,
): Promise<{ used: number; accepted: boolean }> {
  const date = utcDateKey();
  const cap = FREE_DAILY_ANALYSIS_LIMIT;
  const ttl = QUOTA_KEY_TTL_SEC;

  if (backend === "memory") {
    const mk = memoryKey(sessionId, date);
    const n = memoryCounts.get(mk) ?? 0;
    if (n >= cap) return { used: n, accepted: false };
    const next = n + 1;
    memoryCounts.set(mk, next);
    return { used: next, accepted: true };
  }

  if (backend === "redis" && rest) {
    const key = quotaRedisKey(sessionId, date);
    const script = `
local key = KEYS[1]
local cap = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local raw = redis.call("GET", key)
local n = raw and tonumber(raw) or 0
if n >= cap then
  return {n, 0}
end
local m = redis.call("INCR", key)
if redis.call("TTL", key) < 0 then
  redis.call("EXPIRE", key, ttl)
end
return {m, 1}
`;
    const out = (await restEval(rest, script, key, cap, ttl)) as unknown;
    const pair = normalizeEvalPair(out);
    if (!pair) {
      throw new Error("Unexpected Redis EVAL return shape");
    }
    const [used, flag] = pair;
    return { used, accepted: flag === 1 };
  }

  return { used: 0, accepted: false };
}

function normalizeEvalPair(out: unknown): [number, number] | null {
  if (Array.isArray(out) && out.length >= 2) {
    const a = Number(out[0]);
    const b = Number(out[1]);
    if (Number.isFinite(a) && Number.isFinite(b)) return [a, b];
  }
  return null;
}
