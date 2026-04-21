import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { userHasActiveProSubscription } from "@/lib/proSubscriptionServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns whether the signed-in user has an active PayPal Pro subscription. */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ ok: true, active: false, authenticated: false });
    }
    const active = await userHasActiveProSubscription(userId);
    return NextResponse.json({
      ok: true,
      active,
      authenticated: true,
    });
  } catch (err) {
    console.error("[api/subscription]", err);
    return NextResponse.json(
      { ok: false, error: "Could not load subscription status." },
      { status: 500 },
    );
  }
}
