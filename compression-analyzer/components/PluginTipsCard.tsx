"use client";

/**
 * Paid-only: short plugin-oriented tips so the free tier can honestly
 * advertise "plugin-specific suggestions" as a Pro surface.
 */
export default function PluginTipsCard() {
  return (
    <div className="bg-surface-900 border border-surface-700 rounded-xl p-4 sm:p-5">
      <p className="text-gray-500 text-[10px] uppercase tracking-widest font-semibold mb-2">
        Pro · Plugin workflow
      </p>
      <h3 className="text-white text-sm font-semibold mb-2">
        Dial these numbers in your DAW
      </h3>
      <ul className="text-gray-400 text-xs leading-relaxed space-y-2 list-disc pl-4">
        <li>
          Match the attack/release you see here on your stock compressor or
          FabFilter Pro-C 2 — same ballpark times work across most plugins.
        </li>
        <li>
          If your compressor shows input vs. output gain, use makeup gain
          after the meter settles so peak level matches your bypass loudness.
        </li>
        <li>
          On a bus, insert before EQ so gentle compression doesn&apos;t fight
          boosts you add later; solo the bus to hear GR in isolation once.
        </li>
      </ul>
    </div>
  );
}
