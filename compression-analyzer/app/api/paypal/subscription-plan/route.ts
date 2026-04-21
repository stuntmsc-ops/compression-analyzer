import { NextResponse } from "next/server";
import { getPaypalPlanId, isPaypalConfigured } from "@/lib/paypalServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    if (!isPaypalConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "PayPal is not configured (client id, secret, and PAYPAL_PLAN_ID).",
        },
        { status: 503 },
      );
    }
    const planId = getPaypalPlanId();
    if (!planId) {
      return NextResponse.json(
        { ok: false, error: "Missing PAYPAL_PLAN_ID on the server." },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true, planId });
  } catch (err) {
    console.error("[api/paypal/subscription-plan]", err);
    return NextResponse.json(
      { ok: false, error: "Could not load subscription plan." },
      { status: 500 },
    );
  }
}
