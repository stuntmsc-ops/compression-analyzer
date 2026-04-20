"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Button from "./Button";
import AudioUploader from "./AudioUploader";
import AudioPlayer from "./AudioPlayer";
import AudioProfile from "./AudioProfile";
import RecommendationCard from "./RecommendationCard";
import TechniqueCard from "./TechniqueCard";
import AnalyzingIndicator from "./AnalyzingIndicator";
import SelectorPanel from "./SelectorPanel";
import EmailGate from "./EmailGate";
import { decodeAudioFile } from "@/lib/audioContext";
import { analyzeAudioBuffer, type AudioAnalysisResult } from "@/lib/audioAnalysis";
import { useUrlSelectors } from "@/lib/urlState";
import { useEmailGate } from "@/lib/emailGate";

type CopyLinkStatus = "idle" | "copied" | "failed";
const COPY_LINK_FLASH_MS = 2000;

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
  // Email-gate state lives in localStorage so a returning visitor isn't
  // re-prompted every time they upload a new file. `emailSubmitted`
  // drives whether the settings + technique cards render or the gate
  // stands in their place; `markEmailSubmitted` is called from the
  // EmailGate's success callback.
  const [emailSubmitted, markEmailSubmitted] = useEmailGate();

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
        ? "Copy failed"
        : "Copy share link";

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

        const analyzeStart = performance.now();
        const result = analyzeAudioBuffer(buffer);
        const analyzeMs = performance.now() - analyzeStart;

        // Instrumentation — keeps Day 13's <3s goal measurable. Always
        // logs so manual testing with different clip lengths is trivial.
        console.log(
          `[analysis] decode ${decodeMs.toFixed(0)}ms · analyze ${analyzeMs.toFixed(0)}ms · ${buffer.duration.toFixed(1)}s @ ${buffer.sampleRate}Hz`,
        );

        if (controller.signal.aborted) return;
        setAnalysis(result);
        setLoadingPhase(null);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setDecodingError(err instanceof Error ? err.message : "Decoding failed");
        setLoadingPhase(null);
      });

    return () => {
      controller.abort();
    };
  }, [file, decodeAttempt]);

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
    // All synchronous state transitions for "new file" happen here
    // so the effect stays clean (see react-hooks/set-state-in-effect).
    setAudioBuffer(null);
    setAnalysis(null);
    setDecodingError(null);
    setLoadingPhase("decoding");
    setFile(newFile);
  };

  const handleRemove = () => {
    setFile(null);
    setAudioBuffer(null);
    setAnalysis(null);
    setDecodingError(null);
    setLoadingPhase(null);
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
      const analyzeStart = performance.now();
      const result = analyzeAudioBuffer(audioBuffer);
      console.log(
        `[analysis] re-analyze ${(performance.now() - analyzeStart).toFixed(0)}ms`,
      );
      setAnalysis(result);
      setLoadingPhase(null);
    }, 16);
  }, [audioBuffer]);

  const scrollToUpload = () => {
    document.getElementById("upload-zone")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-brand-500/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12 sm:pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 rounded-full px-4 py-1.5 mb-6 sm:mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-400"></span>
          </span>
          <span className="text-brand-400 text-xs sm:text-sm font-medium">
            Audio-Powered Compression Settings
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-5 sm:mb-6 leading-[1.1] tracking-tight">
          Stop Guessing Your
          <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
            {" "}Compression Settings
          </span>
        </h1>

        <p className="text-gray-400 text-base sm:text-lg mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed">
          Upload your audio and get personalized compression settings based on
          the actual dynamics of your sound — not generic numbers from a chart.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
          <Button size="lg" onClick={scrollToUpload}>
            Analyze Your Audio
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </Button>
          <p className="text-gray-600 text-xs sm:text-sm">
            No signup to try · Free for vocals
          </p>
        </div>

        {/* Analysis setup selectors */}
        <SelectorPanel value={selectors} onChange={setSelectors} />

        {/* Share-link action — copies the current URL with selector state
            encoded in the hash. Lives outside SelectorPanel so that
            component's API stays focused on value/onChange. */}
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

        {/* Upload zone */}
        <div
          id="upload-zone"
          className="bg-surface-800 border border-surface-700 rounded-2xl p-4 sm:p-6 max-w-2xl mx-auto shadow-2xl text-left"
        >
          {!file ? (
            <AudioUploader onFileSelected={handleFileSelected} />
          ) : (
            <div className="space-y-4">
              {loadingPhase === "decoding" && (
                <AnalyzingIndicator label="Decoding audio…" className="px-1" />
              )}
              {loadingPhase === "analyzing" && (
                <AnalyzingIndicator label="Analyzing audio…" className="px-1" />
              )}

              {decodingError && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3">
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
              )}

              {audioBuffer && (
                <AudioPlayer file={file} fileName={file.name} />
              )}

              {analysis && <AudioProfile analysis={analysis} />}

              {/* Email gate — stands in for the payoff cards
                  (RecommendationCard + TechniqueCard) until the user
                  hands over an email. AudioPlayer and AudioProfile
                  stay visible above so the user can see the tool
                  measured their file before being asked to subscribe —
                  no "wall of text then gate" surprise. */}
              {analysis && !emailSubmitted && (
                <EmailGate onSubmitted={markEmailSubmitted} />
              )}

              {analysis && emailSubmitted && (
                <RecommendationCard
                  analysis={analysis}
                  instrument={selectors.instrument}
                  genre={selectors.genre}
                  goal={selectors.goal}
                />
              )}

              {/* Technique recommendation — compression *approach*
                  (serial / parallel / bus / standard) derived from the
                  analysis + instrument. Rendered below the settings
                  card so the user sees the knob positions first, then
                  the how-to-apply-them guidance. */}
              {analysis && emailSubmitted && (
                <TechniqueCard
                  analysis={analysis}
                  instrument={selectors.instrument}
                />
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
    </section>
  );
}
