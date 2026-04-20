import { describe, it, expect } from "vitest";
import { validateEmail, EMAIL_MAX_LENGTH } from "./emailValidation";

describe("validateEmail", () => {
  it("accepts a plain address", () => {
    expect(validateEmail("user@example.com")).toEqual({
      ok: true,
      email: "user@example.com",
    });
  });

  it("accepts a plus-tagged address", () => {
    expect(validateEmail("user+compression@example.co.uk")).toEqual({
      ok: true,
      email: "user+compression@example.co.uk",
    });
  });

  it("lowercases and trims", () => {
    expect(validateEmail("  User@Example.COM  ")).toEqual({
      ok: true,
      email: "user@example.com",
    });
  });

  it("rejects empty input", () => {
    const result = validateEmail("");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/enter an email/i);
  });

  it("rejects whitespace-only input", () => {
    expect(validateEmail("   ").ok).toBe(false);
  });

  it("rejects addresses without @", () => {
    const result = validateEmail("userexample.com");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/valid email/i);
  });

  it("rejects addresses without a domain TLD", () => {
    expect(validateEmail("user@example").ok).toBe(false);
  });

  it("rejects addresses with whitespace inside", () => {
    expect(validateEmail("us er@example.com").ok).toBe(false);
    expect(validateEmail("user@exa mple.com").ok).toBe(false);
  });

  it("rejects addresses longer than the max length", () => {
    const tooLong = "a".repeat(EMAIL_MAX_LENGTH + 1) + "@example.com";
    const result = validateEmail(tooLong);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/too long/i);
  });

  it("handles non-string input defensively", () => {
    // Simulates a caller passing through an untyped form value — the
    // route handler calls this with `unknown` and relies on the guard.
    const result = validateEmail(undefined as unknown as string);
    expect(result.ok).toBe(false);
  });
});
