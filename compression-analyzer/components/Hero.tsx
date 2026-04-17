import Button from "./Button";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-brand-500/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12 sm:pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 rounded-full px-4 py-1.5 mb-6 sm:mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-400"></span>
          </span>
          <span className="text-brand-400 text-xs sm:text-sm font-medium">
            Audio-Powered Compression Settings
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-5 sm:mb-6 leading-[1.1] tracking-tight">
          Stop Guessing Your
          <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
            {" "}Compression Settings
          </span>
        </h1>

        <p className="text-gray-400 text-base sm:text-lg mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed">
          Upload your audio and get personalized compression settings based on
          the actual dynamics of your sound — not generic numbers from a chart.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
          <Button size="lg" onClick={() => document.getElementById('upload-zone')?.scrollIntoView({ behavior: 'smooth' })}>
            Analyze Your Audio
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </Button>
          <p className="text-gray-600 text-xs sm:text-sm">
            No signup to try · Free for vocals
          </p>
        </div>

        {/* Upload zone placeholder */}
        <div id="upload-zone" className="bg-surface-800 border border-surface-700 rounded-2xl p-4 sm:p-8 max-w-2xl mx-auto shadow-2xl">
          <div className="border-2 border-dashed border-surface-500 rounded-xl p-8 sm:p-12 text-center hover:border-brand-500/50 transition-colors">
            <div className="w-14 h-14 bg-surface-700 rounded-xl mx-auto mb-4 flex items-center justify-center">
              <svg
                className="w-7 h-7 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <p className="text-gray-300 font-medium mb-1.5">
              Upload your audio here
            </p>
            <p className="text-gray-600 text-sm">
              Coming in Day 3 — WAV, MP3, FLAC supported · Max 20MB
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}