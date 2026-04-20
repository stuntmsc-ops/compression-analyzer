"use client";

import { useMemo } from "react";
import type { AudioAnalysisResult } from "@/lib/audioAnalysis";
import {
  recommendTechnique,
  type Technique,
  type TechniqueId,
} from "@/lib/technique";
import type { InstrumentType } from "@/lib/types";

type Props = {
  analysis: AudioAnalysisResult;
  instrument: InstrumentType;
};

/**
 * Each technique id gets its own accent colour so the user can tell at
 * a glance that the recommended approach changed when they swap the
 * instrument selector — "this is a different card with different advice,"
 * not a silent text swap. Colours reuse existing Tailwind palette
 * tokens so they theme consistently with the rest of the app.
 */
const ACCENT: Record<
  TechniqueId,
  { border: string; ring: string; text: string; label: string }
> = {
  // Brand blue — standard single-pass sits in the default brand colour
  // because it's the baseline behaviour.
  standard: {
    border: "border-brand-500/25",
    ring: "bg-brand-500/10",
    text: "text-brand-300",
    label: "Standard",
  },
  // Bus uses the warmer amber shade already used for the "common
  // mistake" caveats — same visual language for "handle with care."
  bus: {
    border: "border-amber-500/25",
    ring: "bg-amber-500/10",
    text: "text-amber-300",
    label: "Bus",
  },
  // Serial and parallel share a distinct accent each — keeping them
  // visually separate from brand/amber signals "this is a special
  // approach, not the default." Emerald and violet are the two
  // Tailwind palette entries not otherwise claimed by the app.
  serial: {
    border: "border-emerald-500/25",
    ring: "bg-emerald-500/10",
    text: "text-emerald-300",
    label: "Serial",
  },
  parallel: {
    border: "border-violet-500/25",
    ring: "bg-violet-500/10",
    text: "text-violet-300",
    label: "Parallel",
  },
};

export default function TechniqueCard({ analysis, instrument }: Props) {
  // Pure function, but memoised so toggling unrelated selectors
  // (genre, goal) doesn't re-derive the technique — the recommender
  // only reads analysis + instrument.
  const technique: Technique = useMemo(
    () => recommendTechnique(analysis, instrument),
    [analysis, instrument],
  );

  const accent = ACCENT[technique.id];

  return (
    <div
      className={`bg-surface-900 border ${accent.border} rounded-xl p-4 sm:p-5`}
    >
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded ${accent.ring} ${accent.text}`}
          >
            Technique · {accent.label}
          </span>
        </div>
      </div>

      <h3 className="text-white text-base sm:text-lg font-semibold mb-1.5">
        {technique.title}
      </h3>
      <p className="text-gray-400 text-sm leading-relaxed mb-3">
        {technique.tagline}
      </p>

      {/* "Why this applies" — references the actual measurements or the
          instrument-specific rule that triggered the branch, so the
          user understands the reasoning rather than seeing a generic
          line. Kept as a plain paragraph (not a details/summary) so
          the user doesn't have to click to see the justification — the
          point of this card is to teach. */}
      <p className="text-gray-500 text-xs leading-relaxed mb-4 border-l-2 border-surface-700 pl-3">
        {technique.reason}
      </p>

      {/* Step-by-step. Rendered as <ol> for semantic numbering;
          Tailwind-styled markers align with the "3–4 numbered steps
          the producer can follow in their DAW" spec. */}
      <ol className="space-y-2.5">
        {technique.steps.map((step, i) => (
          <li key={i} className="flex gap-3 items-start">
            <span
              className={`shrink-0 text-[11px] font-semibold tabular-nums w-5 h-5 inline-flex items-center justify-center rounded-full ${accent.ring} ${accent.text}`}
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <p className="text-gray-300 text-sm leading-relaxed min-w-0">
              {step}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
