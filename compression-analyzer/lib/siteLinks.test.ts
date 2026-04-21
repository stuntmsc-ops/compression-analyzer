import { afterEach, describe, expect, it, vi } from "vitest";
import { CONTACT_URL, getReportProblemHref } from "./siteLinks";

describe("getReportProblemHref", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses mailto when NEXT_PUBLIC_SUPPORT_EMAIL is set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_EMAIL", "help@example.com");
    const href = getReportProblemHref();
    expect(href.startsWith("mailto:help@example.com")).toBe(true);
    expect(href).toContain("subject=");
    expect(href).toContain("body=");
  });

  it("falls back to contact page when email is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_EMAIL", "");
    expect(getReportProblemHref()).toBe(CONTACT_URL);
  });
});
