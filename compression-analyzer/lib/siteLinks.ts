/** External Audio Spectra marketing and support pages. */
export const CONTACT_URL = "https://audiospectra.net/contact-us/";
export const BLOG_URL = "https://audiospectra.net/blog/";

/**
 * Opens the user's email client when `NEXT_PUBLIC_SUPPORT_EMAIL` is set;
 * otherwise opens the Audio Spectra contact page.
 */
export function getReportProblemHref(): string {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  if (email) {
    const subject = encodeURIComponent("Compression Analyzer - problem report");
    const body = encodeURIComponent(
      "What were you trying to do?\n\nWhat went wrong?\n\nBrowser and version (e.g. Safari 17 on macOS):\n\n",
    );
    return `mailto:${email}?subject=${subject}&body=${body}`;
  }
  return CONTACT_URL;
}
