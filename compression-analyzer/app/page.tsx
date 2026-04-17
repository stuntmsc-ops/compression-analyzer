export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="font-semibold text-white text-lg">
              Compression Analyzer
            </span>
          </div>
          <button className="text-sm text-gray-400 hover:text-white transition-colors">
            Upgrade to Pro
          </button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="max-w-4xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
            <span className="text-blue-400 text-sm font-medium">
              Audio-Powered Compression Settings
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6 leading-tight">
            Stop Guessing Your <span className="text-blue-400"> Compression Settings</span>
          </h1>
          <p className="text-gray-400 text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
            Upload your audio and get personalized compression settings based on the actual dynamics of your sound — not generic numbers from a chart.
          </p>

          {/* Tool placeholder */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 max-w-2xl mx-auto">
            <div className="border-2 border-dashed border-gray-700 rounded-xl p-10 text-center">
              <div className="w-12 h-12 bg-gray-800 rounded-xl mx-auto mb-4 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-gray-400 font-medium mb-1">
                Upload your audio here
              </p>
              <p className="text-gray-600 text-sm">
                Coming in Day 3 — WAV, MP3, FLAC supported
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-4xl mx-auto px-6 pb-20">
          <h2 className="text-center text-gray-400 text-sm font-semibold uppercase tracking-widest mb-10">
            How It Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Upload Your Audio",
                description: "Drop in a short clip of your vocal, instrument, or full mix.",
              },
              {
                step: "02",
                title: "We Analyze the Dynamics",
                description: "The tool measures your actual peak levels, dynamic range, and transient profile.",
              },
              {
                step: "03",
                title: "Get Your Settings",
                description: "Receive ratio, attack, release, and threshold — tuned to your specific audio.",
              },
            ].map((item) => (
              <div key={item.step} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <div className="text-blue-500 font-bold text-sm mb-3">{item.step}</div>
                <h3 className="text-white font-semibold mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-600 text-sm">
            © 2026 Compression Analyzer. Built for producers and engineers.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-gray-600 hover:text-gray-400 text-sm transition-colors">
              Privacy
            </a>
            <a href="#" className="text-gray-600 hover:text-gray-400 text-sm transition-colors">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
