import { useState } from "react";
import type { Message, Source } from "../lib/types";

interface Props {
  message: Message;
}

export function MessageBubble({ message }: Props) {
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
        </div>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {message.sources.map((src, i) => (
              <SourceCard key={i} source={src} index={i + 1} />
            ))}
          </div>
        )}

        {/* Footer row */}
        <div className="flex items-center gap-3 mt-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

function SourceCard({ source, index }: { source: Source; index: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <button
      onClick={() => setExpanded(v => !v)}
      className="text-left bg-[#1e1f20] hover:bg-[#282a2c] border border-[#303134] rounded-2xl px-3 py-2 transition-colors inline-flex items-start gap-2 max-w-xs"
    >
      <span className="flex-shrink-0 w-4 h-4 rounded-full bg-[#303134] text-[9px] font-bold text-[#e8eaed] flex items-center justify-center mt-0.5">
        {index}
      </span>
      <div className="min-w-0">
        <span className="text-[12px] font-medium text-[#e8eaed] truncate block">
          {source.file}{source.page ? ` · p.${source.page}` : ""}
        </span>
        {expanded && source.passage && (
          <p className="text-[11px] text-[#9aa0a6] mt-1 leading-relaxed line-clamp-3">{source.passage}</p>
        )}
      </div>
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
