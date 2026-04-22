"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AudioAnalysisResult } from "@/lib/audioAnalysis";
import type { CompressionSettings } from "@/lib/calibration";
import {
  GENRE_OPTIONS,
  GOAL_OPTIONS,
  INSTRUMENT_OPTIONS,
  type CompressionGoal,
  type Genre,
  type InstrumentType,
} from "@/lib/types";
import { recommendCompression } from "@/lib/recommendationEngine";
import { computeDeltas } from "@/lib/delta";
import { kneeCharacterTitle } from "@/lib/knee";

type Props = {
  analysis: AudioAnalysisResult;
  instrument: InstrumentType;
  genre: Genre;
  goal: CompressionGoal;
  /** Full: rationale, deltas, and copy. Limited: core tiles + short summary. */
  fullContent: boolean;
};

/**
 * Transient label state for the Copy button. `idle` is the resting
 * state; `copied` / `failed` flash for ~2s after an action. Kept as a
 * three-valued union instead of a boolean so a failure doesn't collapse
 * into the same visual as a success.
 */
type CopyStatus = "idle" | "copied" | "failed";
const COPY_FLASH_MS = 2000;

// ─── Hook utilities ───────────────────────────────────────────────
//
// Classic "previous value" pattern. React 19's `react-hooks/refs` rule
// flags ref reads during render — but that's exactly the intent here:
// track the last-committed value so the next frame's delta annotation
// has something to compare against. Suppression is scoped to this hook
// so call sites stay lint-clean and read like plain locals.
function usePrevious<T>(value: T): T | null {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  // eslint-disable-next-line react-hooks/refs
  return ref.current;
}

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

/**
 * Build the plaintext block that lands on the user's clipboard. Same
 * formatters as the on-screen tiles so "copy" and "read" always agree.
 * Listed in the order a typical compressor plugin's signal flow: level
 * thresholds first, then envelope, then makeup trim. Newline-separated
 * and contextful so the block is self-describing when pasted into a
 * notes app, Discord message, or project log.
 */
function formatSettingsForClipboard(
  settings: CompressionSettings,
  instrument: InstrumentType,
  genre: Genre,
  goal: CompressionGoal,
): string {
  const context = `${labelForInstrument(instrument)} / ${labelForGenre(genre)} / ${labelForGoal(goal)}`;
  return [
    `Compression Settings (${context})`,
    `Threshold: ${settings.thresholdDb.toFixed(1)} dB`,
    `Ratio: ${formatRatio(settings.ratio)}`,
    `Attack: ${formatMs(settings.attackMs)} ms`,
    `Release: ${formatMs(settings.releaseMs)} ms`,
    `Knee: ${kneeCharacterTitle(settings.kneeDb)}`,
    `Makeup: ${formatSignedDb(settings.makeupDb)} dB`,
  ].join("\n");
}

// ─── Sub-components ────────────────────────────────────────────────

