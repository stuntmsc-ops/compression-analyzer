import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { isPaypalConfigured, verifyPaypalSubscription } from "@/lib/paypalServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { subscriptionID?: string; subscriptionId?: string };

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
        { ok: false, error: "Expected JSON body with subscriptionID." },
        { status: 400 },
      );
    }
    const subscriptionId =
      typeof body.subscriptionID === "string"
        ? body.subscriptionID
        : typeof body.subscriptionId === "string"
          ? body.subscriptionId
          : "";
    const result = await verifyPaypalSubscription(subscriptionId);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.reason },
        { status: 400 },
      );
    }

    const custom = result.customId ?? "";
    if (!custom || custom !== userId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This PayPal subscription is not linked to your signed-in account. Use the same Google account you started checkout with, or contact support.",
        },
        { status: 403 },
      );
    }

    const planId = process.env.PAYPAL_PLAN_ID?.trim() || null;

    await prisma.payPalSubscription.upsert({
      where: { paypalSubscriptionId: result.subscriptionId },
      create: {
        userId,
        paypalSubscriptionId: result.subscriptionId,
        status: "ACTIVE",
        planId,
      },
      update: {
        userId,
        status: "ACTIVE",
        planId,
      },
    });

    return NextResponse.json({
      ok: true,
      subscriptionId: result.subscriptionId,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "PayPal subscription verify failed.";
    console.error("[api/paypal/verify-subscription]", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
