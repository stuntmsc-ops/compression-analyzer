import { NextResponse } from "next/server";
import { verifyAndParsePaypalWebhook } from "@/lib/paypalWebhook";
import { applyPaypalSubscriptionWebhook } from "@/lib/paypalWebhookSubscription";
import { isPaypalConfigured } from "@/lib/paypalServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    if (!isPaypalConfigured()) {
      return NextResponse.json({ ok: false }, { status: 503 });
    }
    const rawBody = await req.text();
    const verified = await verifyAndParsePaypalWebhook(rawBody, req.headers);
    if (!verified.ok) {
      console.error("[paypal-webhook]", verified.reason);
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const { event } = verified;
    if (
      typeof event.event_type === "string" &&
      event.event_type.startsWith("BILLING.SUBSCRIPTION.")
    ) {
      await applyPaypalSubscriptionWebhook(event);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[paypal-webhook]", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
