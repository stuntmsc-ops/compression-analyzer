"use client";

/**
 * Inline SVG line chart of loudness (dB) over time. Fed by the
 * downsampled series in AudioAnalysisResult.loudnessOverTime.rmsDb.
 *
 * A dynamic performance draws peaks and valleys; a heavily limited
 * master draws a near-flat line. That visual contrast is the whole
 * point of Day 11 — it lets a producer see at a glance whether their
 * audio breathes or has been squashed.
 *
 * Design notes:
 *   - Breaks the line into separate M/L segments on −Infinity (silent)
 *     windows so gaps show as actual gaps, not a diagonal dropping to
 *     the bottom edge.
 *   - Uses preserveAspectRatio="none" to stretch across container width,
 *     combined with vector-effect="non-scaling-stroke" so the line
 *     thickness doesn't deform under the stretch.
 *   - y-axis auto-scales to the finite min/max of the series with a
 *     small pad so the line doesn't hug the edges.
 */

type Props = {
  rmsDb: readonly number[];
  className?: string;
};

const VIEW_W = 600;
const VIEW_H = 60;

export default function LoudnessChart({ rmsDb, className = "" }: Props) {
  if (rmsDb.length < 2) {
    return (
      <div
        className={`flex items-center justify-center h-16 text-gray-600 text-xs ${className}`}
      >
        Not enough data to chart
      </div>
    );
  }

  // Find finite bounds for y-axis scaling.
  let minDb = Infinity;
  let maxDb = -Infinity;
  for (const v of rmsDb) {
    if (Number.isFinite(v)) {
      if (v < minDb) minDb = v;
      if (v > maxDb) maxDb = v;
    }
  }

  if (!Number.isFinite(minDb) || !Number.isFinite(maxDb)) {
    return (
      <div
        className={`flex items-center justify-center h-16 text-gray-600 text-xs ${className}`}
      >
        Signal is silent throughout
      </div>
    );
  }

  // Pad the y-range so the line doesn't sit against the top or bottom
  // edge. A tenth of the range on each side is plenty; if the range is
  // zero (flat signal) fall back to ±1 dB so there's something to draw.
  const span = maxDb - minDb;
  const pad = span > 0 ? span * 0.1 : 1;
  const yMin = minDb - pad;
  const yRange = maxDb + pad - yMin;

  const n = rmsDb.length;
  // Single pass builds two paths: the line itself, and a closed area
  // below the line for the gradient fill. Both break on -Infinity.
  let linePath = "";
  let fillPath = "";
  let inSegment = false;
  let segmentStartX = 0;
  let lastX = 0;

  for (let i = 0; i < n; i++) {
    const v = rmsDb[i];
    const x = (i / (n - 1)) * VIEW_W;

    if (Number.isFinite(v)) {
      const y = VIEW_H - ((v - yMin) / yRange) * VIEW_H;
      const xStr = x.toFixed(1);
      const yStr = y.toFixed(1);
      if (!inSegment) {
        linePath += `M${xStr} ${yStr}`;
        // Fill starts at the x-axis, rises to the line.
        fillPath += `M${xStr} ${VIEW_H}L${xStr} ${yStr}`;
        segmentStartX = x;
      } else {
        linePath += `L${xStr} ${yStr}`;
        fillPath += `L${xStr} ${yStr}`;
      }
      inSegment = true;
      lastX = x;
    } else if (inSegment) {
      // Close the fill for the segment that just ended.
      fillPath += `L${lastX.toFixed(1)} ${VIEW_H}L${segmentStartX.toFixed(1)} ${VIEW_H}Z`;
      inSegment = false;
    }
  }
  // Close any segment still open at the end of the series.
  if (inSegment) {
    fillPath += `L${lastX.toFixed(1)} ${VIEW_H}L${segmentStartX.toFixed(1)} ${VIEW_H}Z`;
  }

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      className={`w-full h-16 text-brand-400 ${className}`}
      role="img"
      aria-label="Loudness over time"
    >
      <defs>
        <linearGradient id="loudness-chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill="url(#loudness-chart-fill)" />
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
