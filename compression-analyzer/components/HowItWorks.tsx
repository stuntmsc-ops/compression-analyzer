const STEPS = [
  {
    step: "01",
    title: "Upload Your Audio",
    description: "Drop in a short clip of your vocal, instrument, or full mix.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    ),
  },
  {
    step: "02",
    title: "We Analyze the Dynamics",
    description: "The tool measures your actual peak levels, dynamic range, and transient profile.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
    ),
  },
  {
    step: "03",
    title: "Get Your Settings",
    description: "Receive ratio, attack, release, and threshold tuned to your specific audio.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    ),
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
      <div className="text-center mb-12">
        <h2 className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-3">
          How It Works
        </h2>
        <p className="text-white text-2xl sm:text-3xl font-bold max-w-xl mx-auto">
          From upload to dialed-in settings in under 60 seconds
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        {STEPS.map((item) => (
          <div
            key={item.step}
            className="bg-surface-800 border border-surface-700 rounded-2xl p-6 hover:border-surface-500 transition-colors group"
          >
            <div className="w-10 h-10 bg-brand-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-brand-500/20 transition-colors">
              <svg
                className="w-5 h-5 text-brand-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {item.icon}
              </svg>
            </div>
            <div className="text-brand-500 font-mono text-xs mb-2 tracking-wider">
              {item.step}
            </div>
            <h3 className="text-white font-semibold mb-2 text-lg">
              {item.title}
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}