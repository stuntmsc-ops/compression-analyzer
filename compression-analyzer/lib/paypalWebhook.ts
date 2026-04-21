import { getAccessToken, paypalApiBase } from "@/lib/paypalServer";

export type PaypalWebhookEvent = {
  id?: string;
  event_type?: string;
  resource_type?: string;
  resource?: {
    id?: string;
    status?: string;
    custom_id?: string;
    plan_id?: string;
    [key: string]: unknown;
  };
};

/**
 * Verifies PayPal webhook signature (REST verify endpoint) and returns the parsed event.
 */
export async function verifyAndParsePaypalWebhook(
  rawBody: string,
  headers: Headers,
): Promise<
  { ok: true; event: PaypalWebhookEvent } | { ok: false; reason: string }
> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();
  if (!webhookId) {
    return { ok: false, reason: "PAYPAL_WEBHOOK_ID is not set." };
  }

  let parsed: PaypalWebhookEvent;
  try {
    parsed = JSON.parse(rawBody) as PaypalWebhookEvent;
  } catch {
    return { ok: false, reason: "Invalid JSON body." };
  }

  const transmissionId = headers.get("paypal-transmission-id");
  const transmissionTime = headers.get("paypal-transmission-time");
  const certUrl = headers.get("paypal-cert-url");
  const authAlgo = headers.get("paypal-auth-algo");
  const transmissionSig = headers.get("paypal-transmission-sig");

  if (
    !transmissionId ||
    !transmissionTime ||
    !certUrl ||
    !authAlgo ||
    !transmissionSig
  ) {
    return { ok: false, reason: "Missing PayPal webhook headers." };
  }

  const token = await getAccessToken();
  const res = await fetch(
    `${paypalApiBase()}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: parsed,
      }),
      cache: "no-store",
    },
  );
  const text = await res.text();
  let verification: { verification_status?: string };
  try {
    verification = text ? (JSON.parse(text) as typeof verification) : {};
  } catch {
    return { ok: false, reason: "PayPal verify returned non-JSON." };
  }
  if (verification.verification_status !== "SUCCESS") {
    return { ok: false, reason: "Signature verification failed." };
  }
  return { ok: true, event: parsed };
}
