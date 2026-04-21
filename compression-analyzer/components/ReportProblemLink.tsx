"use client";

import { getReportProblemHref } from "@/lib/siteLinks";

type Props = {
  className?: string;
};

/**
 * Opens a prefilled support email when `NEXT_PUBLIC_SUPPORT_EMAIL` is set;
 * otherwise opens the Audio Spectra contact page.
 */
export default function ReportProblemLink({ className = "" }: Props) {
  const href = getReportProblemHref();
  const isMailto = href.startsWith("mailto:");
  return (
    <a
      href={href}
      className={`text-brand-400/90 hover:text-brand-300 text-sm font-medium hover:underline underline-offset-2 ${className}`}
      {...(isMailto
        ? {}
        : { target: "_blank", rel: "noopener noreferrer" })}
    >
      Report a Problem
    </a>
  );
}
