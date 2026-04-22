"use client";

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import Button from "./Button";
import AudioUploader from "./AudioUploader";
import AudioPlayer from "./AudioPlayer";
import AudioProfile from "./AudioProfile";
import RecommendationCard from "./RecommendationCard";
import TechniqueCard from "./TechniqueCard";
import PluginTipsCard from "./PluginTipsCard";
import AnalyzingIndicator from "./AnalyzingIndicator";
import SelectorPanel from "./SelectorPanel";
import PricingSection from "./PricingSection";
import BrowserAudioGuard from "./BrowserAudioGuard";
import ReportProblemLink from "./ReportProblemLink";
import { decodeAudioFile } from "@/lib/audioContext";
import { analyzeAudioBuffer, type AudioAnalysisResult } from "@/lib/audioAnalysis";
import { useUrlSelectors } from "@/lib/urlState";
import { useTier } from "@/lib/tier";
import { useAnalysisQuota } from "@/lib/useAnalysisQuota";
import {
  MSG_ANALYSIS_FAILED,
  MSG_UPLOAD_FAILED,
} from "@/lib/userFacingMessages";

type CopyLinkStatus = "idle" | "copied" | "failed";
const COPY_LINK_FLASH_MS = 2000;

function fileQuotaKey(f: File): string {
  return `${f.name}|${f.size}|${f.lastModified}`;
}

/**
 * Two-phase loading state. `decoding` runs while the browser is parsing
 * the compressed audio into an AudioBuffer; `analyzing` runs while the
 * pure-JS feature extractor crunches frames. Splitting them lets the UI
 * show the user which stage is blocking — and lets us yield to the
 * browser in between so the indicator actually paints before the
 * synchronous analysis blocks the main thread.
 */
type LoadingPhase = "decoding" | "analyzing" | null;

