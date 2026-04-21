"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import {
  PAYPAL_PRO_CURRENCY,
  PAYPAL_PRO_MONTHLY_AMOUNT_LABEL,
} from "@/lib/paypalConstants";
import { MSG_PAYMENT_FAILED } from "@/lib/userFacingMessages";
import ReportProblemLink from "@/components/ReportProblemLink";

type Props = {
  onUnlock: () => void;
  sessionStatus: "loading" | "authenticated" | "unauthenticated";
  sessionUserId: string | null;
};

type PayState = "idle" | "loading_script" | "ready" | "processing" | "error";

const PAYPAL_SDK = "https://www.paypal.com/sdk/js";

function publicPaypalClientId(): string | undefined {
  const v = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim();
  return v || undefined;
}

/**
 * PayPal Pro subscription ($9/mo). Requires a signed-in user; `custom_id` on
 * the subscription is the user id. After verify, `onUnlock` refreshes session + DB state.
 */
export default function PricingSection({
  onUnlock,
  sessionStatus,
  sessionUserId,
}: Props) {
  const clientId = publicPaypalClientId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<ReturnType<
    NonNullable<Window["paypal"]>["Buttons"]
  > | null>(null);
  const [payState, setPayState] = useState<PayState>(
    clientId ? "loading_script" : "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  const destroyButtons = useCallback(() => {
    try {
      buttonsRef.current?.close();
    } catch {
      /* PayPal SDK may throw if already torn down */
    }
    buttonsRef.current = null;
    if (containerRef.current) containerRef.current.innerHTML = "";
  }, []);

  useEffect(() => {
    if (!clientId) return;

    const existing = document.querySelector(
      `script[src^="${PAYPAL_SDK}"]`,
    ) as HTMLScriptElement | null;

    const done = () => {
      if (window.paypal) setPayState("ready");
      else setPayState("error");
      setMessage(
        window.paypal
          ? null
          : "PayPal script loaded but the SDK is unavailable.",
      );
    };

    if (existing && window.paypal) {
      queueMicrotask(() => {
        setPayState("ready");
      });
      return;
    }

    if (existing && !window.paypal) {
      existing.addEventListener("load", done, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `${PAYPAL_SDK}?client-id=${encodeURIComponent(
      clientId,
    )}&currency=${encodeURIComponent(
      PAYPAL_PRO_CURRENCY,
    )}&vault=true&intent=subscription`;
    script.async = true;
    script.onload = () => done();
    script.onerror = () => {
      setPayState("error");
      setMessage("Could not load PayPal. Check your network or ad blocker.");
    };
    document.body.appendChild(script);

    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, [clientId]);

  useEffect(() => {
    if (payState !== "ready" || !clientId) return;
    if (sessionStatus === "loading") return;
    if (!sessionUserId) {
      destroyButtons();
      return;
    }
    const el = containerRef.current;
    const paypal = window.paypal;
    if (!el || !paypal) return;

    destroyButtons();

    const buttons = paypal.Buttons({
      style: { layout: "vertical", shape: "rect", label: "paypal" },
      createSubscription: async (_data, actions) => {
        setMessage(null);
        const res = await fetch("/api/paypal/subscription-plan");
        const data = (await res.json()) as {
          ok?: boolean;
          planId?: string;
          error?: string;
        };
        if (!res.ok || !data.ok || !data.planId) {
          throw new Error(data.error ?? "Could not start subscription checkout.");
        }
        return actions.subscription.create({
          plan_id: data.planId,
          custom_id: sessionUserId,
        });
      },
      onApprove: async (data) => {
        setPayState("processing");
        setMessage(null);
        const subscriptionID = data.subscriptionID;
        try {
          const res = await fetch("/api/paypal/verify-subscription", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscriptionID }),
          });
          const body = (await res.json()) as {
            ok?: boolean;
            error?: string;
          };
          if (!res.ok || !body.ok) {
            throw new Error(body.error ?? "Subscription verification failed.");
          }
          onUnlock();
          setMessage("Subscription active. Pro features are unlocked.");
          setPayState("ready");
        } catch {
          setPayState("ready");
          setMessage(MSG_PAYMENT_FAILED);
        }
      },
      onError: (err) => {
        console.error("[PayPal]", err);
        setMessage(MSG_PAYMENT_FAILED);
      },
      onCancel: () => {
        setMessage("Checkout cancelled.");
      },
    });

    buttonsRef.current = buttons;
    void buttons.render(el);

    return () => {
      destroyButtons();
    };
  }, [
    payState,
    clientId,
    onUnlock,
    destroyButtons,
    sessionUserId,
    sessionStatus,
  ]);

  return (
    <section
      id="pricing"
      className="max-w-2xl mx-auto mt-12 sm:mt-16 mb-6 px-1 scroll-mt-24"
      aria-labelledby="pricing-heading"
    >
      <div className="rounded-2xl border border-brand-500/25 bg-gradient-to-b from-brand-500/10 to-surface-900 p-5 sm:p-6 text-left">
        <h2
          id="pricing-heading"
          className="text-white text-lg sm:text-xl font-semibold mb-1"
        >
          Unlock everything
        </h2>
        <p className="text-brand-200/90 text-2xl sm:text-3xl font-bold tabular-nums mb-3">
          {PAYPAL_PRO_CURRENCY} {PAYPAL_PRO_MONTHLY_AMOUNT_LABEL}
          <span className="text-base sm:text-lg font-semibold text-gray-400">
            {" "}
            / month
          </span>
        </p>
        <ul className="text-gray-400 text-sm space-y-1.5 mb-5 list-none">
          <li className="flex gap-2">
            <span className="text-brand-400 shrink-0">✓</span>
            All instrument types (kick, snare, bass, guitars, keys, full mix…)
          </li>
          <li className="flex gap-2">
            <span className="text-brand-400 shrink-0">✓</span>
            Unlimited analyses, no daily cap
          </li>
          <li className="flex gap-2">
            <span className="text-brand-400 shrink-0">✓</span>
            Technique coaching + plugin workflow tips
          </li>
          <li className="flex gap-2">
            <span className="text-brand-400 shrink-0">✓</span>
            Copy settings &amp; share links with full state
          </li>
        </ul>

        {!clientId ? (
          <p className="text-amber-200/90 text-sm leading-relaxed">
            PayPal checkout is not configured. Add{" "}
            <code className="text-amber-100/90 text-xs">
              NEXT_PUBLIC_PAYPAL_CLIENT_ID
            </code>{" "}
            (public),{" "}
            <code className="text-amber-100/90 text-xs">
              PAYPAL_CLIENT_SECRET
            </code>{" "}
            (server), and{" "}
            <code className="text-amber-100/90 text-xs">PAYPAL_PLAN_ID</code>{" "}
            (your monthly plan id, starts with{" "}
            <code className="text-amber-100/90 text-xs">P-</code>) to{" "}
            <code className="text-amber-100/90 text-xs">.env.local</code>. Set{" "}
            <code className="text-amber-100/90 text-xs">PAYPAL_MODE=live</code> with
            Live app credentials and a Live billing plan, or{" "}
            <code className="text-amber-100/90 text-xs">PAYPAL_MODE=sandbox</code>{" "}
            (or omit; defaults to sandbox) with sandbox keys for testing. Restart{" "}
            <code className="text-amber-100/90 text-xs">npm run dev</code> after
            saving.
          </p>
        ) : sessionStatus === "loading" ? (
          <p className="text-gray-500 text-sm">Checking sign-in…</p>
        ) : sessionStatus !== "authenticated" || !sessionUserId ? (
          <p className="text-amber-200/90 text-sm leading-relaxed">
            Sign in with Google or email (magic link) to subscribe. Your
            subscription is tied to
            that account so we can unlock Pro after payment and keep access in
            sync when you cancel or renew.
            <button
              type="button"
              className="block mt-3 text-brand-300 hover:text-brand-200 underline text-sm font-medium"
              onClick={() => void signIn()}
            >
              Sign in
            </button>
          </p>
        ) : (
          <>
            {payState === "loading_script" && (
              <p className="text-gray-500 text-sm">Loading PayPal…</p>
            )}
            {payState === "error" && !message && (
              <p className="text-gray-500 text-sm">PayPal could not start.</p>
            )}
            <div ref={containerRef} className="min-h-[44px]" />
            {payState === "processing" && (
              <p className="text-brand-200/90 text-sm mt-2">
                Confirming subscription…
              </p>
            )}
          </>
        )}

        {message && (
          <div
            className={`text-sm mt-3 leading-relaxed space-y-2 ${
              message.includes("active") || message.includes("unlocked")
                ? "text-emerald-400/90"
                : "text-amber-200/90"
            }`}
            role="status"
          >
            <p>{message}</p>
            {!(message.includes("active") || message.includes("unlocked")) && (
              <ReportProblemLink className="text-amber-200/80" />
            )}
          </div>
        )}

        <p className="text-gray-600 text-xs mt-4 leading-relaxed">
          Billed monthly through PayPal. Pro is linked to the account you are
          signed in with. You can manage or cancel your subscription anytime
          from your PayPal account or contact support.
        </p>
      </div>
    </section>
  );
}
