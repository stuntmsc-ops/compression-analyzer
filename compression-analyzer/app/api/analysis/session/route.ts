import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  QUOTA_SESSION_COOKIE,
  QUOTA_COOKIE_MAX_AGE_SEC,
  QUOTA_SESSION_ID_REGEX,
} from "@/lib/quotaConstants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ensures the browser has a stable HttpOnly session id for quota accounting.
 * Call once on app load (before /quota and /record).
 */
export async function GET(): Promise<NextResponse> {
  try {
    const store = await cookies();
    const existing = store.get(QUOTA_SESSION_COOKIE)?.value ?? null;

    if (existing && QUOTA_SESSION_ID_REGEX.test(existing)) {
      return NextResponse.json({ ok: true });
    }

    const sid = randomUUID();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(QUOTA_SESSION_COOKIE, sid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: QUOTA_COOKIE_MAX_AGE_SEC,
    });
    return res;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Analysis session cookie failed.";
    console.error("[api/analysis/session]", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
