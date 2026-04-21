import {
  MSG_BROWSER_NO_WEB_AUDIO,
  MSG_UPLOAD_FAILED,
} from "@/lib/userFacingMessages";

let cachedContext: AudioContext | null = null;

/**
 * Target sample rate for all analysis. 44.1kHz is the industry standard
 * for music, and locking to a known rate means:
 *   1. audioBuffer.sampleRate is predictable across OSes (Windows defaults
 *      to 48kHz, macOS usually 44.1kHz, etc. — without this override users
 *      on different systems would see different numbers)
 *   2. Spectral feature calculations (Day 10+) produce comparable results
 *      regardless of the source file's original sample rate
 *
 * decodeAudioData() resamples the incoming file to this rate automatically.
 */
const ANALYSIS_SAMPLE_RATE = 44100;

/**
 * Returns a singleton AudioContext. Lazily creates it on first call
 * because AudioContext can only be created in the browser (not SSR).
 */
export function getAudioContext(): AudioContext {
  if (typeof window === "undefined") {
    throw new Error("getAudioContext called on the server");
  }

  if (!cachedContext) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (typeof Ctor !== "function") {
      throw new Error(MSG_BROWSER_NO_WEB_AUDIO);
    }

    // Some browsers refuse a requested rate that's far from the system rate.
    // Fall back to the default context if construction fails.
    try {
      cachedContext = new Ctor({ sampleRate: ANALYSIS_SAMPLE_RATE });
    } catch {
      try {
        cachedContext = new Ctor();
      } catch {
        throw new Error(MSG_BROWSER_NO_WEB_AUDIO);
      }
    }
  }

  return cachedContext;
}

/**
 * Resumes the AudioContext if it's suspended. Browsers suspend audio
 * until the first user interaction. Must be called from a click handler.
 */
export async function unlockAudioContext(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
}

/**
 * Decodes a File into an AudioBuffer that can be played or analyzed.
 * Throws a user-friendly error if the file is corrupt or unsupported.
 */
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch {
    throw new Error(MSG_UPLOAD_FAILED);
  }

  await unlockAudioContext().catch(() => {});

  const ctx = getAudioContext();

  try {
    return await ctx.decodeAudioData(arrayBuffer);
  } catch {
    throw new Error(MSG_UPLOAD_FAILED);
  }
}

/**
 * Formats seconds as M:SS for display (e.g. 1:23, 0:07).
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}