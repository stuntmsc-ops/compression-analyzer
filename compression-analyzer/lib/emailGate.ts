// Email-gate persistence.
//
// Tracks whether the current browser has already handed over an email
// address, so returning visitors don't face the modal every analysis.
// localStorage is the right tool here: survives reloads, sits entirely
// client-side (no round-trip), and a hard-reset (devtools → clear
// storage) is a documented way to "see the gate again" for testing.
//
// Mirrors the `useSyncExternalStore` shape of `lib/urlState.ts` so reads
// stay SSR-safe (server snapshot is always "not submitted"), cross-tab
// mutations stay in sync (a sibling tab submitting lifts the gate here
// too), and React 19's "no setState in useEffect" lint rule is
// satisfied. Pure helpers are exported separately so the tests don't
// need a DOM.

import { useSyncExternalStore } from "react";

export const EMAIL_GATE_STORAGE_KEY = "compression-tool:email-submitted";
const TRUTHY = "1";

/**
 * Pure read: returns whether the stored flag is present and truthy.
 * Accepts `null` so test code can represent "localStorage unavailable"
 * without monkey-patching globals.
 */
export function readSubmitted(storage: Storage | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(EMAIL_GATE_STORAGE_KEY) === TRUTHY;
  } catch {
    // localStorage can throw in some privacy modes / locked iframes.
    // Defaulting to "not submitted" is the safe choice — a user who
    // can't persist state will just be re-prompted, not silently
    // skipped.
    return false;
  }
}

/**
 * Pure write: sets the flag to truthy. No-ops on storage failures —
 * same reasoning as `readSubmitted`. Returns whether the write
 * succeeded so the hook can skip its listener notification when the
 * write silently failed.
 */
export function writeSubmitted(storage: Storage | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(EMAIL_GATE_STORAGE_KEY, TRUTHY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pure clear: removes the flag entirely. Exposed for testing and for a
 * future "reset the tool" button — not wired into any surface yet.
 */
export function clearSubmitted(storage: Storage | null): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(EMAIL_GATE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

// ─── External-store binding ────────────────────────────────────────
//
// Same shape as urlState.ts: a module-local listener set + snapshot
// cache so useSyncExternalStore's referential-stability requirement
// holds. Snapshot is cached on the raw string read so getSnapshot is
// cheap and stable between renders that didn't change the flag.

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedSnapshot = false;

function safeGetRaw(): string | null {
  try {
    return window.localStorage.getItem(EMAIL_GATE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Cross-tab sync: the `storage` event fires in OTHER tabs when one
  // tab writes. Same-tab writes don't fire it, so `markSubmitted`
  // notifies the local listener set manually.
  const onStorage = (e: StorageEvent) => {
    if (e.key === EMAIL_GATE_STORAGE_KEY || e.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): boolean {
  const raw = safeGetRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSnapshot = raw === TRUTHY;
  }
  return cachedSnapshot;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Hook interface mirroring useState's `[value, setter]` shape. The
 * setter is one-way (submitted → true) because there's no UI path to
 * un-submit an email; testing can call `clearSubmitted` directly.
 */
export function useEmailGate(): [boolean, () => void] {
  const submitted = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const markSubmitted = () => {
    if (typeof window === "undefined") return;
    const ok = writeSubmitted(window.localStorage);
    if (!ok) return;
    // Invalidate cache so the next getSnapshot re-reads and returns
    // `true` — without this, the snapshot cache would stay `false`
    // until some other event bumped it.
    cachedRaw = undefined;
    for (const cb of listeners) cb();
  };

  return [submitted, markSubmitted];
}
