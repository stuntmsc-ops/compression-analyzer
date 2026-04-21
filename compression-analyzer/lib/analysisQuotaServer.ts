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

/** Why Redis quota is unavailable in production (safe to return to the client). */
export type QuotaEnvSkipReason =
  | "missing_env"
  | "empty_after_strip"
  | "vector_or_search_host"
  | "invalid_host";

type QuotaCredsResolved =
  | { ok: true; creds: QuotaRestCredentials }
  | { ok: false; reason: QuotaEnvSkipReason };

function strippedHasChars(value: string | undefined): boolean {
  if (value === undefined) return false;
  return stripEnvLine(value).replace(/\s/g, "").length > 0;
}

/**
 * Extra context for operators (no secret values). Helps when Vercel only
 * injected Search/Vector env names, or Production scope is wrong.
 */
function getQuotaEnvDiagnosticHint(): string {
  const RU = strippedHasChars(process.env.UPSTASH_REDIS_REST_URL);
  const RT = strippedHasChars(process.env.UPSTASH_REDIS_REST_TOKEN);
  const KU = strippedHasChars(process.env.KV_REST_API_URL);
  const KT = strippedHasChars(process.env.KV_REST_API_TOKEN);
  const searchPair =
    strippedHasChars(process.env.UPSTASH_SEARCH_REST_URL) &&
    strippedHasChars(process.env.UPSTASH_SEARCH_REST_TOKEN);
  const vectorPair =
    strippedHasChars(process.env.UPSTASH_VECTOR_REST_URL) &&
    strippedHasChars(process.env.UPSTASH_VECTOR_REST_TOKEN);

  if (searchPair || vectorPair) {
    return " Vercel has Upstash Search or Vector variables (UPSTASH_SEARCH_* / UPSTASH_VECTOR_*), but quota needs Redis: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from Upstash → Redis → REST API, or add a Redis resource in the Vercel Upstash integration.";
  }
  if (RU !== RT) {
    return " UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must both be non-empty; one is missing or blank.";
  }
  if (KU !== KT) {
    return " KV_REST_API_URL and KV_REST_API_TOKEN must both be non-empty; one is missing or blank.";
  }
  if (!RU && !RT && !KU && !KT) {
    return " No Redis or KV REST variables are visible to this deployment. In Vercel: Project → Settings → Environment Variables → confirm UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or KV_REST_*) are enabled for Production, then redeploy (Clear cache if needed).";
  }
  return "";
}

/** Short string returned in JSON to the browser (full detail goes to logs). */
const QUOTA_UNAVAILABLE_SHORT: Record<QuotaEnvSkipReason, string> = {
  missing_env: "Analysis quota is not configured on the server.",
  empty_after_strip:
    "Analysis quota environment variables look invalid or incomplete.",
  vector_or_search_host:
    "Analysis quota is pointed at the wrong Upstash product; Redis is required.",
  invalid_host:
    "Analysis quota Redis URL is not usable (localhost or invalid).",
};

/** Operator-facing detail logged server-side only (no secrets). */
const QUOTA_UNAVAILABLE_LOG_DETAIL: Record<QuotaEnvSkipReason, string> = {
  missing_env:
    "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL and KV_REST_API_TOKEN) for Production on Vercel, then redeploy. If both name prefixes exist, delete empty UPSTASH_* entries so the KV_* pair can be used.",
  empty_after_strip:
    "Re-paste the Redis REST URL and token in Vercel (Production) with no stray quotes, then redeploy.",
  vector_or_search_host:
    "REST URL is Upstash Search or Vector, not Redis. In Upstash open Redis → your database → REST API and copy that URL and token into Vercel, then redeploy.",
  invalid_host:
    "REST URL must be a public HTTPS Upstash Redis host (not localhost). Update Vercel Production env and redeploy.",
};

