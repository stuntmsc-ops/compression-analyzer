// Plain-language knee character for a numeric knee width.
//
// The engine rounds kneeDb to 0.5-dB steps and the plugin GUI shows it
// as a number, but beginners don't have an internal ruler for what
// "4 dB of knee" feels like. Mixing lore maps the width onto three
// broad characters:
//
//   hard   — the knee is either off or so narrow the transition is
//            essentially a discrete threshold. Compression character is
//            decisive and punchy. Suits transients (kick, snare) and
//            effect-style compression.
//   medium — a noticeable soft transition without disappearing into it.
//            A good all-rounder for vocals, guitar, and pop/rock.
//   soft   — wide enough that compression fades in gradually and the
//            listener stops noticing where the threshold is. Suits
//            bus/mix compression and warmth-goal settings.
//
// Boundaries are chosen against the set of values the engine actually
// emits (see INSTRUMENT_PRIORS × GOAL_PROFILES × GENRE_MODIFIERS in
// calibration.ts). With the current calibration:
//   • kick + control-peaks → 0 dB ........................ hard ✓
//   • vocal + control-peaks → 4 dB ....................... medium ✓
//   • vocal + add-warmth → 8 dB .......................... soft ✓
//   • full-mix + smooth-consistency → 9 dB ............... soft ✓

export type KneeCharacter = "hard" | "medium" | "soft";

/** Upper bound (exclusive) of the "hard" bucket, in dB. */
export const KNEE_HARD_MAX_DB = 2;
/** Upper bound (exclusive) of the "medium" bucket, in dB. */
export const KNEE_MEDIUM_MAX_DB = 6;

/**
 * Map a knee width in dB to a plain-language character.
 *
 * Non-finite or negative input is treated as 0 dB (hard) — the engine
 * clamps at 0 before it gets here, but the defensive floor keeps this
 * helper safe to call from any future surface that bypasses the engine.
 */
export function kneeCharacter(kneeDb: number): KneeCharacter {
  if (!Number.isFinite(kneeDb) || kneeDb < KNEE_HARD_MAX_DB) return "hard";
  if (kneeDb < KNEE_MEDIUM_MAX_DB) return "medium";
  return "soft";
}
