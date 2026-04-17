"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { getAudioContext, unlockAudioContext } from "@/lib/audioContext";

type PlayerState = {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
  play: () => Promise<void>;
  pause: () => void;
  seek: (seconds: number) => void;
};

export function useAudioPlayer(audioBuffer: AudioBuffer | null): PlayerState {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startContextTimeRef = useRef(0); // AudioContext.currentTime when playback started
  const offsetRef = useRef(0);            // where in the buffer we're resuming from
  const rafRef = useRef<number | null>(null);

  const duration = audioBuffer?.duration ?? 0;

  const stopCurrentSource = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.onended = null; // prevent the ended callback from firing
      try {
        sourceRef.current.stop();
      } catch {
        // already stopped — ignore
      }
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
  }, []);

  const play = useCallback(async () => {
    if (!audioBuffer) return;

    try {
      await unlockAudioContext();
      const ctx = getAudioContext();

      // clean up any existing source before starting a new one
      stopCurrentSource();

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      // start from the offset stored when we paused (or 0 if fresh)
      source.start(0, offsetRef.current);
      startContextTimeRef.current = ctx.currentTime - offsetRef.current;

      source.onended = () => {
        // only fire if this is still the active source
        if (sourceRef.current === source) {
          offsetRef.current = 0;
          setCurrentTime(0);
          setIsPlaying(false);
          sourceRef.current = null;
        }
      };

      sourceRef.current = source;
      setIsPlaying(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to play audio");
      setIsPlaying(false);
    }
  }, [audioBuffer, stopCurrentSource]);

  const pause = useCallback(() => {
    if (!sourceRef.current) return;
    const ctx = getAudioContext();
    // compute where we are in the buffer and remember it for resume
    offsetRef.current = ctx.currentTime - startContextTimeRef.current;
    stopCurrentSource();
    setIsPlaying(false);
  }, [stopCurrentSource]);

  const seek = useCallback(
    (seconds: number) => {
      if (!audioBuffer) return;
      const clamped = Math.max(0, Math.min(seconds, audioBuffer.duration));
      const wasPlaying = isPlaying;
      stopCurrentSource();
      offsetRef.current = clamped;
      setCurrentTime(clamped);
      setIsPlaying(false);
      if (wasPlaying) {
        play();
      }
    },
    [audioBuffer, isPlaying, play, stopCurrentSource]
  );

  // drive the currentTime display while playing
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const ctx = getAudioContext();
    const tick = () => {
      const next = ctx.currentTime - startContextTimeRef.current;
      setCurrentTime(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying]);

  // reset everything when a new buffer is loaded
  useEffect(() => {
    stopCurrentSource();
    offsetRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(false);
    setError(null);
  }, [audioBuffer, stopCurrentSource]);

  // clean up on unmount
  useEffect(() => {
    return () => {
      stopCurrentSource();
    };
  }, [stopCurrentSource]);

  return { isPlaying, currentTime, duration, error, play, pause, seek };
}