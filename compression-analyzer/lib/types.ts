// Shared types and option lists for selector inputs.
// The recommendation engine (Week 3) will import from this file.

export type InstrumentType =
  | "vocal"
  | "kick"
  | "snare"
  | "bass"
  | "acoustic-guitar"
  | "electric-guitar"
  | "piano"
  | "full-mix"
  | "other";

export type Genre =
  | "hip-hop"
  | "rnb"
  | "pop"
  | "rock"
  | "edm"
  | "lofi"
  | "other";

export type CompressionGoal =
  | "control-peaks"
  | "add-warmth"
  | "parallel-punch"
  | "smooth-consistency"
  | "aggressive-pumping";

export type SelectorState = {
  instrument: InstrumentType;
  genre: Genre;
  goal: CompressionGoal;
};

export const DEFAULT_SELECTOR_STATE: SelectorState = {
  instrument: "vocal",
  genre: "hip-hop",
  goal: "control-peaks",
};

export const INSTRUMENT_OPTIONS: readonly { value: InstrumentType; label: string }[] = [
  { value: "vocal", label: "Vocal" },
  { value: "kick", label: "Kick" },
  { value: "snare", label: "Snare" },
  { value: "bass", label: "Bass" },
  { value: "acoustic-guitar", label: "Acoustic Guitar" },
  { value: "electric-guitar", label: "Electric Guitar" },
  { value: "piano", label: "Piano / Keys" },
  { value: "full-mix", label: "Full Mix" },
  { value: "other", label: "Other" },
] as const;

export const GENRE_OPTIONS: readonly { value: Genre; label: string }[] = [
  { value: "hip-hop", label: "Hip-Hop / Trap" },
  { value: "rnb", label: "R&B / Soul" },
  { value: "pop", label: "Pop" },
  { value: "rock", label: "Rock" },
  { value: "edm", label: "EDM / Electronic" },
  { value: "lofi", label: "Lo-Fi" },
  { value: "other", label: "Other" },
] as const;

export const GOAL_OPTIONS: readonly { value: CompressionGoal; label: string; description: string }[] = [
  {
    value: "control-peaks",
    label: "Control Peaks",
    description: "Tame sharp transients and prevent clipping",
  },
  {
    value: "add-warmth",
    label: "Add Warmth",
    description: "Glue body and add subtle color",
  },
  {
    value: "parallel-punch",
    label: "Parallel Punch",
    description: "Blend hard compression for thickness",
  },
  {
    value: "smooth-consistency",
    label: "Smooth Consistency",
    description: "Level out dynamic variation",
  },
  {
    value: "aggressive-pumping",
    label: "Aggressive Pumping",
    description: "Intentional, obvious compression character",
  },
] as const;
