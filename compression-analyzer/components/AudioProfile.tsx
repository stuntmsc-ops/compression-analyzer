"use client";

import type { AudioAnalysisResult } from "@/lib/audioAnalysis";
import {
  type Tag,
  classifyRmsDb,
  classifyPeakDb,
  classifyCrestDb,
  classifyDynamicRangeDb,
  classifyConsistencyPct,
  classifyCentroidHz,
} from "@/lib/classifiers";
import LoudnessChart from "./LoudnessChart";

type Props = { analysis: AudioAnalysisResult };

// ─── Formatting helpers ────────────────────────────────────────────

function formatDb(db: number): string {
  return Number.isFinite(db) ? db.toFixed(1) : "−∞";
}

function formatHz(hz: number): string {
  if (hz >= 1000) return `${(hz / 1000).toFixed(1)} kHz`;
  return `${Math.round(hz)} Hz`;
}

// ─── Series-derived stats ──────────────────────────────────────────

/**
 * Percentile-based spread, consistency, and median computed in a
 * single pass over a sorted copy of the finite windows. Returns null
 * when there aren't enough non-silent windows to be meaningful.
 */
function seriesStats(rmsDb: readonly number[]) {
  const finite: number[] = [];
  for (const v of rmsDb) if (Number.isFinite(v)) finite.push(v);
  if (finite.length < 10) return null;

  const sorted = finite.slice().sort((a, b) => a - b);
  const pick = (p: number) =>
    sorted[Math.floor((p / 100) * (sorted.length - 1))];
  const median = sorted[Math.floor(sorted.length / 2)];

  // Consistency: fraction of windows within ±3 dB of the median.
  // Intuitive framing for a producer — "how much of the audio
  // sounds at a consistent level" — and naturally insensitive to
  // edge silence because the median is robust to outliers.
  let within = 0;
  for (const v of finite) if (Math.abs(v - median) <= 3) within++;

  return {
    dynamicRangeDb: pick(90) - pick(10),
    consistencyPct: (within / finite.length) * 100,
    medianDb: median,
  };
}

// ─── Warnings ──────────────────────────────────────────────────────

/**
 * Turn the analysis qualityFlags into human-readable sentences. Each
 * entry is the text shown in the warning banner; ordering is by how
 * much the flag undermines the rest of the card — a silent file makes
 * everything below it meaningless, so it comes first.
 */
function warningMessages(flags: AudioAnalysisResult["qualityFlags"]): string[] {
  const messages: string[] = [];
  if (flags.silent) {
    messages.push(
      "Signal is essentially silent. Measurements below are unlikely to be meaningful.",
    );
  }
  if (flags.tooShort) {
    messages.push(
      "Clip is shorter than 1 second. Dynamic behaviour may not be representative of a full take.",
    );
  }
  if (flags.clipping) {
    messages.push(
      "Peak sits at digital full scale. The source may be clipped — true peak and crest factor will read lower than the original.",
    );
  }
  return messages;
}

