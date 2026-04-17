export default function Footer() {
  return (
    <footer className="border-t border-surface-700 mt-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-600 text-xs sm:text-sm text-center sm:text-left">
            © 2026 Compression Analyzer. Built for producers and engineers.
          </p>
          <div className="flex items-center gap-5">
            <a
              href="#"
              className="text-gray-600 hover:text-gray-300 text-sm transition-colors"
            >
              Privacy
            </a>
            <a
              href="#"
              className="text-gray-600 hover:text-gray-300 text-sm transition-colors"
            >
              Contact
            </a>
            <a
              href="#"
              className="text-gray-600 hover:text-gray-300 text-sm transition-colors"
            >
              Blog
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}