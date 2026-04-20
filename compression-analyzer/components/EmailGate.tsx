"use client";

import { useState } from "react";
import Button from "./Button";
import { validateEmail } from "@/lib/emailValidation";

type Props = {
  /** Called after the server accepts the submission. The parent is
   *  responsible for persisting the "already submitted" flag — this
   *  component does not touch localStorage directly. */
  onSubmitted: () => void;
};

/**
 * State machine:
 *   idle         — empty form, awaiting input
 *   invalid      — last submit failed client-side validation
 *   submitting   — POST in flight; form disabled
 *   failed       — server returned an error; keep form editable
 *   confirming   — server accepted; show "check your inbox" copy
 *                  (ConvertKit double opt-in sends the confirmation
 *                  email from your form settings)
 */
type Phase =
  | { kind: "idle" }
  | { kind: "invalid"; reason: string }
  | { kind: "submitting" }
  | { kind: "failed"; reason: string }
  | { kind: "confirming" };

export default function EmailGate({ onSubmitted }: Props) {
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phase.kind === "submitting") return;

    const v = validateEmail(email);
    if (!v.ok) {
      setPhase({ kind: "invalid", reason: v.reason });
      return;
    }

    setPhase({ kind: "submitting" });
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: v.email }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok: boolean; error?: string }
        | null;

      if (!res.ok || !data?.ok) {
        const reason =
          data?.error ?? "Something went wrong. Try again shortly.";
        setPhase({ kind: "failed", reason });
        return;
      }

      // Double opt-in: settings unlock now; the 3-day training starts
      // only after the user confirms via email. Show the confirmation
      // nudge for a beat before lifting the gate so they notice it.
      setPhase({ kind: "confirming" });
      // Short delay so the "check your inbox" note is perceptible;
      // 1.5s is long enough to read, short enough to not feel stuck.
      setTimeout(onSubmitted, 1500);
    } catch (err) {
      setPhase({
        kind: "failed",
        reason:
          err instanceof Error && err.message.length < 100
            ? err.message
            : "Couldn't reach the server. Try again shortly.",
      });
    }
  }

  const disabled = phase.kind === "submitting" || phase.kind === "confirming";
  const message =
    phase.kind === "invalid" || phase.kind === "failed" ? phase.reason : null;

  return (
    <div
      role="dialog"
      aria-labelledby="email-gate-title"
      className="bg-surface-900 border border-surface-700 rounded-xl p-5 sm:p-6"
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-brand-500/15 border border-brand-500/30 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-brand-400"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M2.003 5.884 10 9.882l7.997-3.998A2 2 0 0 0 16 4H4a2 2 0 0 0-1.997 1.884Z" />
            <path d="m18 8.118-8 4-8-4V14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.118Z" />
          </svg>
        </div>
        <div className="min-w-0">
          <h2
            id="email-gate-title"
            className="text-white text-base sm:text-lg font-semibold leading-tight"
          >
            Almost there — enter your email to unlock your settings.
          </h2>
          <p className="mt-1.5 text-gray-400 text-sm leading-relaxed">
            You&apos;ll also get our free 3-day compression training.
            Unsubscribe anytime.
          </p>
        </div>
      </div>

      {phase.kind === "confirming" ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-3 flex items-start gap-2.5"
        >
          <svg
            className="w-4 h-4 text-brand-300 shrink-0 mt-0.5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4Z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-brand-100 text-sm leading-relaxed">
            Check your inbox to confirm your subscription — your settings are
            unlocking now.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          <label className="block">
            <span className="sr-only">Email address</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              disabled={disabled}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                // Clear in-place errors as the user edits — stale error
                // text next to a corrected field is its own UX bug.
                if (phase.kind === "invalid" || phase.kind === "failed") {
                  setPhase({ kind: "idle" });
                }
              }}
              placeholder="you@example.com"
              aria-invalid={phase.kind === "invalid" || phase.kind === "failed"}
              aria-describedby={message ? "email-gate-error" : undefined}
              className="w-full px-4 py-2.5 rounded-lg bg-surface-800 border border-surface-700 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 disabled:cursor-not-allowed tabular-nums"
            />
          </label>

          {message && (
            <p
              id="email-gate-error"
              role="alert"
              className="text-amber-300 text-xs leading-relaxed"
            >
              {message}
            </p>
          )}

          <div className="flex items-center justify-between gap-3">
            <p className="text-gray-600 text-[11px] leading-relaxed">
              By submitting you agree to our{" "}
              <a
                href="/privacy"
                className="underline decoration-dotted hover:text-gray-400"
              >
                privacy policy
              </a>
              .
            </p>
            <Button
              type="submit"
              size="md"
              disabled={disabled}
              aria-busy={phase.kind === "submitting"}
            >
              {phase.kind === "submitting" ? "Sending…" : "Unlock settings"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
