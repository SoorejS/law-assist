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
      <div className="flex justify-end px-4">
        <div className="max-w-[72%] bg-[#303134] text-[#e8eaed] rounded-3xl px-5 py-3.5 shadow-sm">
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 px-4 py-2 group">
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center mt-1 shadow-md">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </div>

      <div className="flex-1 min-w-0 max-w-[80%]">
        {/* Answer text */}
        <div
          className={`text-[15px] leading-relaxed whitespace-pre-wrap ${
            message.isError ? "text-red-400 bg-red-900/10 border border-red-800/30 rounded-2xl px-4 py-3" : "text-[#e8eaed]"
          }`}
        >
          {message.content}
          {message.isStreaming && (
            <span className="inline-block w-1.5 h-4 ml-1 bg-blue-400 animate-pulse align-middle" />
          )}
          {message.isStreaming && !message.content && (
            <span className="text-[13px] text-blue-300/80 italic flex items-center gap-2 py-1">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-ping" />
              Retrieving statutory records & analyzing matter files...
            </span>
          )}
        </div>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 flex gap-2 flex-wrap">
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
          <div className="mt-3 pt-2.5 border-t border-[#303134]/50 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-400">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              <span>Suggested Follow-Ups:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {message.follow_ups.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectFollowUp?.(q)}
                  className="text-left text-[12px] text-blue-200 hover:text-white bg-blue-950/40 hover:bg-blue-600/30 border border-blue-800/40 hover:border-blue-400/80 rounded-xl px-3 py-1.5 transition-all flex items-center gap-2 group/chip cursor-pointer shadow-sm hover:shadow"
                  title={`Ask: "${q}"`}
                >
                  <span className="leading-snug">{q}</span>
                  <svg
                    width="11"
                    height="11"
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
        <div className={`flex items-center gap-2.5 mt-2 px-1 ${message.isStreaming ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
          {message.cached && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-700/50">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Instant Cache (0ms)
            </span>
          )}
          {message.isStreaming && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-950/60 text-blue-300 border border-blue-700/50 animate-pulse">
              Streaming...
            </span>
          )}
          {message.timing && (
            <>
              <BackendBadge backend={message.backend!} escalated={!!message.escalated} />
              <span className="text-[10px] text-[#9aa0a6]">
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
              className="flex items-center gap-1 text-[10px] text-[#9aa0a6] hover:text-[#e8eaed] transition-colors rounded-md px-1.5 py-0.5 hover:bg-[#303134]"
              title="Copy response"
            >
              {copied ? (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copy
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
      className="text-left bg-[#1e1f20] hover:bg-[#282a2c] border border-[#303134] hover:border-blue-500/50 rounded-2xl px-3 py-2 transition-all inline-flex items-center gap-2 max-w-xs group/card cursor-pointer shadow-sm hover:shadow"
      title="Click to view verified source excerpt"
    >
      <span className="flex-shrink-0 w-4 h-4 rounded-full bg-[#303134] group-hover/card:bg-blue-600/30 group-hover/card:text-blue-300 text-[9px] font-bold text-[#e8eaed] flex items-center justify-center transition-colors">
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <span className="text-[12px] font-medium text-[#e8eaed] group-hover/card:text-blue-200 truncate block">
          {source.file}{source.page ? ` · p.${source.page}` : ""}
        </span>
      </div>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#9aa0a6] group-hover/card:text-blue-300 flex-shrink-0 ml-0.5">
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
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
      isCloud
        ? "bg-amber-900/30 text-amber-400 border border-amber-700/40"
        : "bg-emerald-900/30 text-emerald-400 border border-emerald-700/40"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isCloud ? "bg-amber-400" : "bg-emerald-400"}`} />
      {isCloud ? `cloud · ${backend}` : `local · ${backend}`}
    </span>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3 px-4 py-2">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </div>
      <div className="bg-[#1e1f20] border border-[#303134] rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-center gap-1.5 h-4">
          {[0, 150, 300].map((d, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[#9aa0a6] animate-bounce"
              style={{ animationDelay: `${d}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
