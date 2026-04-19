import Meyda from "meyda";

/**
 * A downsampled RMS-over-time series for visualising loudness
 * consistency. Produced by aggregating the per-frame RMS values into
 * fixed-duration windows (~100ms each) via root-mean-square — the same
 * combination rule used for the overall RMS, so a window's dB value
 * accurately reflects its perceived loudness regardless of window size.
 */
export type LoudnessSeries = {
  /** Per-window loudness in dB. -Infinity for fully silent windows. */
  rmsDb: number[];
  /** Seconds between consecutive points. Frame-aligned, not exactly 0.1s. */
  hopSeconds: number;
  /**
   * Standard deviation of finite per-window loudness values, in dB.
   * The plan calls this "variance"; stdDev is its square root and shares
   * units with the loudness measurements, which reads more naturally —
   * a 3 dB stdDev is roughly interpretable, a 9 dB² variance isn't.
   * Silent and near-silent (-Infinity) windows are excluded.
   */
  stdDevDb: number;
};

/**
 * Quality flags surfaced to the UI so we can warn the user when the
 * source file isn't suitable for confident analysis. The engine will
 * still produce numbers for flagged files, but the UI should explain
 * why the recommendation is less trustworthy.
 */
export type QualityFlags = {
  /** Duration < 1s — too little data to judge dynamic behaviour. */
  tooShort: boolean;
  /**
   * Peak is essentially at full scale. Real clipping detection would
   * require inter-sample peak analysis; we approximate with peak ≥ 0.99
   * (~-0.087 dBFS), which catches signals that have been clipped or
   * brickwall-limited into the ceiling.
   */
  clipping: boolean;
  /** Peak below ~-60 dBFS — essentially no signal to analyse. */
  silent: boolean;
};

/**
 * Measurements extracted from an uploaded audio file. The recommendation
 * engine will consume all of this together.
 */
export type AudioAnalysisResult = {
  /**
   * RMS amplitude, linear, under the AES-17 convention — a full-scale
   * sine reads 1.0. Derived from per-channel sum-of-squares (not via a
   * mono downmix) so decorrelated stereo content keeps its energy.
   * Normal music sits in 0..~1; only pathological low-crest signals
   * (square, DC) can technically exceed 1.
   */
  rms: number;
  /**
   * RMS in dBFS, AES-17 calibrated — a full-scale sine reads 0 dBFS.
   * Matches the RMS metering in Pro Tools, Logic, Ableton, Reaper,
   * etc., so readings here calibrate against what the producer sees in
   * their DAW. Music typically lands in -40..-6 dBFS.
   */
  rmsDb: number;

  /** Absolute maximum sample value across all channels (0..1). */
  peak: number;
  /** Peak in dBFS. 0 dBFS = digital full-scale. */
  peakDb: number;

  /**
   * Peak-to-RMS ratio in dB — how "peaky" the signal is. Derives from
   * AES-17 RMS, so a pure sine reads ~0 dB (peak and AES-17 RMS
   * coincide at 0 dBFS for a full-scale sine).
   *   Low (~3-7 dB):    heavily limited, modern masters.
   *   Medium (~9-13 dB): typical mixed content, gentle compression.
   *   High (~15-20+ dB): raw/uncompressed recordings with natural transients.
   */
  crestFactorDb: number;

  /**
   * Spectral centroid in Hz — the "center of mass" of the magnitude
   * spectrum, averaged across frames. A rough brightness proxy:
   *   ~500-1500 Hz:  darker material (bass, muddy mixes, warm vocals)
   *   ~1500-3500 Hz: typical full-range music and vocals
   *   ~3500+ Hz:     bright/airy content (cymbals, sibilant vocals)
   */
  spectralCentroidHz: number;

  /**
   * Spectral rolloff in Hz — the frequency below which 99% of the
   * magnitude energy lies, averaged across frames. Meyda uses a 99%
   * threshold (not the 85% sometimes seen in DSP literature), so values
   * typically sit much closer to Nyquist than the centroid.
   */
  spectralRolloffHz: number;

  /**
   * Zero crossings per second, averaged across frames. Loose proxy for
   * noisiness vs. tonality — pure tones cross zero at roughly 2×
   * their fundamental frequency, noisy/percussive content crosses much
   * more often.
   */
  zeroCrossingRate: number;

  /**
   * Loudness over time. Suitable for rendering a consistency chart —
   * flat lines = squashed/compressed, jagged lines = dynamic.
   */
  loudnessOverTime: LoudnessSeries;

  // Context about what was measured
  duration: number;       // seconds
  sampleRate: number;     // Hz (usually 44100 or 48000)
  numChannels: number;
  numFrames: number;      // how many analysis frames were processed
  frameSize: number;      // samples per frame

  /**
   * Computed in the analysis pipeline; the UI uses these to decide
   * whether to warn the user before presenting settings.
   */
  qualityFlags: QualityFlags;
};

/**
 * Size of each analysis frame in samples. Power of 2 for spectral
 * features we'll add later. At 44.1kHz, 2048 samples ≈ 46ms — fine for
 * capturing transient behavior without being too noisy.
 */