export default function Hero() {
  const [file, setFile] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [analysis, setAnalysis] = useState<AudioAnalysisResult | null>(null);
  const [decodingError, setDecodingError] = useState<string | null>(null);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>(null);
  // Incremented by the Retry button on decode failure; included in the
  // decode effect's deps so bumping it re-runs the effect against the
  // same file. Re-decoding is cheap enough that this is simpler than
  // lifting the decode logic into an imperative handler.
  const [decodeAttempt, setDecodeAttempt] = useState(0);
  // Selectors are bound to `window.location.hash` through a custom hook
  // so any state is bookmarkable and shareable. The hook wraps
  // useSyncExternalStore — React 19 lint rules steer us off the
  // "setState inside useEffect" shape, and the hook also handles SSR
  // hydration without a mismatch warning (server snapshot = defaults,
  // client snapshot reads the real hash after hydration).
  const [selectors, setSelectors] = useUrlSelectors();
  const [copyLinkStatus, setCopyLinkStatus] = useState<CopyLinkStatus>("idle");
  const { paidUnlocked, markPaidUnlocked, sessionStatus, userId } = useTier();
  const { quota, canStartNewAnalysis, recordAfterSuccess } =
    useAnalysisQuota(paidUnlocked);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  /** Free-tier quota counts only after settings are unlockable; at most once per upload. */
  const quotaRecordedFileKeyRef = useRef<string | null>(null);

  /** Full recommendation + technique for paid, or free until daily cap (including last in-session result after cap). */
  const freeContentUnlocked = useMemo(() => {
    if (paidUnlocked) return true;
    if (canStartNewAnalysis) return true;
    if (analysis && (quota.status === "loading" || quota.status === "error")) {
      return true;
    }
    if (!analysis) return false;
    if (quota.status === "loading") return true;
    if (quota.status !== "ready") return false;
    return !paidUnlocked && !canStartNewAnalysis && quota.used > 0;
  }, [paidUnlocked, canStartNewAnalysis, quota, analysis]);

  const showPricingSection =
    !paidUnlocked &&
    quota.status === "ready" &&
    !canStartNewAnalysis;

  // ─── Copy-link button ────────────────────────────────────────────
  //
  // Same flash pattern as the RecommendationCard's Copy Settings button,
  // scoped to this component so the two states don't cross-contaminate.
  const copyLinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (copyLinkTimerRef.current !== null) clearTimeout(copyLinkTimerRef.current);
    };
  }, []);

  const handleCopyLink = useCallback(async () => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(window.location.href);
      setCopyLinkStatus("copied");
    } catch {
      setCopyLinkStatus("failed");
    }
    if (copyLinkTimerRef.current !== null) clearTimeout(copyLinkTimerRef.current);
    copyLinkTimerRef.current = setTimeout(() => {
      setCopyLinkStatus("idle");
      copyLinkTimerRef.current = null;
    }, COPY_LINK_FLASH_MS);
  }, []);

  const copyLinkLabel =
    copyLinkStatus === "copied"
      ? "Link copied"
      : copyLinkStatus === "failed"
        ? "Could not copy (try the address bar)"
        : "Copy share link";

  const recordFreeTierIfNeeded = useCallback(
    async (f: File) => {
      if (paidUnlocked) return;
      const key = fileQuotaKey(f);
      if (quotaRecordedFileKeyRef.current === key) return;
      quotaRecordedFileKeyRef.current = key;
      await recordAfterSuccess();
    },
    [paidUnlocked, recordAfterSuccess],
  );

  useEffect(() => {
    // When file is cleared, handleRemove owns the reset — nothing to do here.
    if (!file) return;

    const controller = new AbortController();
    const decodeStart = performance.now();

    decodeAudioFile(file)
      .then(async (buffer) => {
        if (controller.signal.aborted) return;
        const decodeMs = performance.now() - decodeStart;

        setAudioBuffer(buffer);
        setLoadingPhase("analyzing");

        // Yield to the browser so React commits the "analyzing" state
        // and the indicator animation paints before analyzeAudioBuffer
        // blocks the main thread. A single rAF tick is enough; setTimeout
        // is used because rAF can be throttled on background tabs.
        await new Promise<void>((resolve) => setTimeout(resolve, 16));
        if (controller.signal.aborted) return;

        let result: AudioAnalysisResult;
        try {
          const analyzeStart = performance.now();
          result = analyzeAudioBuffer(buffer);
          const analyzeMs = performance.now() - analyzeStart;
          console.log(
            `[analysis] decode ${decodeMs.toFixed(0)}ms · analyze ${analyzeMs.toFixed(0)}ms · ${buffer.duration.toFixed(1)}s @ ${buffer.sampleRate}Hz`,
          );
        } catch (analyzeErr) {
          console.error("[analysis] analyzeAudioBuffer failed", analyzeErr);
          if (controller.signal.aborted) return;
          setDecodingError(MSG_ANALYSIS_FAILED);
          setAudioBuffer(null);
          setLoadingPhase(null);
          return;
        }

        if (controller.signal.aborted) return;
        setAnalysis(result);
        setLoadingPhase(null);
        if (!paidUnlocked) {
          await recordFreeTierIfNeeded(file);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        const msg =
          err instanceof Error && err.message ? err.message : MSG_UPLOAD_FAILED;
        setDecodingError(msg);
        setLoadingPhase(null);
      });

    return () => {
      controller.abort();
    };
  }, [file, decodeAttempt, paidUnlocked, recordFreeTierIfNeeded]);

  const handleRetryDecode = () => {
    // Clear state that belongs to the failed attempt, then bump the
    // attempt counter so the effect re-runs. Resetting audioBuffer /
    // analysis is defensive — at the point the error banner shows they
    // should already be null, but this makes the retry idempotent even
    // if a caller expanded the state machine later.
    setDecodingError(null);
    setAudioBuffer(null);
    setAnalysis(null);
    setLoadingPhase("decoding");
    setDecodeAttempt((n) => n + 1);
  };

  const handleFileSelected = (newFile: File) => {
    setQuotaError(null);
    if (!paidUnlocked && !canStartNewAnalysis) {
      setQuotaError(
        "You've used all 3 free analyses today. Upgrade for unlimited analyses, or try again tomorrow.",
      );
      return;
    }
    // All synchronous state transitions for "new file" happen here
    // so the effect stays clean (see react-hooks/set-state-in-effect).
    quotaRecordedFileKeyRef.current = null;
    setAudioBuffer(null);
    setAnalysis(null);
    setDecodingError(null);
    setLoadingPhase("decoding");
    setFile(newFile);
  };

  const handleRemove = () => {
    quotaRecordedFileKeyRef.current = null;
    setFile(null);
    setAudioBuffer(null);
    setAnalysis(null);
    setDecodingError(null);
    setLoadingPhase(null);
    setQuotaError(null);
  };

  // Re-runs analysis against the already-decoded buffer. Skips the
  // decode cost entirely — useful for iterating on classifiers without
  // reloading the file, and as a recovery path if analysis ever needs
  // to be re-attempted (e.g. after changing selector state that might
  // parametrise analysis in the future).
  const handleReanalyze = useCallback(() => {
    if (!audioBuffer) return;
    setAnalysis(null);
    setLoadingPhase("analyzing");

    // Same yield pattern as the effect so the indicator paints first.
    setTimeout(() => {
      try {
        const analyzeStart = performance.now();
        const result = analyzeAudioBuffer(audioBuffer);
        console.log(
          `[analysis] re-analyze ${(performance.now() - analyzeStart).toFixed(0)}ms`,
        );
        setAnalysis(result);
        setLoadingPhase(null);
      } catch (e) {
        console.error("[analysis] re-analyze failed", e);
        setDecodingError(MSG_ANALYSIS_FAILED);
        setLoadingPhase(null);
      }
    }, 16);
  }, [audioBuffer]);

  return (
    <section
      id="analyzer-tool"
      className="relative overflow-hidden border-t border-surface-800/80 scroll-mt-28"
      aria-labelledby="analyzer-intro-heading"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-brand-500/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] max-w-[90vw] bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

      <BrowserAudioGuard>
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-12 sm:pt-14 pb-12 sm:pb-16 text-center">
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-2">
          The analyzer
        </p>
        <h2
          id="analyzer-intro-heading"
          className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight"
        >
          Upload a clip, get settings in seconds
        </h2>
        <p className="text-gray-500 text-sm sm:text-base max-w-xl mx-auto leading-relaxed mb-2">
          Pick instrument, genre, and goal, then drop your file. Analysis runs in
          your browser.
        </p>
        <p className="text-gray-600 text-xs sm:text-sm mb-8 sm:mb-10">
          {paidUnlocked
            ? "Unlimited: all instruments, full access"
            : "Free: full features, 3 analyses per day (UTC)"}
        </p>

        {/* Analysis setup selectors */}
        <SelectorPanel
          value={selectors}
          onChange={setSelectors}
          hasFullAccess={freeContentUnlocked}
        />

        {!paidUnlocked && quota.status === "error" && (
          <div
            className="text-amber-200/90 text-xs mb-4 max-w-2xl mx-auto px-1 leading-relaxed space-y-2"
            role="alert"
          >
            <p>{quota.message}</p>
            <ReportProblemLink className="text-xs text-amber-300/90" />
          </div>
        )}

        {freeContentUnlocked && (
          <div className="max-w-2xl mx-auto mb-6 flex justify-end px-1">
            <button
              type="button"
              onClick={handleCopyLink}
              aria-label="Copy a shareable link to this setup"
              aria-live="polite"
              className={`text-[11px] font-medium px-2 py-1 rounded-md border transition-colors ${
                copyLinkStatus === "copied"
                  ? "text-brand-300 border-brand-500/40 bg-brand-500/10"
                  : copyLinkStatus === "failed"
                    ? "text-amber-300 border-amber-500/40 bg-amber-500/10"
                    : "text-gray-500 border-surface-700 hover:text-white hover:border-surface-500 hover:bg-surface-800"
              }`}
            >
              {copyLinkLabel}
            </button>
          </div>
        )}

        {/* Upload zone */}
        <div
          id="upload-zone"
          className="bg-surface-800 border border-surface-700 rounded-2xl p-4 sm:p-6 max-w-2xl mx-auto shadow-2xl text-left"
        >
          {!file ? (
            <div>
              <AudioUploader onFileSelected={handleFileSelected} />
              {quotaError && (
                <div
                  className="mt-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-200 text-sm leading-relaxed"
                  role="alert"
                >
                  {quotaError}
                </div>
              )}
              {quotaError && showPricingSection && (
                <div className="mt-6">
                  <PricingSection
                    onUnlock={markPaidUnlocked}
                    sessionStatus={sessionStatus}
                    sessionUserId={userId}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {loadingPhase === "decoding" && (
                <AnalyzingIndicator label="Decoding audio…" className="px-1" />
              )}
              {loadingPhase === "analyzing" && (
                <AnalyzingIndicator label="Analyzing audio…" className="px-1" />
              )}

              {decodingError && (
                <div className="px-3 py-3 rounded-lg bg-red-500/10 border border-red-500/20 space-y-2">
                  <div className="flex items-start gap-3">
                    <p className="text-red-400 text-sm leading-relaxed flex-1 min-w-0">
                      {decodingError}
                    </p>
                    <button
                      type="button"
                      onClick={handleRetryDecode}
                      className="shrink-0 text-red-300 hover:text-white border border-red-500/30 hover:border-red-400 hover:bg-red-500/20 rounded-md px-2 py-1 text-xs font-medium transition-colors"
                    >
                      Try again
                    </button>
                  </div>
                  <div className="flex justify-end sm:justify-center pt-0.5">
                    <ReportProblemLink className="text-xs text-red-300/90" />
                  </div>
                </div>
              )}

              {audioBuffer && (
                <AudioPlayer file={file} fileName={file.name} />
              )}

              {analysis && <AudioProfile analysis={analysis} />}

              {analysis && (
                <RecommendationCard
                  analysis={analysis}
                  instrument={selectors.instrument}
                  genre={selectors.genre}
                  goal={selectors.goal}
                  fullContent={freeContentUnlocked}
                />
              )}

              {analysis && showPricingSection && (
                <PricingSection
                  onUnlock={markPaidUnlocked}
                  sessionStatus={sessionStatus}
                  sessionUserId={userId}
                />
              )}

              {analysis && freeContentUnlocked && (
                <TechniqueCard
                  analysis={analysis}
                  instrument={selectors.instrument}
                />
              )}
              {analysis && freeContentUnlocked && (
                <PluginTipsCard />
              )}

              <div className="flex items-center justify-between px-1">
                <p className="text-gray-500 text-xs">
                  {(file.size / 1024 / 1024).toFixed(1)} MB · {file.type || "audio"}
                </p>
                <div className="flex items-center gap-2">
                  {analysis && loadingPhase === null && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleReanalyze}
                    >
                      Re-analyze
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={handleRemove}>
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </BrowserAudioGuard>
    </section>
  );
}
