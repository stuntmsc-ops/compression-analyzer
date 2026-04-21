import Link from "next/link";
import AuthNav from "./AuthNav";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 bg-surface-900/80 backdrop-blur-md border-b border-surface-700">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 bg-gradient-to-br from-brand-400 to-brand-600 rounded-lg flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:shadow-brand-500/40 transition-shadow">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
          </div>
          <span className="font-semibold text-white text-base sm:text-lg tracking-tight">
            Compression Analyzer
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <a
            href="#how-it-works"
            className="hidden sm:inline-block text-sm text-gray-400 hover:text-white transition-colors px-3 py-2"
          >
            How it works
          </a>
          <a
            href="#faq"
            className="hidden sm:inline-block text-sm text-gray-400 hover:text-white transition-colors px-3 py-2"
          >
            FAQ
          </a>
          <AuthNav />
        </div>
      </div>
    </header>
  );
}