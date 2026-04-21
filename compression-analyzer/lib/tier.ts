// Paid-tier flag (client localStorage). Free-tier analysis limits are
// enforced server-side — see `lib/analysisQuotaServer.ts` and
// `/api/analysis/*` routes.

import { useCallback, useSyncExternalStore } from "react";

export const PAID_TIER_STORAGE_KEY = "compression-tool:paid-unlocked";
const PAID_TRUTHY = "1";

/** Re-export for UI copy that references the same cap as the API. */
export { FREE_DAILY_ANALYSIS_LIMIT } from "./quotaConstants";

export function readPaidUnlocked(storage: Storage | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(PAID_TIER_STORAGE_KEY) === PAID_TRUTHY;
  } catch {
    return false;
  }
}

export function writePaidUnlocked(storage: Storage | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PAID_TIER_STORAGE_KEY, PAID_TRUTHY);
    return true;
  } catch {
    return false;
  }
}

export function clearPaidUnlocked(storage: Storage | null): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(PAID_TIER_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedPaid = false;

function safePaidRaw(): string | null {
  try {
    return window.localStorage.getItem(PAID_TIER_STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === PAID_TIER_STORAGE_KEY || e.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): boolean {
  const raw = safePaidRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedPaid = raw === PAID_TRUTHY;
  }
  return cachedPaid;
}

function emitLocal(): void {
  cachedRaw = undefined;
  for (const cb of listeners) cb();
}

/**
 * Pro unlock flag only. Free analysis quota comes from
 * `useAnalysisQuota` + `/api/analysis/*`.
 */
export function useTier(): {
  paidUnlocked: boolean;
  markPaidUnlocked: () => void;
} {
  const paidUnlocked = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => false,
  );

  const markPaidUnlocked = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!writePaidUnlocked(window.localStorage)) return;
    emitLocal();
  }, []);

  return { paidUnlocked, markPaidUnlocked };
}
