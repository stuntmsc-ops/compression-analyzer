"use client";

import Button from "./Button";

type Props = {
  onUnlock: () => void;
};

/**
 * Simple pricing strip for Day 23. Day 24 replaces the unlock affordance
 * with real Stripe checkout — until then this sets the paid flag in
 * localStorage so the full product surface can be tested end-to-end.
 */
export default function PricingSection({ onUnlock }: Props) {
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
          $9
          <span className="text-base sm:text-lg font-semibold text-gray-400">
            /month
          </span>
        </p>
        <ul className="text-gray-400 text-sm space-y-1.5 mb-5 list-none">
          <li className="flex gap-2">
            <span className="text-brand-400 shrink-0">✓</span>
            All instrument types (kick, snare, bass, guitars, keys, full mix…)
          </li>
          <li className="flex gap-2">
            <span className="text-brand-400 shrink-0">✓</span>
            Unlimited analyses — no daily cap
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
        <Button size="lg" className="w-full sm:w-auto" onClick={onUnlock}>
          Unlock all instruments — $9/mo
        </Button>
        <p className="text-gray-600 text-[11px] mt-3 leading-relaxed">
          Secure card checkout via Stripe is coming in the next release. This
          button unlocks every feature in this browser now so you can try the
          full workflow; your subscription will move to real billing when
          checkout goes live.
        </p>
      </div>
    </section>
  );
}
