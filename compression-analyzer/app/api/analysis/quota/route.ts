import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  readUsageCount,
  quotaUnavailableResponseBody,
  resolveQuotaBackend,
  utcDateKey,
} from "@/lib/analysisQuotaServer";
import {
  FREE_DAILY_ANALYSIS_LIMIT,
  QUOTA_SESSION_COOKIE,
  QUOTA_SESSION_ID_REGEX,
} from "@/lib/quotaConstants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const { backend, rest, productionUnavailableReason } = resolveQuotaBackend();
    if (backend === "none") {
      return NextResponse.json(
        quotaUnavailableResponseBody(
          productionUnavailableReason ?? "missing_env",
        ),
        { status: 503 },
      );
    }

    const store = await cookies();
    const sid = store.get(QUOTA_SESSION_COOKIE)?.value ?? null;
    if (!sid || !QUOTA_SESSION_ID_REGEX.test(sid)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing quota session. Call /api/analysis/session first.",
        },
        { status: 401 },
      );
    }

    const date = utcDateKey();
    const used = await readUsageCount(sid, date, backend, rest);
    const remaining = Math.max(0, FREE_DAILY_ANALYSIS_LIMIT - used);
    return NextResponse.json({
      ok: true,
      used,
      remaining,
      limit: FREE_DAILY_ANALYSIS_LIMIT,
      canStart: used < FREE_DAILY_ANALYSIS_LIMIT,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Analysis quota check failed.";
    console.error("[api/analysis/quota]", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
