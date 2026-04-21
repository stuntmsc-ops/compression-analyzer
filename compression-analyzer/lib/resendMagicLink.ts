/**
 * Send NextAuth magic-link email via Resend HTTP API (shows up in Resend logs).
 * https://resend.com/docs/api-reference/emails/send-email
 */
export async function sendMagicLinkViaResend(params: {
  to: string;
  url: string;
  from: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set.");
  }

  const host = new URL(params.url).host.replace(/\./g, "&#8203;.");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: `Sign in to ${new URL(params.url).host}`,
      text: `Sign in to ${new URL(params.url).host}\n\n${params.url}\n\nIf you did not request this email, you can ignore it.`,
      html: `<p style="font-family:system-ui,sans-serif;font-size:16px;color:#333">Sign in to <strong>${host}</strong></p>
<p style="font-family:system-ui,sans-serif"><a href="${params.url}" style="display:inline-block;padding:12px 20px;background:#346df1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Sign in</a></p>
<p style="font-family:system-ui,sans-serif;font-size:14px;color:#666">If you did not request this email, you can ignore it.</p>`,
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error("[Resend magic link]", res.status, body);
    throw new Error(`Resend returned HTTP ${res.status}`);
  }
}
