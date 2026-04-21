import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPaypalPlanId,
  isPaypalConfigured,
  paypalApiBase,
  resetPaypalServerForTests,
  verifyPaypalSubscription,
} from "./paypalServer";

describe("paypalServer", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    resetPaypalServerForTests();
    vi.stubEnv("PAYPAL_CLIENT_ID", "test-client");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "test-secret");
    vi.stubEnv("PAYPAL_PLAN_ID", "P-PLAN123");
    vi.stubEnv("PAYPAL_MODE", "sandbox");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses sandbox API base by default", () => {
    expect(paypalApiBase()).toBe("https://api-m.sandbox.paypal.com");
  });

  it("isPaypalConfigured is false without plan id", () => {
    vi.stubEnv("PAYPAL_PLAN_ID", "");
    expect(getPaypalPlanId()).toBeNull();
    expect(isPaypalConfigured()).toBe(false);
  });

  it("isPaypalConfigured is true with client, secret, and plan", () => {
    expect(isPaypalConfigured()).toBe(true);
  });

  it("verifyPaypalSubscription returns ok when status is ACTIVE", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({ access_token: "tok-1", expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({ id: "I-SUB1", status: "ACTIVE" }),
      });

    const r = await verifyPaypalSubscription("I-SUB1");
    expect(r).toEqual({
      ok: true,
      subscriptionId: "I-SUB1",
      customId: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const subUrl = String(fetchMock.mock.calls[1][0]);
    expect(subUrl).toContain("/v1/billing/subscriptions/");
  });

  it("verifyPaypalSubscription activates APPROVED then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({ access_token: "tok-2", expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({ id: "I-SUB2", status: "APPROVED" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "",
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({ id: "I-SUB2", status: "ACTIVE" }),
      });

    const r = await verifyPaypalSubscription("I-SUB2");
    expect(r).toEqual({
      ok: true,
      subscriptionId: "I-SUB2",
      customId: null,
    });
    const activateUrl = String(fetchMock.mock.calls[2][0]);
    expect(activateUrl).toContain("/activate");
  });

  it("verifyPaypalSubscription rejects non-active status", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({ access_token: "tok-3", expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({ id: "I-SUB3", status: "CANCELLED" }),
      });

    const r = await verifyPaypalSubscription("I-SUB3");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("CANCELLED");
  });
});
