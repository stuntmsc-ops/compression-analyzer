/** Max completed analyses per day for free tier (server-enforced). */
export const FREE_DAILY_ANALYSIS_LIMIT = 3;

/** HttpOnly cookie binding the browser to a server-side quota bucket. */
export const QUOTA_SESSION_COOKIE = "ca_quota_sid";

/** Session id is a UUID v4 (36 chars with hyphens). */
export const QUOTA_SESSION_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Cookie lifetime — long-lived so clearing localStorage alone does not reset quota. */
export const QUOTA_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400;

/** Redis key TTL — two days so UTC-day keys expire without manual cleanup. */
export const QUOTA_KEY_TTL_SEC = 60 * 60 * 48;
