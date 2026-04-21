"use client";

import { useCallback, useEffect, useState, startTransition } from "react";
import { FREE_DAILY_ANALYSIS_LIMIT } from "./quotaConstants";

type QuotaReady = {
  status: "ready";
  used: number;
  remaining: number;
  canStart: boolean;
};

type QuotaState =
  | { status: "loading" }
  | QuotaReady
  | { status: "error"; message: string };

/**
 * `Response.json()` throws on empty bodies (common with mis-routed
 * requests, proxies, or dev cache glitches). Read text first.
 */
async function parseJsonBody(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      res.ok
        ? "Empty response from analysis quota API."
        : `Analysis quota API returned HTTP ${res.status} with no body.`,
    );
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Analysis quota API returned non-JSON (HTTP ${res.status}).`,
    );
  }
}

/**
 * Server-backed free-tier analysis quota (HttpOnly cookie + Redis).
 * When `paidUnlocked`, skips network and reports unlimited headroom.
 */
export function useAnalysisQuota(paidUnlocked: boolean): {
  quota: QuotaState;
  /** True when paid, or when free and server says a new analysis is allowed. */
  canStartNewAnalysis: boolean;
  refresh: () => Promise<void>;
  /** Call once after a successful decode + analyze (free tier only). */
  recordAfterSuccess: () => Promise<void>;
} {
  const [quota, setQuota] = useState<QuotaState>({ status: "loading" });

  const refresh = useCallback(async () => {
    if (paidUnlocked) {
      setQuota({
        status: "ready",
        used: 0,
        remaining: FREE_DAILY_ANALYSIS_LIMIT,
        canStart: true,
      });
      return;
    }
    try {
      const sessionRes = await fetch("/api/analysis/session", {
        credentials: "include",
      });
      // Drain the body so the connection closes; only one read allowed.
      await sessionRes.text().catch(() => "");
      if (!sessionRes.ok) {
        throw new Error(
          `Session endpoint failed (HTTP ${sessionRes.status}).`,
        );
      }

      const res = await fetch("/api/analysis/quota", { credentials: "include" });
      const data = await parseJsonBody(res);
      if (!res.ok || !data.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Could not load analysis quota.",
        );
      }
      setQuota({
        status: "ready",
        used: typeof data.used === "number" ? data.used : 0,
        remaining: typeof data.remaining === "number" ? data.remaining : 0,
        canStart: Boolean(data.canStart),
      });
    } catch (err) {
      setQuota({
        status: "error",
        message: err instanceof Error ? err.message : "Quota request failed.",
      });
    }
  }, [paidUnlocked]);

  useEffect(() => {
    startTransition(() => {
      void refresh();
    });
  }, [refresh]);

  const recordAfterSuccess = useCallback(async () => {
    if (paidUnlocked) return;
    try {
      const res = await fetch("/api/analysis/record", {
        method: "POST",
        credentials: "include",
      });
      const data = await parseJsonBody(res);
      if (!res.ok || !data.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Could not record analysis.",
        );
      }
      setQuota({
        status: "ready",
        used: typeof data.used === "number" ? data.used : 0,
        remaining: typeof data.remaining === "number" ? data.remaining : 0,
        canStart: Boolean(data.canStart),
      });
    } catch {
      await refresh();
    }
  }, [paidUnlocked, refresh]);

  const canStartNewAnalysis =
    paidUnlocked || (quota.status === "ready" && quota.canStart);

  return { quota, canStartNewAnalysis, refresh, recordAfterSuccess };
}
