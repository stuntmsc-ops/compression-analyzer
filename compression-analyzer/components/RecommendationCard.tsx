"use client";

import { useMemo } from "react";
import type { AudioAnalysisResult } from "@/lib/audioAnalysis";
import {
  GENRE_OPTIONS,
  GOAL_OPTIONS,
  INSTRUMENT_OPTIONS,
  type CompressionGoal,
  type Genre,
  type InstrumentType,
} from "@/lib/types";
import { recommendCompression } from "@/lib/recommendationEngine";

type Props = {
  analysis: AudioAnalysisResult;
  instrument: InstrumentType;
  genre: Genre;
  goal: CompressionGoal;
};

// ─── Formatting ────────────────────────────────────────────────────

function formatRatio(r: number): string {
  return Number.isInteger(r) ? `${r}:1` : `${r.toFixed(1)}:1`;
}

function formatMs(ms: number): string {
  // ≥10ms: integer is detailed enough for a plugin dial. <10ms: one
  // decimal reveals the sub-ms resolution a fast attack actually has.
  return ms >= 10 ? Math.round(ms).toString() : ms.toFixed(1);
}

function formatSignedDb(db: number): string {
  return db > 0 ? `+${db.toFixed(1)}` : db.toFixed(1);
}

function labelForInstrument(v: InstrumentType): string {
  return INSTRUMENT_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

function labelForGenre(v: Genre): string {
  return GENRE_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

function labelForGoal(v: CompressionGoal): string {
  return GOAL_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

// ─── Sub-components ────────────────────────────────────────────────

function SettingTile({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="flex flex-col bg-surface-800 border border-surface-700 rounded-lg px-3 py-2.5">
      <span className="text-gray-500 text-[10px] uppercase tracking-widest font-semibold">
        {label}
      </span>
      <span className="mt-1.5 text-white text-xl font-semibold tabular-nums leading-none">
        {value}
        {unit && (
          <span className="text-gray-500 text-sm font-normal ml-1">{unit}</span>
        )}
      </span>
    </div>
  );
}

function SectionHeader({ children }: { children: string }) {
  return (
    <p className="text-gray-500 text-[10px] uppercase tracking-widest font-semibold mb-2">
      {children}
    </p>
  );
}

// ─── Main component ───────────────────────────────────────────────

export default function RecommendationCard({
  analysis,
  instrument,
  genre,
  goal,
}: Props) {
  const rec = useMemo(
    () => recommendCompression(analysis, instrument, genre, goal),
    [analysis, instrument, genre, goal],
  );

  // Engine returns null for silent / unmeasurable input. The warnings
  // banner in AudioProfile already tells the user why; here we just
  // refuse to render nonsense settings.
  if (!rec) return null;

  const { settings, adjustments } = rec;
  const crestSign =
    adjustments.crestDeviationDb >= 0 ? "+" : "";

  return (
    <div className="bg-surface-900 border border-surface-700 rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4 gap-2">
        <p className="text-gray-400 text-sm font-semibold">
          Recommended Settings
        </p>
        <span className="text-gray-600 text-xs text-right">
          {labelForInstrument(instrument)} · {labelForGenre(genre)} ·{" "}
          {labelForGoal(goal)}
        </span>
      </div>

      {/* Primary: what the compressor does */}
      <section className="mb-4">
        <SectionHeader>Compression</SectionHeader>
        <div className="grid grid-cols-3 gap-2">
          <SettingTile
            label="Threshold"
            value={settings.thresholdDb.toFixed(1)}
            unit="dB"
          />
          <SettingTile label="Ratio" value={formatRatio(settings.ratio)} />
          <SettingTile
            label="Makeup"
            value={formatSignedDb(settings.makeupDb)}
            unit="dB"
          />
        </div>
      </section>

      {/* Secondary: how fast, how soft */}
      <section className="mb-4">
        <SectionHeader>Envelope</SectionHeader>
        <div className="grid grid-cols-3 gap-2">
          <SettingTile
            label="Attack"
            value={formatMs(settings.attackMs)}
            unit="ms"
          />
          <SettingTile
            label="Release"
            value={formatMs(settings.releaseMs)}
            unit="ms"
          />
          <SettingTile
            label="Knee"
            value={settings.kneeDb.toString()}
            unit="dB"
          />
        </div>
      </section>

      {/* Why these settings — Day 18 will template this with the
          measured numbers; for now we surface the prior + goal notes
          verbatim plus a short context line about the crest adjustment. */}
      <details className="group pt-3 border-t border-surface-800">
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden text-gray-500 text-xs font-medium hover:text-gray-400 transition-colors flex items-center gap-1.5">
          <span className="inline-block transition-transform group-open:rotate-90">
            ›
          </span>
          Why these settings
        </summary>
        <div className="mt-3 space-y-2.5 text-xs text-gray-400 leading-relaxed">
          <p>{rec.prior.notes}</p>
          <p>{rec.genre.notes}</p>
          <p>{rec.goal.notes}</p>
          <p className="text-gray-600">
            Targeting ~{adjustments.targetPeakGrDb} dB gain reduction at peak.
            Ratio nudged by crest factor{" "}
            {crestSign}
            {adjustments.crestDeviationDb.toFixed(1)} dB from the instrument&apos;s
            typical range.
          </p>
        </div>
      </details>
    </div>
  );
}
