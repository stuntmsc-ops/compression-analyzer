// Server-side PayPal REST (Subscriptions v1). Used only from Route Handlers.
// Set PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET + PAYPAL_PLAN_ID; PAYPAL_MODE=live|sandbox.

type PayPalMode = "sandbox" | "live";

function paypalMode(): PayPalMode {
  const m = (process.env.PAYPAL_MODE ?? "sandbox").toLowerCase();
  return m === "live" ? "live" : "sandbox";
}

export function paypalApiBase(): string {
  return paypalMode() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function paypalClientId(): string | null {
  const id =
    process.env.PAYPAL_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim();
  return id || null;
}

function paypalClientSecret(): string | null {
  const s = process.env.PAYPAL_CLIENT_SECRET?.trim();
  return s || null;
}

/** Billing plan id from PayPal (e.g. P-xxxxxxxx). Create under Products & Subscriptions in the developer dashboard. */
export function getPaypalPlanId(): string | null {
  const p = process.env.PAYPAL_PLAN_ID?.trim();
  return p || null;
}

export function isPaypalConfigured(): boolean {
  return Boolean(
    paypalClientId() && paypalClientSecret() && getPaypalPlanId(),
  );
}

let cachedToken: { token: string; expiresAtMs: number } | null = null;

/** Clears OAuth cache — tests only. */
export function resetPaypalServerForTests(): void {
  cachedToken = null;
}

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs > now + 30_000) {
    return cachedToken.token;
  }
  const id = paypalClientId();
  const secret = paypalClientSecret();
  if (!id || !secret) {
    throw new Error("PayPal client credentials are not configured.");
  }
  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const text = await res.text();
  let data: { access_token?: string; expires_in?: number };
  try {
    data = text ? (JSON.parse(text) as typeof data) : {};
  } catch {
    throw new Error("PayPal OAuth returned non-JSON.");
  }
  if (!res.ok || !data.access_token) {
    throw new Error(
      typeof (data as { error_description?: string }).error_description ===
        "string"
        ? (data as { error_description: string }).error_description
        : `PayPal OAuth failed (HTTP ${res.status}).`,
    );
  }
  const ttlSec = typeof data.expires_in === "number" ? data.expires_in : 300;
  cachedToken = {
    token: data.access_token,
    expiresAtMs: now + ttlSec * 1000,
  };
  return data.access_token;
}

type SubscriptionPayload = {
  id?: string;
  status?: string;
  custom_id?: string;
  message?: string;
};

function subscriptionCustomId(data: SubscriptionPayload): string | null {
  const c = data.custom_id;
  return typeof c === "string" && c.trim() ? c.trim() : null;
}

async function fetchSubscription(
  token: string,
  subscriptionId: string,
): Promise<{ ok: boolean; data: SubscriptionPayload; httpStatus: number }> {
  const res = await fetch(
    `${paypalApiBase()}/v1/billing/subscriptions/${encodeURIComponent(
      subscriptionId,
    )}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    },
  );
  const text = await res.text();
  let data: SubscriptionPayload = {};
  try {
    data = text ? (JSON.parse(text) as SubscriptionPayload) : {};
  } catch {
    return { ok: false, data: {}, httpStatus: res.status };
  }
  return { ok: res.ok, data, httpStatus: res.status };
}

export type VerifyPaypalSubscriptionResult =
  | { ok: true; subscriptionId: string; customId: string | null }
  | { ok: false; reason: string };

/**
 * Confirms a subscription the buyer approved in the PayPal widget.
 * Activates when PayPal returns APPROVED (required before billing for some flows).
 */
export async function verifyPaypalSubscription(
  subscriptionId: string,
): Promise<VerifyPaypalSubscriptionResult> {
  const trimmed = subscriptionId?.trim();
  if (!trimmed) return { ok: false, reason: "Missing subscription id." };

  const token = await getAccessToken();
  const { ok, data, httpStatus } = await fetchSubscription(token, trimmed);

  if (!ok) {
    const msg =
      typeof data.message === "string"
        ? data.message
        : `PayPal subscription lookup failed (HTTP ${httpStatus}).`;
    return { ok: false, reason: msg };
  }

  const status = data.status;

  if (status === "ACTIVE") {
    return {
      ok: true,
      subscriptionId: data.id ?? trimmed,
      customId: subscriptionCustomId(data),
    };
  }

  if (status === "APPROVED") {
    const actRes = await fetch(
      `${paypalApiBase()}/v1/billing/subscriptions/${encodeURIComponent(
        trimmed,
      )}/activate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: "Subscriber completed PayPal checkout",
        }),
        cache: "no-store",
      },
    );
    if (!actRes.ok) {
      const t = await actRes.text();
      let errMsg = `Activate failed (HTTP ${actRes.status}).`;
      try {
        const j = JSON.parse(t) as { message?: string };
        if (typeof j.message === "string") errMsg = j.message;
      } catch {
        if (t) errMsg = t.slice(0, 200);
      }
      return { ok: false, reason: errMsg };
    }

    const after = await fetchSubscription(token, trimmed);
    if (!after.ok) {
      return {
        ok: false,
        reason: "Subscription could not be reloaded after activate.",
      };
    }
    if (after.data.status === "ACTIVE") {
      return {
        ok: true,
        subscriptionId: after.data.id ?? trimmed,
        customId: subscriptionCustomId(after.data),
      };
    }
    return {
      ok: false,
      reason: `After activate, status was ${after.data.status ?? "unknown"}.`,
    };
  }

  return {
    ok: false,
    reason: `Subscription not active (status: ${status ?? "unknown"}).`,
  };
}
