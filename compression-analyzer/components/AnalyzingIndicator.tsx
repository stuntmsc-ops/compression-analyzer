"use client";

/**
 * Loading indicator shown during audio decode / analysis. Five vertical
 * bars scale on the Y axis with staggered animation delays so each bar
 * appears to pulse independently — visually a miniature level meter,
 * which fits the audio context better than a generic spinner.
 *
 * The keyframe `bars` is defined in app/globals.css under @theme as
 * --animate-bars; Tailwind 4 exposes it as the `animate-bars` utility.
 */

type Props = {
  /** Short status text shown next to the bars. */
  label: string;
  className?: string;
};

// Five bars at different resting heights give the cluster a fuller
// silhouette even between pulses. The delays are tuned to feel organic
// rather than perfectly synchronised.
const BARS: ReadonlyArray<{ height: string; delay: string }> = [
  { height: "60%", delay: "0ms" },
  { height: "100%", delay: "120ms" },
  { height: "75%", delay: "240ms" },
  { height: "90%", delay: "360ms" },
  { height: "55%", delay: "480ms" },
];

export default function AnalyzingIndicator({ label, className = "" }: Props) {
  return (
    <div
      className={`flex items-center gap-3 text-gray-300 text-sm ${className}`}
      role="status"
      aria-live="polite"
    >
      <div
        className="flex items-end gap-1 h-5 w-8"
        aria-hidden="true"
      >
        {BARS.map((bar, i) => (
          <span
            key={i}
            className="flex-1 bg-brand-400 rounded-sm origin-bottom animate-bars"
            style={{
              height: bar.height,
              animationDelay: bar.delay,
            }}
          />
        ))}
      </div>
      <span>{label}</span>
    </div>
  );
}
