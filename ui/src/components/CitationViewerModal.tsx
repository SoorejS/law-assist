import { useEffect, useState } from "react";
import type { Source } from "../lib/types";

interface Props {
  source: Source | null;
  onClose: () => void;
}

export function CitationViewerModal({ source, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!source) return null;

  const similarityPercent = Math.max(0, Math.min(100, Math.round((1 - (source.distance || 0)) * 100)));

  const handleCopyCitation = () => {
    const cite = `[Source: ${source.file}${source.page ? `, Page ${source.page}` : ""}${source.section ? ` (§ ${source.section})` : ""}]\n"${source.passage}"`;
    navigator.clipboard.writeText(cite).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div
        className="bg-[#161a23] border border-[#2d323f] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#2d323f] bg-[#1a1f2c]">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center flex-shrink-0 border border-blue-500/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-white truncate" title={source.file}>
                {source.file}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                {source.page && (
                  <span className="text-xs bg-[#202532] text-slate-300 px-2.5 py-0.5 rounded-full font-semibold border border-[#2d323f]">
                    Page {source.page}
                  </span>
                )}
                {source.section && (
                  <span className="text-xs bg-[#202532] text-slate-300 px-2.5 py-0.5 rounded-full font-semibold truncate max-w-[200px] border border-[#2d323f]" title={source.section}>
                    § {source.section}
                  </span>
                )}
                <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  {similarityPercent}% match
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-[#202532] transition-colors ml-3 text-lg font-bold"
            title="Close (Esc)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content Excerpt */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300">
              Verified Source Excerpt
            </span>
            <button
              onClick={handleCopyCitation}
              className="text-xs sm:text-sm font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-xl border border-blue-500/30 transition-colors"
            >
              {copied ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  Copied Citation
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copy Citation
                </>
              )}
            </button>
          </div>

          <div className="p-5 rounded-xl bg-[#11131a] border border-[#2d323f] text-slate-100 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-sans select-text selection:bg-blue-600/40">
            {source.passage || "No direct text excerpt available."}
          </div>

          <div className="bg-[#1a1f2c]/60 border border-[#2d323f] rounded-xl p-3.5 flex items-center justify-between text-xs sm:text-sm text-slate-300 font-medium">
            <span>Vector distance metric: <code className="text-white font-mono bg-black/40 px-2 py-0.5 rounded">{source.distance?.toFixed(4) ?? "N/A"}</code></span>
            <span className="text-blue-400 font-semibold">Cryptographic Local Source Assurance</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#2d323f] bg-[#1a1f2c]/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[#202532] hover:bg-[#2c3344] text-white text-xs sm:text-sm font-bold rounded-xl transition-colors border border-[#2d323f]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
