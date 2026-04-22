// Server-side PayPal REST (Orders v2 + Subscriptions v1). Used only from Route Handlers.
// Set PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET; PAYPAL_MODE=live|sandbox.
// One-time: optional PAYPAL_ONETIME_USD (default 29). Legacy subscription: PAYPAL_PLAN_ID.

import { PAYPAL_PRO_CURRENCY, PAYPAL_PRO_ONETIME_USD } from "@/lib/paypalConstants";
import { randomUUID } from "node:crypto";

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

/** Client id + secret — enough for OAuth, webhooks, and one-time checkout. */
export function isPaypalApiConfigured(): boolean {
  return Boolean(paypalClientId() && paypalClientSecret());
}

/** One-time $29 (or PAYPAL_ONETIME_USD) checkout. */
export function isPaypalConfigured(): boolean {
  return isPaypalApiConfigured();
}

/** Legacy monthly subscription flow (plan id required). */
export function isPaypalSubscriptionCheckoutConfigured(): boolean {
  return Boolean(
    paypalClientId() && paypalClientSecret() && getPaypalPlanId(),
  );
}

function onetimeUsdAmountString(): string {
  const raw = process.env.PAYPAL_ONETIME_USD?.trim();
  const n = raw ? Number.parseFloat(raw) : PAYPAL_PRO_ONETIME_USD;
  if (!Number.isFinite(n) || n <= 0) {
    return PAYPAL_PRO_ONETIME_USD.toFixed(2);
  }
  return n.toFixed(2);
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

// ── Orders v2: one-time capture ────────────────────────────────────

/** PayPal 4xx/5xx JSON often includes `details[].description`. */
function messageFromPaypalErrorJson(text: string): string {
  try {
    const j = JSON.parse(text) as {
      message?: string;
      details?: { description?: string; issue?: string }[];
    };
    if (typeof j.message === "string" && j.message.trim()) return j.message;
    const d0 = j.details?.[0];
    const s =
      (typeof d0?.description === "string" && d0.description) ||
      (typeof d0?.issue === "string" && d0.issue);
    if (s) return s;
  } catch {
    /* fall through */
  }
  if (text.trim() && text.length < 500) return text.trim();
  return "PayPal request failed.";
}

export async function createOneTimeOrder(
  userId: string,
): Promise<
  { ok: true; orderId: string } | { ok: false; reason: string }
> {
  const id = userId?.trim();
  if (!id) return { ok: false, reason: "Missing user id." };

  const token = await getAccessToken();
  const value = onetimeUsdAmountString();
  const res = await fetch(`${paypalApiBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": randomUUID(),
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: PAYPAL_PRO_CURRENCY,
            value,
          },
          custom_id: id,
        },
      ],
    }),
    cache: "no-store",
  });
  const text = await res.text();
  let data: { id?: string; message?: string };
  try {
    data = text ? (JSON.parse(text) as typeof data) : {};
  } catch {
    return { ok: false, reason: "PayPal returned non-JSON for create order." };
  }
  if (!res.ok || !data.id) {
    return {
      ok: false,
      reason: !res.ok
        ? messageFromPaypalErrorJson(text)
        : "Create order failed: missing id.",
    };
  }
  return { ok: true, orderId: data.id };
}

/** GET order (for custom_id if capture body omits it) — read custom_id and status. */
export async function getCheckoutOrder(
  orderId: string,
): Promise<
  | {
      ok: true;
      orderId: string;
      status: string;
      customId: string;
      amountCents: number;
      currency: string;
    }
  | { ok: false; reason: string }
> {
  const trimmed = orderId?.trim();
  if (!trimmed) return { ok: false, reason: "Missing order id." };
  const token = await getAccessToken();
  const res = await fetch(
    `${paypalApiBase()}/v2/checkout/orders/${encodeURIComponent(trimmed)}`,
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
  type OShape = {
    id?: string;
    status?: string;
    message?: string;
    purchase_units?: {
      custom_id?: string;
      payments?: { captures?: { amount?: { value?: string; currency_code?: string }; status?: string }[] };
    }[];
  };
  let data: OShape;
  try {
    data = text ? (JSON.parse(text) as OShape) : {};
  } catch {
    return { ok: false, reason: "Order lookup returned non-JSON." };
  }
  if (!res.ok) {
    return { ok: false, reason: messageFromPaypalErrorJson(text) };
  }
  const st = data.status;
  if (st !== "COMPLETED") {
    return {
      ok: false,
      reason: `Order not completed (status: ${st ?? "unknown"}).`,
    };
  }
  const unit = data.purchase_units?.[0];
  const customId = typeof unit?.custom_id === "string" ? unit.custom_id : "";
  const capture = unit?.payments?.captures?.[0];
  if (capture?.status !== "COMPLETED") {
    return {
      ok: false,
      reason: "No completed capture on order.",
    };
  }
  const amountStr = capture?.amount?.value;
  const currency =
    typeof capture?.amount?.currency_code === "string"
      ? capture.amount.currency_code
      : PAYPAL_PRO_CURRENCY;
  const amountNum = amountStr != null ? Number.parseFloat(String(amountStr)) : Number.NaN;
  const amountCents = Number.isFinite(amountNum)
    ? Math.round(amountNum * 100)
    : 0;
  return {
    ok: true,
    orderId: typeof data.id === "string" ? data.id : trimmed,
    status: st,
    customId,
    amountCents,
    currency,
  };
}

export type CapturePaypalOrderResult =
  | {
      ok: true;
      orderId: string;
      customId: string;
      amountCents: number;
      currency: string;
    }
  | { ok: false; reason: string };

export async function capturePaypalOrder(
  orderId: string,
): Promise<CapturePaypalOrderResult> {
  const trimmed = orderId?.trim();
  if (!trimmed) return { ok: false, reason: "Missing order id." };

  const token = await getAccessToken();
  // PayPal expects `Content-Type: application/json` with an empty object — not
  // a no-body POST, and the Prefer header is not valid on capture (422 payload).
  const res = await fetch(
    `${paypalApiBase()}/v2/checkout/orders/${encodeURIComponent(trimmed)}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": randomUUID(),
      },
      body: JSON.stringify({}),
      cache: "no-store",
    },
  );
  const text = await res.text();
  type CapShape = {
    id?: string;
    status?: string;
    message?: string;
    purchase_units?: {
      custom_id?: string;
      payments?: { captures?: { status?: string; amount?: { value?: string; currency_code?: string } }[] };
    }[];
  };
  let data: CapShape;
  try {
    data = text ? (JSON.parse(text) as CapShape) : {};
  } catch {
    return { ok: false, reason: "PayPal returned non-JSON for capture." };
  }
  if (!res.ok) {
    return { ok: false, reason: messageFromPaypalErrorJson(text) };
  }
  if (data.status !== "COMPLETED") {
    return {
      ok: false,
      reason: `Order not completed (status: ${data.status ?? "unknown"}).`,
    };
  }
  const unit = data.purchase_units?.[0];
  let customId = typeof unit?.custom_id === "string" ? unit.custom_id : "";
  const capList = unit?.payments?.captures ?? [];
  const capture = capList.find((c) => c?.status === "COMPLETED") ?? capList[0];
  if (!capture) {
    return { ok: false, reason: "No capture in PayPal response." };
  }
  if (capture.status !== "COMPLETED") {
    return {
      ok: false,
      reason: `Capture not completed (status: ${capture.status ?? "?"}).`,
    };
  }
  const amountStr = capture?.amount?.value;
  const currency =
    typeof capture?.amount?.currency_code === "string"
      ? capture.amount.currency_code
      : PAYPAL_PRO_CURRENCY;
  const amountNum = amountStr != null ? Number.parseFloat(String(amountStr)) : Number.NaN;
  let amountCents = Number.isFinite(amountNum)
    ? Math.round(amountNum * 100)
    : 0;
  if (!customId) {
    const reRead = await getCheckoutOrder(trimmed);
    if (reRead.ok) {
      customId = reRead.customId;
      if (amountCents === 0) amountCents = reRead.amountCents;
    }
  }
  return {
    ok: true,
    orderId: typeof data.id === "string" ? data.id : trimmed,
    customId,
    amountCents,
    currency,
  };
}
