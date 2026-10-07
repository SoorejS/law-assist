import type { EngineStatus } from "../lib/types";

interface Props {
  engineStatus: EngineStatus;
  selectedFolder: string | null;
  messageCount: number;
  onClearChat: () => void;
  onExportWord?: () => void;
}

export function Header({ engineStatus, selectedFolder, messageCount, onClearChat, onExportWord }: Props) {
  return (
    <header
      className="flex-shrink-0 h-14 bg-[#131314] flex items-center justify-between px-6 z-20"
      data-tauri-drag-region
    >
      {/* Left: context breadcrumb */}
      <div className="flex items-center gap-2 text-[#e8eaed] font-medium pointer-events-none">
        {selectedFolder && (
          <span className="text-lg">{selectedFolder}</span>
        )}
      </div>

      {/* Right: status + actions */}
      <div className="flex items-center gap-3">
        {/* Engine status indicator */}
        <EngineStatusBadge status={engineStatus} />

        {/* Export Case Brief Word button */}
        {selectedFolder && onExportWord && (
          <button
            onClick={onExportWord}
            className="text-xs bg-[#1e1f20] hover:bg-blue-600/20 text-[#c4c7c5] hover:text-blue-300 border border-[#303134] hover:border-blue-500/40 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 transition-all shadow-sm"
            title="Export full executive case brief as Microsoft Word (.docx)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
            <span>Export Brief (.docx)</span>
          </button>
        )}

        {/* Clear chat */}
        {messageCount > 0 && (
          <button
            onClick={onClearChat}
            className="text-slate-400 hover:text-slate-600 text-xs flex items-center gap-1 transition-colors"
            title="Clear conversation"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    ready: { dot: "bg-green-400", label: "Engine ready", text: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
    starting: { dot: "bg-amber-400 animate-pulse", label: "Starting…", text: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
    offline: { dot: "bg-red-400", label: "Engine offline", text: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
  };
  const c = configs[status];

  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  );
}
