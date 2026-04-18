"use client";

import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { formatTime } from "@/lib/audioContext";

type AudioPlayerProps = {
  file: File;
  fileName: string;
};

export default function AudioPlayer({ file, fileName }: AudioPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize wavesurfer whenever the file changes
  useEffect(() => {
    if (!containerRef.current) return;

    setIsReady(false);
    setError(null);
    setCurrentTime(0);
    setIsPlaying(false);

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#3f3f46",      // surface-500
      progressColor: "#3b82f6",  // brand-500
      cursorColor: "#60a5fa",    // brand-400
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 72,
      normalize: true,
      interact: true,
      dragToSeek: true,
    });

    wavesurferRef.current = ws;

    // AbortError fires when the wavesurfer instance is destroyed mid-load
    // (common in React Strict Mode dev double-invoke). Not a real error.
    const isAbortError = (err: unknown): boolean => {
      if (!(err instanceof Error)) return false;
      return (
        err.name === "AbortError" ||
        err.message.toLowerCase().includes("abort")
      );
    };

    const objectUrl = URL.createObjectURL(file);
    ws.load(objectUrl).catch((err) => {
      if (isAbortError(err)) return;
      setError(err instanceof Error ? err.message : "Failed to load waveform");
    });

    const unsubscribers = [
      ws.on("ready", () => {
        setIsReady(true);
        setDuration(ws.getDuration());
      }),
      ws.on("play", () => setIsPlaying(true)),
      ws.on("pause", () => setIsPlaying(false)),
      ws.on("finish", () => {
        setIsPlaying(false);
        ws.seekTo(0);
        setCurrentTime(0);
      }),
      ws.on("timeupdate", (time) => setCurrentTime(time)),
      ws.on("error", (e) => {
        if (isAbortError(e)) return;
        setError(e instanceof Error ? e.message : String(e));
      }),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
      ws.destroy();
      wavesurferRef.current = null;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  const handlePlayPause = () => {
    wavesurferRef.current?.playPause();
  };

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl p-4 sm:p-5">
      {error && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-white text-sm font-medium truncate">{fileName}</p>
        <p className="text-gray-500 text-xs shrink-0 font-mono tabular-nums">
          {formatTime(currentTime)} / {formatTime(duration)}
        </p>
      </div>

      {/* Waveform container */}
      <div className="relative mb-4">
        <div ref={containerRef} className="w-full" />

        {!isReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-800/80 rounded-md">
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span>Loading waveform…</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handlePlayPause}
          disabled={!isReady}
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
          className="shrink-0 w-12 h-12 rounded-full bg-brand-500 hover:bg-brand-600 active:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors shadow-lg shadow-brand-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-800"
        >
          {isPlaying ? (
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <p className="text-gray-500 text-xs hidden sm:block">
          {isReady ? "Drag the waveform to scrub" : "Preparing audio…"}
        </p>
      </div>
    </div>
  );
}
