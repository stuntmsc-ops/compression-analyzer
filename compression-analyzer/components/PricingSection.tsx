"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import {
  PAYPAL_PRO_CURRENCY,
  PAYPAL_PRO_ONETIME_USD,
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

const displayOnetimeUsd =
  typeof process.env.NEXT_PUBLIC_PAYPAL_ONETIME_USD === "string" &&
  process.env.NEXT_PUBLIC_PAYPAL_ONETIME_USD.trim() !== ""
    ? process.env.NEXT_PUBLIC_PAYPAL_ONETIME_USD.trim()
    : String(PAYPAL_PRO_ONETIME_USD);

/**
 * PayPal one-time Pro purchase. Requires a signed-in user; `custom_id` on
 * the order is the user id. After capture, `onUnlock` refreshes subscription state.
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
    )}`;
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
      createOrder: async () => {
        setMessage(null);
        const res = await fetch("/api/paypal/create-order", {
          method: "POST",
          credentials: "include",
        });
        const data = (await res.json()) as {
          ok?: boolean;
          orderID?: string;
          error?: string;
        };
        if (!res.ok || !data.ok || !data.orderID) {
          throw new Error(data.error ?? "Could not start checkout.");
        }
        return data.orderID;
      },
      onApprove: async (data) => {
        setPayState("processing");
        setMessage(null);
        const d = data as { orderID?: string; orderId?: string };
        const orderID = d.orderID ?? d.orderId;
        if (!orderID) {
          console.error("[PayPal] onApprove missing order id", data);
          setPayState("ready");
          setMessage(
            "PayPal did not return an order id. Check the console and try again.",
          );
          return;
        }
        try {
          const res = await fetch("/api/paypal/capture-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ orderID }),
          });
          const raw = await res.text();
          let body: { ok?: boolean; error?: string };
          try {
            body = raw ? (JSON.parse(raw) as typeof body) : {};
          } catch {
            setPayState("ready");
            setMessage(
              raw
                ? `Server error (${res.status}). ${raw.slice(0, 120)}…`
                : MSG_PAYMENT_FAILED,
            );
            return;
          }
          if (!res.ok || !body.ok) {
            setPayState("ready");
            setMessage(body.error ?? MSG_PAYMENT_FAILED);
            return;
          }
          onUnlock();
          setMessage("Payment complete. Pro features are unlocked.");
          setPayState("ready");
        } catch (e) {
          console.error("[PayPal] capture-order", e);
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
          Unlock unlimited
        </h2>
        <p className="text-brand-200/90 text-2xl sm:text-3xl font-bold tabular-nums mb-3">
          {PAYPAL_PRO_CURRENCY} {displayOnetimeUsd}
          <span className="text-base sm:text-lg font-semibold text-gray-400">
            {" "}
            one-time
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
            and{" "}
            <code className="text-amber-100/90 text-xs">
              PAYPAL_CLIENT_SECRET
            </code>{" "}
            to{" "}
            <code className="text-amber-100/90 text-xs">.env.local</code>.
            Optional:{" "}
            <code className="text-amber-100/90 text-xs">PAYPAL_ONETIME_USD</code>{" "}
            and{" "}
            <code className="text-amber-100/90 text-xs">
              NEXT_PUBLIC_PAYPAL_ONETIME_USD
            </code>{" "}
            to match the displayed price (default {PAYPAL_PRO_ONETIME_USD}). Set{" "}
            <code className="text-amber-100/90 text-xs">PAYPAL_MODE=live</code>{" "}
            with Live credentials, or{" "}
            <code className="text-amber-100/90 text-xs">PAYPAL_MODE=sandbox</code>{" "}
            (or omit) for sandbox. Restart{" "}
            <code className="text-amber-100/90 text-xs">npm run dev</code> after
            saving.
          </p>
        ) : sessionStatus === "loading" ? (
          <p className="text-gray-500 text-sm">Checking sign-in…</p>
        ) : sessionStatus !== "authenticated" || !sessionUserId ? (
          <p className="text-amber-200/90 text-sm leading-relaxed">
            Sign in with Google or email (magic link) to pay. Pro is linked to
            the account you use at checkout.
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
                Confirming payment…
              </p>
            )}
          </>
        )}

        {message && (
          <div
            className={`text-sm mt-3 leading-relaxed space-y-2 ${
              message.includes("complete") || message.includes("unlocked")
                ? "text-emerald-400/90"
                : "text-amber-200/90"
            }`}
            role="status"
          >
            <p>{message}</p>
            {!(
              message.includes("complete") || message.includes("unlocked")
            ) && (
              <ReportProblemLink className="text-amber-200/80" />
            )}
          </div>
        )}

        <p className="text-gray-600 text-xs mt-4 leading-relaxed">
          One-time payment through PayPal, linked to the account you are signed
          in with. For payment issues, use PayPal or contact support.
        </p>
      </div>
    </section>
  );
}