export function quotaUnavailableResponseBody(
  reason: QuotaEnvSkipReason,
): { ok: false; error: string; skipReason: QuotaEnvSkipReason } {
  const parts: string[] = [QUOTA_UNAVAILABLE_LOG_DETAIL[reason]];
  if (reason === "missing_env" || reason === "empty_after_strip") {
    const hint = getQuotaEnvDiagnosticHint().trim();
    if (hint) parts.push(hint);
  }
  // vector_or_search_host is already logged in resolveQuotaRestCredentials
  if (reason !== "vector_or_search_host") {
    console.error("[analysis-quota]", parts.filter(Boolean).join(" "));
  }
  return {
    ok: false,
    error: QUOTA_UNAVAILABLE_SHORT[reason],
    skipReason: reason,
  };
}

/**
 * Prefer a complete UPSTASH_* pair, then a complete KV_* pair. Using `??`
 * alone breaks when UPSTASH_* keys exist but are empty strings on Vercel,
 * which would hide a valid KV_* pair.
 */
function pickRedisRestRawPair(): { rawUrl: string; rawToken: string } | null {
  const u1 = process.env.UPSTASH_REDIS_REST_URL;
  const t1 = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (strippedHasChars(u1) && strippedHasChars(t1)) {
    return { rawUrl: u1!, rawToken: t1! };
  }
  const u2 = process.env.KV_REST_API_URL;
  const t2 = process.env.KV_REST_API_TOKEN;
  if (strippedHasChars(u2) && strippedHasChars(t2)) {
    return { rawUrl: u2!, rawToken: t2! };
  }
  return null;
}

function anyRedisEnvVarNonEmpty(): boolean {
  return [
    process.env.UPSTASH_REDIS_REST_URL,
    process.env.UPSTASH_REDIS_REST_TOKEN,
    process.env.KV_REST_API_URL,
    process.env.KV_REST_API_TOKEN,
  ].some(strippedHasChars);
}

function resolveQuotaRestCredentials(): QuotaCredsResolved {
  const pair = pickRedisRestRawPair();
  if (!pair) {
    return {
      ok: false,
      reason: anyRedisEnvVarNonEmpty() ? "empty_after_strip" : "missing_env",
    };
  }

  const rawUrl = pair.rawUrl;
  const rawToken = pair.rawToken;
  const url = stripEnvLine(rawUrl).replace(/\s/g, "");
  const token = stripEnvLine(rawToken);
  if (!url || !token) {
    return { ok: false, reason: "empty_after_strip" };
  }

  const baseUrl = normalizeQuotaRestBaseUrl(url);

  if (looksLikeUpstashVectorOrSearchRestUrl(baseUrl)) {
    console.error(
      "[analysis-quota] UPSTASH_REDIS_REST_URL / KV_REST_API_URL points at Upstash Search or Vector (hostname contains -search or -vector before .upstash.io), not Redis. Open Upstash → Redis → your database → REST API and copy that URL and token. Ignoring these credentials.",
    );
    return { ok: false, reason: "vector_or_search_host" };
  }

  if (isObviousNonRestUrl(baseUrl)) {
    return { ok: false, reason: "invalid_host" };
  }

  return { ok: true, creds: { baseUrl, token } };
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

export type ResolvedQuotaBackend = {
  backend: QuotaBackend;
  rest: QuotaRestCredentials | null;
  /** Present when `backend === "none"` (production, Redis not usable). */
  productionUnavailableReason?: QuotaEnvSkipReason;
};

export function resolveQuotaBackend(): ResolvedQuotaBackend {
  const r = resolveQuotaRestCredentials();
  if (r.ok) {
    return { backend: "redis", rest: r.creds };
  }
  if (process.env.NODE_ENV === "production") {
    return {
      backend: "none",
      rest: null,
      productionUnavailableReason: r.reason,
    };
  }
  if (r.reason === "invalid_host") {
    console.warn(
      "[analysis-quota] REST URL is localhost or not a valid URL; ignoring Redis and using in-memory quota in development. Fix UPSTASH_REDIS_REST_URL / KV_REST_API_URL or unset it.",
    );
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
