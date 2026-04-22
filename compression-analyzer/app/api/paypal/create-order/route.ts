import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { createOneTimeOrder, isPaypalConfigured } from "@/lib/paypalServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
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
        { ok: false, error: "Sign in before checkout." },
        { status: 401 },
      );
    }
    const result = await createOneTimeOrder(userId);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.reason },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, orderID: result.orderId });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not create PayPal order.";
    console.error("[api/paypal/create-order]", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
