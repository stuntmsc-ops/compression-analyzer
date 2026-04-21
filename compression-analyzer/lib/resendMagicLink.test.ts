import { afterEach, describe, expect, it, vi } from "vitest";
import { sendMagicLinkViaResend } from "./resendMagicLink";

describe("sendMagicLinkViaResend", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("throws when RESEND_API_KEY is missing", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await expect(
      sendMagicLinkViaResend({
        to: "a@b.com",
        url: "http://localhost:3000/api/auth/callback/email?token=x",
        from: "App <onboarding@resend.dev>",
      }),
    ).rejects.toThrow("RESEND_API_KEY");
  });

  it("calls Resend API when key is set", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "{}",
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendMagicLinkViaResend({
      to: "user@example.com",
      url: "http://localhost:3000/callback",
      from: "App <onboarding@resend.dev>",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test_key");
  });
});