function WarningsBanner({ flags }: { flags: AudioAnalysisResult["qualityFlags"] }) {
  const messages = warningMessages(flags);
  if (messages.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 flex gap-2.5 items-start">
      <svg
        className="w-4 h-4 text-amber-400 shrink-0 mt-0.5"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
      <ul className="text-amber-200/90 text-xs leading-relaxed space-y-1 min-w-0">
        {messages.map((m, i) => (
          <li key={i}>{m}</li>
        ))}
      </ul>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function InlineTag({ tag }: { tag: Tag }) {
  return (
    <span className="text-gray-400 text-xs">
      <span className="text-gray-300 font-medium">{tag.label}</span>
      <span className="text-gray-500"> — {tag.description}</span>
    </span>
  );
}

function PrimaryStat({
  label,
  value,
  unit,
  tag,
}: {
  label: string;
  value: string;
  unit: string;
  tag: Tag;
}) {
  return (
    <div className="flex flex-col bg-surface-800 border border-surface-700 rounded-lg px-3 py-2.5">
      <span className="text-gray-500 text-[10px] uppercase tracking-widest font-semibold">
        {label}
      </span>
      <span className="mt-1.5 text-white text-xl font-semibold tabular-nums leading-none">
        {value}
        <span className="text-gray-500 text-sm font-normal ml-1">{unit}</span>
      </span>
      <span className="mt-2 text-xs leading-snug">
        <span className="text-gray-300 font-medium">{tag.label}</span>
        <span className="text-gray-500"> — {tag.description}</span>
      </span>
    </div>
  );
}

function Row({
  label,
  value,
  tag,
}: {
  label: string;
  value: string;
  tag?: Tag;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm border-b border-surface-800 last:border-b-0">
      <span className="text-gray-400 shrink-0 pt-0.5">{label}</span>
      <span className="flex flex-wrap items-baseline justify-end gap-x-3 gap-y-0.5 text-right min-w-0">
        <span className="text-white tabular-nums shrink-0">{value}</span>
        {tag && <InlineTag tag={tag} />}
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

export default function AudioProfile({ analysis }: Props) {
  const stats = seriesStats(analysis.loudnessOverTime.rmsDb);

  return (
    <div className="bg-surface-900 border border-surface-700 rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-400 text-sm font-semibold">Audio Profile</p>
        <span className="text-gray-600 text-xs tabular-nums">
          {analysis.duration.toFixed(2)} s
        </span>
      </div>

      <WarningsBanner flags={analysis.qualityFlags} />

      {/* Level */}
      <section className="mb-5">
        <SectionHeader>Level</SectionHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <PrimaryStat
            label="RMS"
            value={formatDb(analysis.rmsDb)}
            unit="dB"
            tag={classifyRmsDb(analysis.rmsDb)}
          />
          <PrimaryStat
            label="Peak"
            value={formatDb(analysis.peakDb)}
            unit="dB"
            tag={classifyPeakDb(analysis.peakDb)}
          />
          <PrimaryStat
            label="Crest Factor"
            value={analysis.crestFactorDb.toFixed(1)}
            unit="dB"
            tag={classifyCrestDb(analysis.crestFactorDb)}
          />
        </div>
      </section>

      {/* Dynamics — chart + series-derived rows */}
      <section className="mb-5">
        <SectionHeader>Dynamics</SectionHeader>
        <div className="mb-3 px-0.5">
          <LoudnessChart rmsDb={analysis.loudnessOverTime.rmsDb} />
          <div className="flex justify-between text-[10px] text-gray-600 tabular-nums mt-1">
            <span>0 s</span>
            <span>{analysis.duration.toFixed(1)} s</span>
          </div>
        </div>
        <Row
          label="Dynamic Range"
          value={stats ? `${stats.dynamicRangeDb.toFixed(1)} dB` : "—"}
          tag={stats ? classifyDynamicRangeDb(stats.dynamicRangeDb) : undefined}
        />
        <Row
          label="Consistency"
          value={stats ? `${Math.round(stats.consistencyPct)}%` : "—"}
          tag={stats ? classifyConsistencyPct(stats.consistencyPct) : undefined}
        />
      </section>

      {/* Tonal character */}
      <section className="mb-4">
        <SectionHeader>Tonal character</SectionHeader>
        <Row
          label="Spectral Center"
          value={formatHz(analysis.spectralCentroidHz)}
          tag={classifyCentroidHz(analysis.spectralCentroidHz)}
        />
        <Row
          label="Rolloff (99% energy)"
          value={formatHz(analysis.spectralRolloffHz)}
        />
        <Row
          label="Zero-Crossing Rate"
          value={`${Math.round(analysis.zeroCrossingRate).toLocaleString()} /s`}
        />
      </section>

      {/* Metadata footer */}
      <p className="text-gray-600 text-xs tabular-nums">
        {analysis.numChannels} ch · {(analysis.sampleRate / 1000).toFixed(1)} kHz ·{" "}
        {analysis.loudnessOverTime.rmsDb.length} loudness points @ ~
        {Math.round(analysis.loudnessOverTime.hopSeconds * 1000)} ms · σ{" "}
        {analysis.loudnessOverTime.stdDevDb.toFixed(2)} dB
      </p>
    </div>
  );
}
