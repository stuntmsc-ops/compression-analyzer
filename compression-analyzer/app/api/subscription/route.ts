import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { userHasProEntitlement } from "@/lib/proSubscriptionServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns whether the signed-in user has Pro (subscription or one-time purchase). */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ ok: true, active: false, authenticated: false });
    }
    const active = await userHasProEntitlement(userId);
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
