import { prisma } from "@/lib/prisma";
import type { PaypalWebhookEvent } from "@/lib/paypalWebhook";

function statusFromEventType(eventType: string | undefined): string | null {
  switch (eventType) {
    case "BILLING.SUBSCRIPTION.ACTIVATED":
      return "ACTIVE";
    case "BILLING.SUBSCRIPTION.CANCELLED":
      return "CANCELLED";
    case "BILLING.SUBSCRIPTION.SUSPENDED":
      return "SUSPENDED";
    case "BILLING.SUBSCRIPTION.EXPIRED":
      return "EXPIRED";
    case "BILLING.SUBSCRIPTION.UPDATED":
      return null;
    default:
      return null;
  }
}

/**
 * Applies PayPal billing subscription webhook payloads to `PayPalSubscription` rows.
 */
export async function applyPaypalSubscriptionWebhook(
  event: PaypalWebhookEvent,
): Promise<void> {
  const resource = event.resource;
  const paypalSubscriptionId =
    typeof resource?.id === "string" ? resource.id : null;
  if (!paypalSubscriptionId) return;

  const fromType = statusFromEventType(event.event_type);
  const resourceStatus =
    typeof resource?.status === "string" ? resource.status : null;
  const status = resourceStatus ?? fromType;
  if (!status) return;

  const customId =
    typeof resource?.custom_id === "string" && resource.custom_id.trim()
      ? resource.custom_id.trim()
      : null;
  const planId =
    typeof resource?.plan_id === "string" && resource.plan_id.trim()
      ? resource.plan_id.trim()
      : null;

  const existing = await prisma.payPalSubscription.findUnique({
    where: { paypalSubscriptionId },
  });

  if (existing) {
    await prisma.payPalSubscription.update({
      where: { paypalSubscriptionId },
      data: { status, ...(planId ? { planId } : {}) },
    });
    return;
  }

  if (!customId) {
    console.warn(
      "[paypal-webhook] No PayPalSubscription row and no custom_id; skipping create",
      { paypalSubscriptionId, event_type: event.event_type },
    );
    return;
  }

  await prisma.payPalSubscription.create({
    data: {
      userId: customId,
      paypalSubscriptionId,
      status,
      planId: planId ?? undefined,
    },
  });
}
