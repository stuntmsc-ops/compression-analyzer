import type { ReactNode } from "react";
import Link from "next/link";
import Hero from "@/components/Hero";

const BULLETS = [
  "Analyzes the dynamics of your clip (peaks, punch, and sustain), not generic preset charts.",
  "Suggests ratio, attack, release, and threshold tailored to your instrument, genre, and mix goal.",
  "Runs in the browser: upload a short clip and see recommendations in under a minute.",
];

const STEPS = [
  {
    n: "1",
    title: "Upload",
    body: "Drop a vocal, instrument stem, or mix snippet. Common formats like WAV and MP3 are supported.",
  },
  {
    n: "2",
    title: "Analyze",
    body: "We measure your audio’s envelope and spectral character so suggestions match what you’re actually hearing.",
  },
  {
    n: "3",
    title: "Get settings",
    body: "Copy compressor starting points into your DAW, then tweak by ear. After your free daily credits, upgrade once for full unlimited access and extra coaching notes.",
  },
];

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "What audio formats can I upload?",
    a: "Most browsers handle WAV, MP3, M4A, and other formats the Web Audio API can decode. For best results, use a short, representative clip without heavy limiting on the master.",
  },
  {
    q: "Do you store my audio on a server?",
    a: "Analysis runs in your browser. We do not upload your audio file to our servers for processing. Optional features like sign-in and billing use standard secure connections only for account and subscription data.",
  },
  {
    q: "Are these settings a guarantee for a perfect mix?",
    a: "No. They are educated starting points based on measured dynamics. Your ears, arrangement, and context always win. Use the numbers as a compass, not a cage.",
  },
  {
    q: "What is the difference between Free and Pro?",
    a: "Free includes the full feature set (all instruments, technique tips, and shareable links) for up to three analyses per day (UTC). Pro is a one-time purchase that removes the daily cap so you can run unlimited analyses.",
  },
  {
    q: "Will this work with my compressor plugin or stock DAW compressor?",
    a: "Yes. The suggestions use familiar terms (ratio, attack, release, threshold), so you can dial them into any compressor, analog-modeled or clean digital.",
  },
  {
    q: "Do I need an account to try it?",
    a: "You can explore the analyzer and see full settings without an account. Sign in with Google or email when you are ready to pay for Pro (one-time).",
  },
  {
    q: "Where can I read your privacy policy?",
    a: (
      <>
        We describe what we collect, how we use it, and your choices in our{" "}
        <Link
          href="/privacy"
          className="text-brand-400 hover:text-brand-300 underline underline-offset-2"
        >
          Privacy Policy
        </Link>
        .
      </>
    ),
  },
];

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  );
}

export default function LandingMarketing() {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-b from-brand-500/8 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[min(90vw,720px)] h-[420px] bg-brand-500/12 rounded-full blur-[100px] pointer-events-none" />

      <section
        className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-10 sm:pb-14 text-center"
        aria-labelledby="landing-headline"
      >
        <p className="inline-flex items-center gap-2 rounded-full border border-brand-500/25 bg-brand-500/10 px-4 py-1.5 text-xs sm:text-sm font-medium text-brand-300 mb-6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-400" />
          </span>
          Built for producers and mixing engineers
        </p>

        <h1
          id="landing-headline"
          className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight leading-[1.08] max-w-4xl mx-auto"
        >
          Stop Guessing Your{" "}
          <span className="bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
            Compression Settings
          </span>
        </h1>

        <p className="mt-6 text-gray-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          Your track is not a YouTube tutorial preset. Get starting points grounded in{" "}
          <strong className="text-gray-300 font-medium">your</strong> audio, then refine
          with confidence.
        </p>

        <ul className="mt-10 max-w-xl mx-auto text-left space-y-4">
          {BULLETS.map((text) => (
            <li key={text.slice(0, 24)} className="flex gap-3">
              <span
                className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-brand-500/15 border border-brand-500/30 flex items-center justify-center"
                aria-hidden
              >
                <svg className="w-3.5 h-3.5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span className="text-gray-300 text-sm sm:text-base leading-relaxed">{text}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="#analyzer-tool"
            className="inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30 text-base px-8 py-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-900 focus-visible:ring-brand-500"
          >
            Analyze your audio
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </Link>
          <Link
            href="#how-it-works"
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors py-2 px-2"
          >
            See how it works
          </Link>
        </div>
      </section>

      <Hero />

      <section
        id="how-it-works"
        className="relative max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-20 scroll-mt-24"
        aria-labelledby="how-heading"
      >
        <div className="text-center mb-12 sm:mb-14">
          <p className="text-brand-400 text-xs font-semibold uppercase tracking-widest mb-3">
            How it works
          </p>
          <h2 id="how-heading" className="text-white text-2xl sm:text-3xl md:text-4xl font-bold max-w-2xl mx-auto">
            Upload → Analyze → Get settings
          </h2>
          <p className="text-gray-500 mt-3 text-sm sm:text-base max-w-lg mx-auto">
            Three steps from a raw clip to usable compressor starting points.
          </p>
        </div>

        <ol className="grid md:grid-cols-3 gap-6 md:gap-4 lg:gap-6 list-none p-0 m-0">
          {STEPS.map((step, i) => (
            <li key={step.n} className="relative min-w-0">
              {i > 0 && (
                <div
                  className="hidden md:flex absolute -left-3 lg:-left-4 top-1/2 -translate-y-1/2 z-10 text-brand-500/45 pointer-events-none"
                  aria-hidden
                >
                  <ArrowRight className="w-5 h-5 -translate-x-1" />
                </div>
              )}
              <div className="h-full bg-surface-800 border border-surface-700 rounded-2xl p-6 sm:p-7 shadow-xl shadow-black/15 hover:border-surface-600 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-400 font-mono text-sm font-bold">
                    {step.n}
                  </span>
                  <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                </div>
                <p className="text-gray-500 text-sm leading-relaxed">{step.body}</p>
              </div>
              {i < STEPS.length - 1 && (
                <div className="md:hidden flex justify-center py-2 text-brand-500/40" aria-hidden>
                  <svg width="20" height="28" viewBox="0 0 20 28" fill="none" className="mx-auto">
                    <path
                      d="M10 0v22M10 22l-4-5M10 22l4-5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section
        id="faq"
        className="relative max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-20 border-t border-surface-800 scroll-mt-24"
        aria-labelledby="faq-heading"
      >
        <h2 id="faq-heading" className="text-white text-2xl sm:text-3xl font-bold text-center mb-3">
          Frequently asked questions
        </h2>
        <p className="text-gray-500 text-sm text-center mb-10 max-w-md mx-auto">
          Straight answers before you drop in your first file.
        </p>
        <div className="space-y-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group bg-surface-800 border border-surface-700 rounded-xl px-4 sm:px-5 open:border-surface-600 open:shadow-lg open:shadow-black/10 transition-colors"
            >
              <summary className="cursor-pointer list-none py-4 font-medium text-white text-sm sm:text-base flex items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                <span>{item.q}</span>
                <span className="shrink-0 text-gray-500 group-open:rotate-180 transition-transform text-lg leading-none">
                  ▼
                </span>
              </summary>
              <p className="text-gray-500 text-sm leading-relaxed pb-4 pr-2 border-t border-surface-700/80 pt-3 mt-0">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
