import type { EngineStatus } from "../lib/types";
import { useFontScale } from "../hooks/useFontScale";

interface Props {
  engineStatus: EngineStatus;
  selectedFolder: string | null;
  messageCount: number;
  onClearChat: () => void;
  onExportWord?: () => void;
}

export function Header({ engineStatus, selectedFolder, messageCount, onClearChat, onExportWord }: Props) {
  const { fontScale, cycleFontScale } = useFontScale();

  const fontScaleLabel = {
    normal: "Standard (100%)",
    large: "Large (115%)",
    xlarge: "Extra Large (130%)",
  }[fontScale];

  return (
    <header
      className="flex-shrink-0 h-16 bg-[#0d0f14] border-b border-[#232834] flex items-center justify-between px-6 sm:px-8 z-20"
      data-tauri-drag-region
    >
      {/* Left: context breadcrumb */}
      <div className="flex items-center gap-3 text-white font-semibold pointer-events-none">
        {selectedFolder && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight text-white">{selectedFolder}</span>
          </div>
        )}
      </div>

      {/* Right: status + font scale + actions */}
      <div className="flex items-center gap-3">
        {/* Reading Comfort Font Scaler */}
        <button
          onClick={cycleFontScale}
          title="Toggle Text Size for Reading Comfort"
          className="flex items-center gap-1.5 bg-[#181b22] hover:bg-[#222733] border border-[#2d323f] hover:border-blue-500/40 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-200 transition-colors cursor-pointer shadow-sm"
        >
          <span className="text-blue-400 font-bold text-sm">A±</span>
          <span className="hidden sm:inline text-slate-300">Size:</span>
          <span className="text-blue-300 font-medium">{fontScaleLabel}</span>
        </button>

        {/* Engine status indicator */}
        <EngineStatusBadge status={engineStatus} />

        {/* Export Case Brief Word button */}
        {selectedFolder && onExportWord && (
          <button
            onClick={onExportWord}
            className="text-xs sm:text-sm font-semibold bg-[#181b22] hover:bg-[#222733] text-slate-200 hover:text-white border border-[#2d323f] hover:border-blue-500/40 rounded-xl px-3.5 py-1.5 flex items-center gap-2 transition-all shadow-sm cursor-pointer"
            title="Export full executive case brief as Microsoft Word (.docx)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
            <span className="hidden sm:inline">Export Brief (.docx)</span>
          </button>
        )}

        {/* Clear chat */}
        {messageCount > 0 && (
          <button
            onClick={onClearChat}
            className="text-slate-400 hover:text-slate-200 text-xs sm:text-sm font-medium flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[#181b22] transition-colors cursor-pointer"
            title="Clear conversation"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            Clear
          </button>
        )}
      </div>
    </header>
  );
}

function EngineStatusBadge({ status }: { status: EngineStatus }) {
  const configs = {
    ready: { dot: "bg-emerald-400", label: "Engine Active", text: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/30" },
    starting: { dot: "bg-amber-400 animate-pulse", label: "Starting AI…", text: "text-amber-300", bg: "bg-amber-500/10 border-amber-500/30" },
    offline: { dot: "bg-red-400", label: "Engine Offline", text: "text-red-300", bg: "bg-red-500/10 border-red-500/30" },
  };
  const c = configs[status];

  return (
    <span className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full border ${c.bg} ${c.text} shadow-sm`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  );
}
