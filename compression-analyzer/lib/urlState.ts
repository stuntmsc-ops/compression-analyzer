// URL-hash persistence for selector state.
//
// Selectors live in `window.location.hash` so a user can bookmark or
// share a specific recommendation setup without any server round-trip.
// The hash is parsed through URLSearchParams so the format is standard
// ("#instrument=vocal&genre=hip-hop&goal=control-peaks") and robust to
// reordering, extra unrelated keys, or partial input.
//
// Validation is closed-set: unknown values for instrument / genre /
// goal are dropped rather than widened to `string`, so a malformed
// URL can never push the app into a state the UI can't render.
//
// The `useUrlSelectors` hook wraps `useSyncExternalStore`, which is
// React's canonical way to bind state to an external source (here, the
// browser's hash). This avoids the "setState inside useEffect" pattern
// (which React 19's lint rules flag) and also handles SSR cleanly —
// the server snapshot is defaults, the client snapshot reads the real
// hash, and React's hydration machinery bridges the two without a
// mismatch error.
//
// The parser/serializer are pure strings-in-strings-out so they remain
// unit-testable in isolation; only the hook touches the DOM.

import { useSyncExternalStore } from "react";
import {
  INSTRUMENT_OPTIONS,
  GENRE_OPTIONS,
  GOAL_OPTIONS,
  DEFAULT_SELECTOR_STATE,
  type SelectorState,
} from "./types";

// Pre-built value sets so `parseSelectorHash` doesn't rescan the option
// lists on every call. Widened to `Set<string>` at construction so
// `.has(arbitraryString)` typechecks without a per-call predicate.
const INSTRUMENT_VALUES: ReadonlySet<string> = new Set(
  INSTRUMENT_OPTIONS.map((o) => o.value),
);
const GENRE_VALUES: ReadonlySet<string> = new Set(
  GENRE_OPTIONS.map((o) => o.value),
);
const GOAL_VALUES: ReadonlySet<string> = new Set(
  GOAL_OPTIONS.map((o) => o.value),
);

/**
 * Extract known selector values from a hash string. Accepts hashes with
 * or without the leading `#`. Returns only keys that were present *and*
 * validated against the closed option set — callers should spread this
 * over their defaults to fill gaps.
 */
export function parseSelectorHash(hash: string): Partial<SelectorState> {
  const stripped = hash.startsWith("#") ? hash.slice(1) : hash;
  if (stripped.length === 0) return {};
  const params = new URLSearchParams(stripped);
  const out: Partial<SelectorState> = {};

  const instrument = params.get("instrument");
  if (instrument && INSTRUMENT_VALUES.has(instrument)) {
    out.instrument = instrument as SelectorState["instrument"];
  }

  const genre = params.get("genre");
  if (genre && GENRE_VALUES.has(genre)) {
    out.genre = genre as SelectorState["genre"];
  }

  const goal = params.get("goal");
  if (goal && GOAL_VALUES.has(goal)) {
    out.goal = goal as SelectorState["goal"];
  }

  return out;
}

/**
 * Serialise the full selector state into a URLSearchParams-style string
 * WITHOUT the leading `#`. Callers prepend "#" when writing to
 * `location.hash` so this function stays usable for other contexts
 * (test assertions, plain query-string rendering, etc.). Keys are
 * written in a stable order so the same state always produces the same
 * string — removes a class of "URL flickers on re-render" bugs.
 */
export function serializeSelectorHash(state: SelectorState): string {
  const params = new URLSearchParams();
  params.set("instrument", state.instrument);
  params.set("genre", state.genre);
  params.set("goal", state.goal);
  return params.toString();
}

// ─── External-store binding ────────────────────────────────────────
//
// Module-local cache + listener set. Shared across all mounts of the
// hook, which is correct — the hash is a single global resource, not
// per-component state. Caching on hash-string equality keeps
// `getSnapshot` referentially stable between renders that didn't
// actually change the hash (required by useSyncExternalStore).

const listeners = new Set<() => void>();
let cachedHash: string | null = null;
let cachedSnapshot: SelectorState = DEFAULT_SELECTOR_STATE;

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Native `hashchange` catches back/forward navigation and direct
  // address-bar edits. Our own writes go through `writeSelectors` which
  // notifies the listener set manually (replaceState doesn't fire).
  window.addEventListener("hashchange", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("hashchange", onChange);
  };
}

function getSnapshot(): SelectorState {
  const hash = window.location.hash;
  if (hash !== cachedHash) {
    cachedHash = hash;
    cachedSnapshot = {
      ...DEFAULT_SELECTOR_STATE,
      ...parseSelectorHash(hash),
    };
  }
  return cachedSnapshot;
}

function getServerSnapshot(): SelectorState {
  // No DOM on the server — always render defaults. React switches to
  // `getSnapshot` after hydration, so a deep-link visit flows as:
  // SSR(defaults) → hydration → client snapshot(hash-derived).
  return DEFAULT_SELECTOR_STATE;
}

/**
 * Commit a new selector state to the URL hash and notify subscribers.
 * `replaceState` avoids pushing a history entry per selector toggle —
 * the back button should exit the app, not rewind five dropdown picks.
 */
function writeSelectors(next: SelectorState): void {
  const desired = "#" + serializeSelectorHash(next);
  if (window.location.hash === desired) return;
  history.replaceState(null, "", desired);
  // `hashchange` doesn't fire for programmatic hash changes made via
  // replaceState, so subscribers are notified manually. Listeners get
  // re-called even though React is already about to re-render from the
  // snapshot cache invalidation on the next getSnapshot call.
  for (const cb of listeners) cb();
}

/**
 * Hook wrapper around the hash-backed selector store. Returns a
 * `[selectors, setSelectors]` tuple matching the shape of useState so
 * SelectorPanel's value/onChange contract stays unchanged. Internally
 * routes all reads through `useSyncExternalStore` and all writes
 * through `writeSelectors`; the hash is the single source of truth.
 */
export function useUrlSelectors(): [
  SelectorState,
  (next: SelectorState) => void,
] {
  const selectors = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  return [selectors, writeSelectors];
}
