import { useEffect, useState } from "react";

export function UpdateBanner() {
  const [update, setUpdate] = useState<{ available: boolean; latest?: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check for updates once on mount
    fetch("http://localhost:8765/update/available")
      .then(r => r.json())
      .then(data => {
        if (data.update_available) setUpdate({ available: true, latest: data.latest });
      })
      .catch(() => {}); // Non-fatal
  }, []);

  if (!update?.available || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-blue-600/90 backdrop-blur-sm border-b border-blue-500/50 px-6 py-2.5 flex items-center justify-between">
      <p className="text-white text-sm font-medium">
        🎉 law-assist {update.latest} is available — you're on 1.0.0
      </p>
      <div className="flex items-center gap-3">
        <a
          href="https://law-assist.com/download"
          target="_blank"
          rel="noreferrer"
          className="bg-white text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-blue-50 transition-colors"
        >
          Download Update
        </a>
        <button
          onClick={() => setDismissed(true)}
          className="text-white/70 hover:text-white transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
