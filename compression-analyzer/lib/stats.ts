// Shared loudness-series statistics.
//
// Promoted from a private helper in `explanations.ts` when a third
// consumer (the technique recommender) showed up. The original comment
// in explanations.ts called out exactly this promotion, so moving it
// here keeps the app speaking one language about dynamic range — if we
// ever retune the percentile choice or the minimum-samples cutoff, all
// consumers change together.

/**
 * Dynamic range of a loudness-over-time series, expressed as
 * P90 − P10 in dB.
 *
 * Why percentile-based rather than max − min:
 *   Peak-to-peak would be dominated by one silent window at the end of
 *   a file or one transient spike — neither tells us anything useful
 *   about the "typical" level variation. P90 − P10 is robust to both.
 *
 * Silent / non-finite windows are excluded: a fade-out's trailing
 * -Infinity windows would otherwise anchor P10 and inflate the range.
 *
 * Returns 0 when the series has fewer than 10 finite samples — not
 * enough data to justify a percentile claim. Callers treat 0 as "don't
 * make a dynamic-range-based decision."
 */
export function dynamicRangeDb(series: readonly number[]): number {
  const finite: number[] = [];
  for (const v of series) if (Number.isFinite(v)) finite.push(v);
  if (finite.length < 10) return 0;
  const sorted = finite.slice().sort((a, b) => a - b);
  const pick = (p: number) => sorted[Math.floor((p / 100) * (sorted.length - 1))];
  return pick(90) - pick(10);
}
