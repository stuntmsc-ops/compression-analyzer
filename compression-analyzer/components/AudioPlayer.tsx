"use client";

import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { formatTime } from "@/lib/audioContext";

type AudioPlayerProps = {
  audioBuffer: AudioBuffer | null;
  fileName: string;
};

export default function AudioPlayer({ audioBuffer, fileName }: AudioPlayerProps) {
  const { isPlaying, currentTime, duration, error, play, pause, seek } =
    useAudioPlayer(audioBuffer);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(clickX / rect.width, 1));
    seek(ratio * duration);
  };

  if (!audioBuffer) return null;

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl p-4 sm:p-5">
      {error && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-4">
        {/* Play/Pause button */}
        <button
          onClick={isPlaying ? pause : play}
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
          className="shrink-0 w-12 h-12 rounded-full bg-brand-500 hover:bg-brand-600 active:bg-brand-700 flex items-center justify-center transition-colors shadow-lg shadow-brand-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-800"
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

        {/* Track info + progress */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-white text-sm font-medium truncate">{fileName}</p>
            <p className="text-gray-500 text-xs shrink-0 font-mono tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </p>
          </div>

          <div
            onClick={handleProgressClick}
            className="group relative h-2 bg-surface-600 rounded-full cursor-pointer overflow-hidden"
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={currentTime}
          >
            <div
              className="absolute left-0 top-0 h-full bg-brand-500 group-hover:bg-brand-400 transition-colors"
              style={{ width: `${progressPercent}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
              style={{ left: `calc(${progressPercent}% - 6px)` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}