let cachedContext: AudioContext | null = null;

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
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    cachedContext = new Ctor();
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
  const ctx = getAudioContext();
  const arrayBuffer = await file.arrayBuffer();

  try {
    return await ctx.decodeAudioData(arrayBuffer);
  } catch {
    throw new Error(
      "We couldn't decode this audio file. It may be corrupted or in an unsupported format. Try a standard WAV or MP3."
    );
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