/**
 * Nodemailer SMTP transport for NextAuth Email (magic link), when using
 * `EMAIL_SERVER` + `EMAIL_FROM` (not Resend — Resend uses HTTP in `authOptions`).
 */
export function getSmtpMagicLinkTransport(): string | object | null {
  const raw = process.env.EMAIL_SERVER?.trim();
  if (!raw) return null;

  if (raw.startsWith("{")) {
    try {
      return JSON.parse(raw) as object;
    } catch {
      return null;
    }
  }

  return raw;
}

export function isEmailMagicLinkConfigured(): boolean {
  const from = process.env.EMAIL_FROM?.trim();
  if (!from) return false;
  if (process.env.RESEND_API_KEY?.trim()) return true;
  return Boolean(getSmtpMagicLinkTransport());
}
