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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div
        className="bg-[#1e1f20] border border-[#3c4043] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#303134] bg-[#282a2c]/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-[#e8eaed] truncate" title={source.file}>
                {source.file}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                {source.page && (
                  <span className="text-xs bg-[#303134] text-[#bdc1c6] px-2 py-0.5 rounded-full font-medium">
                    Page {source.page}
                  </span>
                )}
                {source.section && (
                  <span className="text-xs bg-[#303134] text-[#bdc1c6] px-2 py-0.5 rounded-full font-medium truncate max-w-[200px]" title={source.section}>
                    § {source.section}
                  </span>
                )}
                <span className="text-xs text-emerald-400 font-medium">
                  {similarityPercent}% match
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#9aa0a6] hover:text-[#e8eaed] p-1.5 rounded-lg hover:bg-[#303134] transition-colors ml-3"
            title="Close (Esc)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content Excerpt */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#9aa0a6]">
              Verified Source Excerpt
            </span>
            <button
              onClick={handleCopyCitation}
              className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-lg transition-colors"
            >
              {copied ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  Copied Citation
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copy Citation
                </>
              )}
            </button>
          </div>

          <div className="p-4 rounded-xl bg-[#131314] border border-[#303134] text-[#e8eaed] text-[14px] leading-relaxed whitespace-pre-wrap font-sans select-text selection:bg-blue-600/40">
            {source.passage || "No direct text excerpt available."}
          </div>

          <div className="bg-[#282a2c]/40 border border-[#303134]/60 rounded-xl p-3 flex items-center justify-between text-xs text-[#9aa0a6]">
            <span>Vector distance metric: <code className="text-[#e8eaed]">{source.distance?.toFixed(4) ?? "N/A"}</code></span>
            <span>Cryptographic Local Source Assurance</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#303134] bg-[#282a2c]/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#303134] hover:bg-[#3c4043] text-[#e8eaed] text-xs font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
