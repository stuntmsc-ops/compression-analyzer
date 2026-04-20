// POST /api/subscribe — email-gate endpoint.
//
// Thin handler on top of `lib/convertkit` (Kit / ConvertKit API v4).
// Responsibilities:
//   • Parse and validate the email (never trust the browser).
//   • Read server-side secrets — CONVERTKIT_API_KEY, CONVERTKIT_FORM_ID,
//     optional CONVERTKIT_TAG_ID — and never echo them to the client.
//   • Map the client library's tagged errors to HTTP status codes with
//     generic user-facing messages.
//
// Runs on the Node runtime (not Edge) so the NODE-native `fetch` is
// available. No caching — the response is per-user.

import { NextResponse } from "next/server";
import {
  subscribeEmail,
  KitClientError,
  type KitDeps,
} from "@/lib/convertkit";
import { validateEmail } from "@/lib/emailValidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubscribeRequestBody = { email?: unknown };

export async function POST(req: Request): Promise<NextResponse> {
  const apiKey = process.env.CONVERTKIT_API_KEY;
  const formIdRaw = process.env.CONVERTKIT_FORM_ID;
  const formId = formIdRaw ? Number(formIdRaw) : NaN;
  const tagRaw = process.env.CONVERTKIT_TAG_ID;
  const tagId =
    tagRaw !== undefined && tagRaw !== "" && Number.isFinite(Number(tagRaw))
      ? Number(tagRaw)
      : null;
  const referrer =
    process.env.CONVERTKIT_SUBSCRIBE_REFERRER?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    undefined;

  if (!apiKey || !Number.isFinite(formId)) {
    console.error("[subscribe] missing or invalid env", {
      hasKey: Boolean(apiKey),
      formIdRaw,
    });
    return NextResponse.json(
      { ok: false, error: "Subscribe service unavailable." },
      { status: 500 },
    );
  }

  let body: SubscribeRequestBody;
  try {
    body = (await req.json()) as SubscribeRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const v = validateEmail(typeof body.email === "string" ? body.email : "");
  if (!v.ok) {
    return NextResponse.json({ ok: false, error: v.reason }, { status: 400 });
  }

  const deps: KitDeps = { apiKey, fetch: globalThis.fetch };
  try {
    const result = await subscribeEmail(v.email, formId, tagId, deps, referrer);
    console.log("[subscribe] ok", {
      subscriberId: result.subscriberId,
      wasCreated: result.wasCreated,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof KitClientError) {
      console.error("[subscribe] convertkit failed", err.detail);
      if (err.detail.kind === "validation") {
        return NextResponse.json(
          { ok: false, error: "That email was rejected upstream." },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { ok: false, error: "Couldn't sign you up right now. Try again shortly." },
        { status: 502 },
      );
    }
    console.error("[subscribe] unexpected", err);
    return NextResponse.json(
      { ok: false, error: "Something went wrong. Try again shortly." },
      { status: 500 },
    );
  }
}
