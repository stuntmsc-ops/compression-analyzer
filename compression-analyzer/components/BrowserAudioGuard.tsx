"use client";

import { useEffect, useState } from "react";
import { MSG_BROWSER_NO_WEB_AUDIO } from "@/lib/userFacingMessages";
import ReportProblemLink from "@/components/ReportProblemLink";

function webAudioSupported(): boolean {
  if (typeof window === "undefined") return true;
  return !!(
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  );
}

/**
 * After mount, hides the analyzer when Web Audio is unavailable (legacy browsers).
 * Safari still exposes AudioContext or webkitAudioContext; decode edge cases use
 * friendly errors in the main pipeline.
 */
export default function BrowserAudioGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      if (!webAudioSupported()) setBlocked(true);
    });
  }, []);

  if (blocked) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
        <p className="text-amber-100 text-sm leading-relaxed mb-4">
          {MSG_BROWSER_NO_WEB_AUDIO}
        </p>
        <ReportProblemLink />
      </div>
    );
  }

  return children;
}
