/** User-visible copy for upload / decode failures (validation or decodeAudioData). */
export const MSG_UPLOAD_FAILED =
  "Something went wrong. Try a WAV or MP3 under 20MB.";

/** When the user drops more than one file at once. */
export const MSG_UPLOAD_ONE_FILE =
  "Something went wrong. Pick one WAV or MP3 under 20MB at a time.";

/** After decode succeeds but the analysis pipeline throws. */
export const MSG_ANALYSIS_FAILED =
  "We couldn't analyze this file. It might be too short or corrupted.";

/** PayPal button errors, verification failures, and generic checkout issues. */
export const MSG_PAYMENT_FAILED =
  "Payment didn't go through. Try again or contact support.";

/** Free-tier quota API unavailable or misconfigured. */
export const MSG_QUOTA_UNAVAILABLE =
  "We couldn't check your free analyses right now. You can still try uploading. If this keeps happening, try again later.";

/** No Web Audio API (very old or locked-down browser). */
export const MSG_BROWSER_NO_WEB_AUDIO =
  "This browser cannot run the analyzer. Try the latest Chrome, Firefox, Safari, or Edge.";