const FRAME_SIZE = 2048;

/**
 * Target spacing between loudness-series points. ~10 points/second is
 * enough resolution for a smooth consistency chart without bloating the
 * payload. The actual hop is rounded to a whole number of frames so each
 * window contains an integer count of per-frame RMS values.
 */
const LOUDNESS_TARGET_HOP_SECONDS = 0.1;

/**
 * AES-17 calibration gain applied to linear RMS values. A raw RMS reading
 * of a full-scale sine wave is 1/√2 ≈ 0.707 — AES-17 multiplies by √2 so
 * the same sine reads 1.0, equivalently 0 dBFS. Every pro DAW RMS meter
 * (Pro Tools, Logic, Ableton, Reaper) uses this convention; applying it
 * here means our readings calibrate against what the user sees in their
 * DAW rather than landing 3 dB low.
 */
const AES17_GAIN = Math.SQRT2;

/**
 * Mix all channels down to a single mono signal by averaging.
 * Produces a new Float32Array; the original AudioBuffer is not modified.
 */
function toMono(audioBuffer: AudioBuffer): Float32Array {
  const numChannels = audioBuffer.numberOfChannels;

  // Fast path: already mono — return the underlying data directly
  if (numChannels === 1) {
    return audioBuffer.getChannelData(0);
  }

  const length = audioBuffer.length;
  const mono = new Float32Array(length);

  for (let ch = 0; ch < numChannels; ch++) {
    const channel = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += channel[i] / numChannels;
    }
  }

  return mono;
}

/**
 * Extract audio features from a decoded AudioBuffer.
 * Pure synchronous computation — runs in single-digit milliseconds for
 * typical clips under 60 seconds.
 */
