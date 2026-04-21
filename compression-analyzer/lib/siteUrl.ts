/**
 * Canonical site URL for metadata, Open Graph, and JSON-LD.
 * Prefer NEXTAUTH_URL when set (production custom domain on Vercel).
 */
export function getSiteUrl(): string {
  const nextAuth = process.env.NEXTAUTH_URL?.trim();
  if (nextAuth) return nextAuth.replace(/\/$/, "");
  if (process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`;
  return "http://localhost:3000";
}
