import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getSmtpMagicLinkTransport,
  isEmailMagicLinkConfigured,
} from "./emailMagicLinkConfig";

describe("emailMagicLinkConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when EMAIL_SERVER is missing", () => {
    vi.stubEnv("EMAIL_SERVER", "");
    expect(getSmtpMagicLinkTransport()).toBeNull();
  });

  it("isEmailMagicLinkConfigured is false when only RESEND without FROM", () => {
    vi.stubEnv("RESEND_API_KEY", "re_123");
    vi.stubEnv("EMAIL_FROM", "");
    expect(isEmailMagicLinkConfigured()).toBe(false);
  });

  it("isEmailMagicLinkConfigured is true with RESEND_API_KEY and EMAIL_FROM", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "App <onboarding@resend.dev>");
    expect(isEmailMagicLinkConfigured()).toBe(true);
  });

  it("parses JSON EMAIL_SERVER", () => {
    vi.stubEnv(
      "EMAIL_SERVER",
      '{"host":"smtp.example.com","port":587,"secure":false,"auth":{"user":"u","pass":"p"}}',
    );
    const t = getSmtpMagicLinkTransport();
    expect(t).toEqual(
      expect.objectContaining({
        host: "smtp.example.com",
        port: 587,
      }),
    );
  });
});