export function analyzeAudioBuffer(audioBuffer: AudioBuffer): AudioAnalysisResult {
  Meyda.bufferSize = FRAME_SIZE;

  // Cache channel references once so the hot frame loop below doesn't
  // pay the getChannelData() cost on every iteration.
  const numChannels = audioBuffer.numberOfChannels;
  const channels: Float32Array[] = new Array(numChannels);
  for (let ch = 0; ch < numChannels; ch++) {
    channels[ch] = audioBuffer.getChannelData(ch);
  }

  // Mono downmix, used only as the spectral-features input below.
  // Centroid/rolloff are ratio metrics so the downmix's energy loss
  // doesn't change their values; RMS is computed per-channel instead
  // (see the frame loop) to avoid that loss.
  const mono = toMono(audioBuffer);

  // Peak across all channels. Measuring on raw per-channel samples —
  // not mono-downmixed — so anti-phase content doesn't artificially
  // zero out the peak. Peak is whole-signal, not frame-aligned, so
  // every sample including any tail beyond the last full frame counts.
  let peak = 0;
  for (let ch = 0; ch < numChannels; ch++) {
    const data = channels[ch];
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }

  // Split into non-overlapping frames. Discard the final partial frame
  // if the signal length isn't a clean multiple of FRAME_SIZE — the tail
  // is too short to matter for overall statistics.
  const numFrames = Math.floor(mono.length / FRAME_SIZE);

  // Accumulators for per-frame features.
  // RMS is combined via root-mean-square (sqrt of mean of squares),
  // which is mathematically equivalent to computing RMS over the whole
  // signal in one pass. Spectral features and ZCR are simple means.
  let sumSquaredRms = 0;
  let sumCentroidBins = 0;
  let sumRolloffHz = 0;
  let sumZcrCount = 0;

  // Also retain each frame's RMS so we can downsample it into the
  // loudness-over-time series below. Float32Array keeps memory small:
  // ~22 frames/sec × 60s = 5KB for a typical clip.
  const frameRmsSeries = new Float32Array(numFrames);

  // Silent or near-silent frames can yield NaN spectral centroids
  // (0/0 when the magnitude spectrum sums to zero). Guard every value
  // we read back from Meyda against non-finite results.
  const toFinite = (x: unknown): number =>
    typeof x === "number" && Number.isFinite(x) ? x : 0;

  for (let i = 0; i < numFrames; i++) {
    const start = i * FRAME_SIZE;

    // Per-frame RMS from sum-of-squares across every channel. This
    // matches the "stereo RMS" convention used by DAW meters and
    // sidesteps the 3 dB energy loss that mono-averaging inflicts on
    // decorrelated stereo content (stereo reverb, panned synths, etc.)
    // where L and R partially cancel when summed.
    let frameSumSquared = 0;
    for (let ch = 0; ch < numChannels; ch++) {
      const data = channels[ch];
      for (let j = 0; j < FRAME_SIZE; j++) {
        const s = data[start + j];
        frameSumSquared += s * s;
      }
    }
    const frameRms = Math.sqrt(
      frameSumSquared / (FRAME_SIZE * numChannels),
    );
    frameRmsSeries[i] = frameRms;
    sumSquaredRms += frameRms * frameRms;

    // Spectral features run on the mono frame. A single batched
    // extract() reuses the internal FFT across the three features.
    const monoFrame = mono.subarray(start, start + FRAME_SIZE);
    const features = Meyda.extract(
      ["spectralCentroid", "spectralRolloff", "zcr"],
      monoFrame,
    ) as Partial<Record<string, number>> | null;

    sumCentroidBins += toFinite(features?.spectralCentroid);
    sumRolloffHz += toFinite(features?.spectralRolloff);
    sumZcrCount += toFinite(features?.zcr);
  }

  // AES-17 gain applied once; the dB conversion below then lands on
  // the DAW convention automatically (full-scale sine = 0 dBFS RMS).
  const rms =
    numFrames > 0 ? Math.sqrt(sumSquaredRms / numFrames) * AES17_GAIN : 0;
  const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
  const peakDb = peak > 0 ? 20 * Math.log10(peak) : -Infinity;

  // Crest factor = how much headroom exists above average level.
  // Only meaningful when both values are finite; silent signals get 0.
  const crestFactorDb =
    Number.isFinite(peakDb) && Number.isFinite(rmsDb) ? peakDb - rmsDb : 0;

  // Meyda's spectralCentroid returns a bin index into the magnitude
  // spectrum (length FRAME_SIZE/2, spanning 0..Nyquist). Convert to Hz
  // using fs/bufferSize per bin. spectralRolloff already returns Hz,
  // so it only needs averaging.
  const sampleRate = audioBuffer.sampleRate;
  const hzPerBin = sampleRate / FRAME_SIZE;
  const meanCentroidBins = numFrames > 0 ? sumCentroidBins / numFrames : 0;
  const spectralCentroidHz = meanCentroidBins * hzPerBin;
  const spectralRolloffHz = numFrames > 0 ? sumRolloffHz / numFrames : 0;

  // ZCR is returned as a raw count per frame. Normalise to crossings
  // per second so the number is interpretable regardless of frame size.
  const meanZcrCount = numFrames > 0 ? sumZcrCount / numFrames : 0;
  const zeroCrossingRate = meanZcrCount * (sampleRate / FRAME_SIZE);

  // Downsample the per-frame RMS into fixed-duration windows for the
  // loudness-over-time series. Combining frames inside a window uses
  // root-mean-square again so the displayed dB is a true loudness
  // average, not a biased arithmetic mean of dB values (which would
  // weight quiet frames too heavily).
  const framesPerWindow = Math.max(
    1,
    Math.round((LOUDNESS_TARGET_HOP_SECONDS * sampleRate) / FRAME_SIZE),
  );
  const hopSeconds = (framesPerWindow * FRAME_SIZE) / sampleRate;
  const numWindows = Math.floor(numFrames / framesPerWindow);
  const loudnessRmsDb: number[] = new Array(numWindows);

  for (let w = 0; w < numWindows; w++) {
    const start = w * framesPerWindow;
    let windowSumSquared = 0;
    for (let i = 0; i < framesPerWindow; i++) {
      const r = frameRmsSeries[start + i];
      windowSumSquared += r * r;
    }
    // Same AES-17 gain as the overall RMS so every point in the chart
    // scales consistently with the headline number above it.
    const windowRms =
      Math.sqrt(windowSumSquared / framesPerWindow) * AES17_GAIN;
    loudnessRmsDb[w] = windowRms > 0 ? 20 * Math.log10(windowRms) : -Infinity;
  }

  // Variance/stdDev over the finite (non-silent) loudness windows.
  // Two-pass: mean first, then mean of squared deviations. Numerically
  // fine for the array sizes we deal with (a few thousand points max).
  let finiteCount = 0;
  let finiteSum = 0;
  for (const v of loudnessRmsDb) {
    if (Number.isFinite(v)) {
      finiteCount++;
      finiteSum += v;
    }
  }
  let stdDevDb = 0;
  if (finiteCount > 1) {
    const mean = finiteSum / finiteCount;
    let sumSquaredDev = 0;
    for (const v of loudnessRmsDb) {
      if (Number.isFinite(v)) {
        const d = v - mean;
        sumSquaredDev += d * d;
      }
    }
    stdDevDb = Math.sqrt(sumSquaredDev / finiteCount);
  }

  // Quality flags — cheap derivations from what we already computed.
  // Thresholds mirror the classifiers in AudioProfile so the UI and
  // engine agree on "clipping" / "silent" without double-defining them.
  const qualityFlags: QualityFlags = {
    tooShort: audioBuffer.duration < 1,
    clipping: peak >= 0.99,
    silent: peak < 0.001,
  };

  return {
    rms,
    rmsDb,
    peak,
    peakDb,
    crestFactorDb,
    spectralCentroidHz,
    spectralRolloffHz,
    zeroCrossingRate,
    loudnessOverTime: {
      rmsDb: loudnessRmsDb,
      hopSeconds,
      stdDevDb,
    },
    duration: audioBuffer.duration,
    sampleRate,
    numChannels: audioBuffer.numberOfChannels,
    numFrames,
    frameSize: FRAME_SIZE,
    qualityFlags,
  };
}