function SettingTile({
  label,
  value,
  unit,
  character,
  delta,
}: {
  label: string;
  value: string;
  unit?: string;
  /**
   * Optional plain-language qualifier rendered inline with the unit
   * (e.g. "medium" next to a knee of "4 dB"). Kept on the same line as
   * the number so tiles without a character stay the same height as
   * those with one — the row doesn't grow or jitter.
   */
  character?: string;
  delta?: string | null;
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
        {character && (
          <span className="text-gray-500 text-sm font-normal ml-1.5">
            · {character}
          </span>
        )}
      </span>
      {/* Delta row — reserved height with a non-breaking space
          placeholder so tiles don't jitter between renders that have
          deltas and those that don't. aria-hidden when empty so
          screen readers skip the filler. */}
      <span
        className="mt-1.5 text-gray-500 text-[10px] font-medium tabular-nums"
        aria-hidden={delta ? undefined : true}
      >
        {delta ?? "\u00A0"}
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
  fullContent,
}: Props) {
  const rec = useMemo(
    () => recommendCompression(analysis, instrument, genre, goal),
    [analysis, instrument, genre, goal],
  );

  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  // Hold the flash timer across renders so a second click resets the
  // countdown instead of racing two overlapping timeouts. Also cleared
  // on unmount so a post-unmount setState never fires.
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Previous settings snapshot for delta annotations. Also tracks the
  // analysis reference — when the user swaps in a new file the prior
  // settings come from a different source of truth and the delta
  // would be a "change of file", not a "change of selector". Dropping
  // the comparison across a file swap keeps annotations meaningful.
  const prevSettings = usePrevious(rec?.settings ?? null);
  const prevAnalysis = usePrevious(analysis);

  // Engine returns null for silent / unmeasurable input. The warnings
  // banner in AudioProfile already tells the user why; here we just
  // refuse to render nonsense settings.
  if (!rec) return null;

  const { settings, adjustments } = rec;
  const crestSign =
    adjustments.crestDeviationDb >= 0 ? "+" : "";

  // Only annotate deltas when we have a prior snapshot AND the
  // analysis hasn't changed — a new file starts the delta chain
  // over, so the next selector toggle (not the file swap itself) is
  // the first annotated render.
  const deltas =
    fullContent && prevSettings && prevAnalysis === analysis
      ? computeDeltas(settings, prevSettings)
      : null;

  async function handleCopy() {
    if (!rec) return;
    const text = formatSettingsForClipboard(
      rec.settings,
      instrument,
      genre,
      goal,
    );
    // `navigator.clipboard` is undefined in insecure contexts and on
    // some older browsers — guard before awaiting to give a useful
    // failure state instead of an unhandled rejection.
    try {
      if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(text);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
    if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => {
      setCopyStatus("idle");
      copyTimerRef.current = null;
    }, COPY_FLASH_MS);
  }

  const copyLabel =
    copyStatus === "copied"
      ? "Copied"
      : copyStatus === "failed"
        ? "Copy failed"
        : "Copy";

  return (
    <div className="bg-surface-900 border border-surface-700 rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-gray-400 text-sm font-semibold">
            Recommended Settings
          </p>
          {fullContent ? (
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy settings to clipboard"
              aria-live="polite"
              className={`text-[11px] font-medium px-2 py-1 rounded-md border transition-colors tabular-nums ${
                copyStatus === "copied"
                  ? "text-brand-300 border-brand-500/40 bg-brand-500/10"
                  : copyStatus === "failed"
                    ? "text-amber-300 border-amber-500/40 bg-amber-500/10"
                    : "text-gray-400 border-surface-700 hover:text-white hover:border-surface-500 hover:bg-surface-800"
              }`}
            >
              {copyLabel}
            </button>
          ) : (
            <a
              href="#pricing"
              className="text-[11px] font-medium px-2 py-1 rounded-md border border-surface-700 text-gray-500 hover:text-brand-300 hover:border-brand-500/40 transition-colors"
            >
              Copy (locked)
            </a>
          )}
        </div>
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
            delta={deltas?.threshold}
          />
          <SettingTile
            label="Ratio"
            value={formatRatio(settings.ratio)}
            delta={deltas?.ratio}
          />
          <SettingTile
            label="Makeup"
            value={formatSignedDb(settings.makeupDb)}
            unit="dB"
            delta={deltas?.makeup}
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
            delta={deltas?.attack}
          />
          <SettingTile
            label="Release"
            value={formatMs(settings.releaseMs)}
            unit="ms"
            delta={deltas?.release}
          />
          <SettingTile
            label="Knee"
            value={kneeCharacterTitle(settings.kneeDb)}
            delta={deltas?.knee}
          />
        </div>
      </section>

      {/* Common mistake — rendered as a prominent amber banner when the
          audio has a characteristic that would make the default advice
          misleading. Null-safe: the generator returns null when no
          caveat applies, and we render nothing in that case. */}
      {rec.explanation.commonMistake && (
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
          <p className="text-amber-200/90 text-xs leading-relaxed min-w-0">
            {rec.explanation.commonMistake}
          </p>
        </div>
      )}

      {!fullContent ? (
        <div className="pt-3 border-t border-surface-800">
          <p className="text-xs text-gray-400 leading-relaxed">
            {rec.explanation.summary}
          </p>
        </div>
      ) : (
        <details className="group pt-3 border-t border-surface-800">
          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden text-gray-500 text-xs font-medium hover:text-gray-400 transition-colors flex items-center gap-1.5">
            <span className="inline-block transition-transform group-open:rotate-90">
              ›
            </span>
            Why these settings
          </summary>
          <div className="mt-3 space-y-2.5 text-xs text-gray-400 leading-relaxed">
            <p>{rec.explanation.summary}</p>
            <p>{rec.explanation.settingsRationale}</p>
            <p className="text-gray-600">
              Targeting ~{adjustments.targetPeakGrDb} dB gain reduction at peak.
              Ratio nudged by crest factor{" "}
              {crestSign}
              {adjustments.crestDeviationDb.toFixed(1)} dB from the
              instrument&apos;s typical range.
            </p>
          </div>
        </details>
      )}
    </div>
  );
}
