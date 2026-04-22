import { getCheckoutOrder } from "@/lib/paypalServer";
import type { PaypalWebhookEvent } from "@/lib/paypalWebhook";
import { upsertProOneTimePurchase } from "@/lib/proOneTimePurchaseServer";

/**
 * Idempotent grant from PAYMENT.CAPTURE.COMPLETED (backup if client capture missed).
 */
export async function applyPaypalPaymentCaptureCompleted(
  event: PaypalWebhookEvent,
): Promise<void> {
  const resource = event.resource;
  if (!resource || typeof resource !== "object") return;

  const supp = (resource as { supplementary_data?: { related_ids?: { order_id?: string } } })
    .supplementary_data;
  const orderIdFromEvent =
    typeof supp?.related_ids?.order_id === "string"
      ? supp.related_ids.order_id
      : null;
  if (!orderIdFromEvent) {
    console.warn(
      "[paypal-webhook] PAYMENT.CAPTURE.COMPLETED missing order id in supplement",
    );
    return;
  }

  const order = await getCheckoutOrder(orderIdFromEvent);
  if (!order.ok) {
    console.warn("[paypal-webhook] getCheckoutOrder", order.reason);
    return;
  }
  if (!order.customId) {
    console.warn(
      "[paypal-webhook] Order has no custom_id; cannot link to user.",
    );
    return;
  }

  try {
    await upsertProOneTimePurchase({
      userId: order.customId,
      paypalOrderId: order.orderId,
      amountCents: order.amountCents,
      currency: order.currency,
    });
  } catch (e) {
    console.error("[paypal-webhook] upsert ProOneTimePurchase", e);
  }
}
