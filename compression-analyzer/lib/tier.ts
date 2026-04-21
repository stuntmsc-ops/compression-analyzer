// Pro access: signed-in user + active PayPal subscription in the database.
// Legacy localStorage helpers remain for tests and one-time cleanup after sign-in.
// Server enforcement: `lib/proSubscriptionServer.ts` + `/api/analysis/*`.

"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

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

/**
 * Pro status from `/api/subscription` (DB + PayPal lifecycle via webhooks).
 * `markPaidUnlocked` refreshes session + subscription (call after successful checkout).
 */
export function useTier(): {
  paidUnlocked: boolean;
  markPaidUnlocked: () => void;
  sessionStatus: "loading" | "authenticated" | "unauthenticated";
  userId: string | null;
} {
  const { data: session, status: sessionStatus, update } = useSession();
  const [proFromApi, setProFromApi] = useState(false);

  const refresh = useCallback(async () => {
    if (sessionStatus !== "authenticated" || !session?.user) {
      setProFromApi(false);
      return;
    }
    try {
      const res = await fetch("/api/subscription", { credentials: "include" });
      const data = (await res.json()) as { ok?: boolean; active?: boolean };
      setProFromApi(Boolean(res.ok && data.ok && data.active));
    } catch {
      setProFromApi(false);
    }
  }, [session?.user, sessionStatus]);

  useEffect(() => {
    queueMicrotask(() => {
      void refresh();
    });
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStatus === "authenticated") {
      clearPaidUnlocked(window.localStorage);
    }
  }, [sessionStatus]);

  const markPaidUnlocked = useCallback(() => {
    void update();
    void refresh();
  }, [update, refresh]);

  const normalizedStatus =
    sessionStatus === "loading"
      ? "loading"
      : sessionStatus === "authenticated"
        ? "authenticated"
        : "unauthenticated";

  return {
    paidUnlocked: proFromApi,
    markPaidUnlocked,
    sessionStatus: normalizedStatus,
    userId: session?.user?.id ?? null,
  };
}
