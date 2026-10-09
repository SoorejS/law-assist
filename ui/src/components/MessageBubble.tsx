import { useState } from "react";
import type { Message, Source } from "../lib/types";

interface Props {
  message: Message;
  onSelectSource?: (source: Source) => void;
  onSelectFollowUp?: (question: string) => void;
}

export function MessageBubble({ message, onSelectSource, onSelectFollowUp }: Props) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (isUser) {
    return (
      <div className="flex justify-end px-2">
        <div className="max-w-[80%] bg-[#1c2230] border border-[#2c364c] text-white rounded-3xl px-6 py-4 shadow-md">
          <p className="text-base sm:text-lg leading-relaxed whitespace-pre-wrap font-medium">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 px-2 py-3 group">
      {/* Avatar */}
      <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center mt-1 shadow-lg shadow-blue-600/30">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </div>

      <div className="flex-1 min-w-0 max-w-[85%]">
        {/* Answer text */}
        <div
          className={`text-base sm:text-[17px] leading-relaxed whitespace-pre-wrap font-normal ${
            message.isError
              ? "text-red-300 bg-red-950/20 border-2 border-red-800/40 rounded-2xl px-5 py-4"
              : "text-slate-100"
          }`}
        >
          {message.content}
          {message.isStreaming && (
            <span className="inline-block w-2 h-5 ml-1.5 bg-blue-400 animate-pulse align-middle" />
          )}
          {message.isStreaming && !message.content && (
            <span className="text-sm sm:text-base text-blue-300 italic flex items-center gap-2.5 py-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
              Retrieving statutory records & analyzing matter files...
            </span>
          )}
        </div>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-4 flex gap-2.5 flex-wrap">
            {message.sources.map((src, i) => (
              <SourceCard
                key={i}
                source={src}
                index={i + 1}
                onClick={() => onSelectSource ? onSelectSource(src) : undefined}
              />
            ))}
          </div>
        )}

        {/* Smart Contextual Follow-Up Suggestions */}
        {message.follow_ups && message.follow_ups.length > 0 && !message.isError && (
          <div className="mt-4 pt-3.5 border-t border-[#252b38] flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-blue-300">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              <span>Suggested Next Inquiries:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {message.follow_ups.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectFollowUp?.(q)}
                  className="text-left text-xs sm:text-sm text-blue-100 hover:text-white bg-blue-950/50 hover:bg-blue-600/30 border border-blue-700/50 hover:border-blue-400 rounded-xl px-3.5 py-2 transition-all flex items-center gap-2 group/chip cursor-pointer shadow-sm hover:shadow"
                  title={`Ask: "${q}"`}
                >
                  <span className="leading-snug font-medium">{q}</span>
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-blue-400 group-hover/chip:translate-x-0.5 transition-transform flex-shrink-0"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer row */}
        <div className={`flex items-center gap-3 mt-3 px-1 ${message.isStreaming ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
          {message.cached && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-700/50">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Instant Cache (0ms)
            </span>
          )}
          {message.isStreaming && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-950/60 text-blue-300 border border-blue-700/50 animate-pulse">
              Generating...
            </span>
          )}
          {message.timing && (
            <>
              <BackendBadge backend={message.backend!} escalated={!!message.escalated} />
              <span className="text-xs text-slate-400 font-medium">
                {message.timing.total_ms < 1000
                  ? `${message.timing.total_ms}ms`
                  : `${(message.timing.total_ms / 1000).toFixed(1)}s`}
              </span>
            </>
          )}
          {/* Copy button */}
          {!message.isError && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors rounded-lg px-2.5 py-1 hover:bg-[#181b22] border border-transparent hover:border-[#2d323f] cursor-pointer"
              title="Copy response to clipboard"
            >
              {copied ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  <span className="text-emerald-300">Copied</span>
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SourceCard({ source, index, onClick }: { source: Source; index: number; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-[#151821] hover:bg-[#1c2230] border border-[#272d3c] hover:border-blue-500/60 rounded-xl px-3.5 py-2.5 transition-all inline-flex items-center gap-2.5 max-w-sm group/card cursor-pointer shadow-sm hover:shadow"
      title="Click to view verified source citation & page excerpt"
    >
      <span className="flex-shrink-0 w-5 h-5 rounded-md bg-[#232938] group-hover/card:bg-blue-600/30 group-hover/card:text-blue-300 text-xs font-bold text-slate-200 flex items-center justify-center transition-colors">
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <span className="text-xs sm:text-sm font-semibold text-slate-200 group-hover/card:text-blue-200 truncate block">
          {source.file}{source.page ? ` · Page ${source.page}` : ""}
        </span>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover/card:text-blue-300 flex-shrink-0 ml-0.5">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </button>
  );
}

function BackendBadge({ backend, escalated }: { backend: string; escalated: boolean }) {
  if (backend === "none" || backend === "error") return null;
  const isCloud = escalated;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
      isCloud
        ? "bg-amber-900/30 text-amber-300 border border-amber-700/50"
        : "bg-emerald-900/30 text-emerald-300 border border-emerald-700/50"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isCloud ? "bg-amber-400" : "bg-emerald-400"}`} />
      {isCloud ? `cloud · ${backend}` : `local · ${backend}`}
    </span>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex gap-4 px-2 py-3">
      <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </div>
      <div className="bg-[#181b22] border border-[#2d323f] rounded-2xl rounded-tl-sm px-5 py-4">
        <div className="flex items-center gap-2 h-4">
          {[0, 150, 300].map((d, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
              style={{ animationDelay: `${d}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
