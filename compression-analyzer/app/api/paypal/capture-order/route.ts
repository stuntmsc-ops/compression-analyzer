import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { capturePaypalOrder, isPaypalConfigured } from "@/lib/paypalServer";
import { upsertProOneTimePurchase } from "@/lib/proOneTimePurchaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { orderID?: string; orderId?: string };

export async function POST(req: Request): Promise<NextResponse> {
  try {
    if (!isPaypalConfigured()) {
      return NextResponse.json(
        { ok: false, error: "PayPal is not configured on the server." },
        { status: 503 },
      );
    }
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Sign in before completing checkout." },
        { status: 401 },
      );
    }

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Expected JSON body with orderID." },
        { status: 400 },
      );
    }
    const orderId =
      typeof body.orderID === "string"
        ? body.orderID
        : typeof body.orderId === "string"
          ? body.orderId
          : "";

    const result = await capturePaypalOrder(orderId);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.reason },
        { status: 400 },
      );
    }
    if (!result.customId || result.customId !== userId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This payment is not linked to your signed-in account. Use the same account you started checkout with.",
        },
        { status: 403 },
      );
    }

    await upsertProOneTimePurchase({
      userId: result.customId,
      paypalOrderId: result.orderId,
      amountCents: result.amountCents,
      currency: result.currency,
    });

    return NextResponse.json({ ok: true, orderId: result.orderId });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "PayPal capture failed.";
    console.error("[api/paypal/capture-order]", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
