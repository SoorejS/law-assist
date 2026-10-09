import { useEffect, useRef, useState, useCallback } from "react";
import type { Message, Source } from "../lib/types";
import { MessageBubble, TypingIndicator } from "./MessageBubble";

interface Props {
  messages: Message[];
  isLoading: boolean;
  selectedFolder: string | null;
  matterTitle?: string;
  onSend: (query: string, forceCloud: boolean) => void;
  onClearChat?: () => void;
  onSelectSource?: (source: Source) => void;
  onRequestApproval?: (opts: {
    title: string;
    actionDescription: string;
    dataScope?: string;
    onApprove: () => void;
  }) => void;
}

const SAMPLE_QUERIES = [
  "What is the FIR / Case number and who are all the parties involved?",
  "Construct a complete chronological timeline of events with dates and citations",
  "What are the critical statutory limitation periods, deadlines, or court hearings?",
  "Analyze indemnity liabilities, penalty clauses, and unilateral contract terms",
  "Summarize the key factual merits and draft an executive client advisory note",
];

export function ChatView({
  messages,
  isLoading,
  selectedFolder,
  matterTitle,
  onSend,
  onClearChat: _onClearChat,
  onSelectSource,
  onRequestApproval,
}: Props) {
  const [input, setInput] = useState("");
  const [forceCloud, setForceCloud] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
  }, [input]);

  const toggleCloud = () => {
    if (!forceCloud && onRequestApproval) {
      onRequestApproval({
        title: "Enable Cloud AI Escalation",
        actionDescription: "Switching to Cloud AI mode allows deep reasoning models to assist with complex synthesis. All PAN, Aadhaar, phone numbers, and emails are automatically scrubbed locally by the offline PII filter before transmission.",
        dataScope: `Matter: ${matterTitle || selectedFolder || "Active Dossier"}`,
        onApprove: () => setForceCloud(true),
      });
    } else {
      setForceCloud(false);
    }
  };

  const handleSend = useCallback(() => {
    const q = input.trim();
    if (!q || isLoading) return;

    if (forceCloud && onRequestApproval) {
      onRequestApproval({
        title: "Cloud AI Query Gate",
        actionDescription: `Your query will be sent to the cloud AI with document excerpts. All sensitive identifiers will be redacted locally before transmission.`,
        dataScope: `Query: "${q.slice(0, 80)}${q.length > 80 ? "..." : ""}"`,
        onApprove: () => {
          onSend(q, true);
          setInput("");
        },
      });
      return;
    }

    onSend(q, forceCloud);
    setInput("");
  }, [input, isLoading, forceCloud, onSend, onRequestApproval, matterTitle, selectedFolder]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#0d0f14]">
      {/* Scope banner */}
      {selectedFolder && (
        <div className="flex-shrink-0 bg-[#141822] border-b border-[#232834] px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#60a5fa"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-sm text-slate-300 font-medium">
              Active Matter Scope:{" "}
              <span className="font-bold text-white text-base">{matterTitle || selectedFolder}</span>
            </span>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
            Encrypted Local Memory
          </span>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-12 py-8 space-y-6">
        {isEmpty && !isLoading ? (
          <EmptyState
            matterTitle={matterTitle || selectedFolder}
            onQuery={(q) => {
              setInput(q);
              textareaRef.current?.focus();
            }}
          />
        ) : (
          <>
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                onSelectSource={onSelectSource}
                onSelectFollowUp={(q) => {
                  if (!isLoading) {
                    onSend(q, forceCloud);
                  }
                }}
              />
            ))}
            {isLoading && !messages.some((m) => m.isStreaming) && <TypingIndicator />}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input container */}
      <div className="flex-shrink-0 bg-[#0d0f14]/90 backdrop-blur-md px-6 sm:px-12 py-6 border-t border-[#232834]">
        <div className="flex items-end gap-3.5 max-w-4xl mx-auto w-full">
          <div className="flex-1 bg-[#181b22] border-2 border-[#2d323f] focus-within:border-blue-500 rounded-3xl transition-all flex items-end px-3 py-2.5 shadow-xl">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask any question about this case dossier or enter drafting instructions..."
              rows={1}
              disabled={isLoading}
              className="w-full bg-transparent px-4 py-2 text-base sm:text-lg text-white placeholder:text-slate-400 outline-none resize-none leading-relaxed disabled:opacity-50 font-medium"
            />
          </div>

          {/* Cloud toggle */}
          <button
            onClick={toggleCloud}
            title={forceCloud ? "Using Cloud AI (click to use local offline model)" : "Using Local Offline AI (click to escalate to Cloud)"}
            className={`flex-shrink-0 p-3.5 rounded-2xl border transition-all cursor-pointer shadow-sm ${
              forceCloud
                ? "bg-amber-500/20 border-amber-400 text-amber-300 shadow-amber-500/20"
                : "bg-[#181b22] border-[#2d323f] text-slate-400 hover:text-slate-200 hover:border-slate-500"
            }`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            </svg>
          </button>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 w-12 h-12 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all mb-0.5 shadow-lg shadow-blue-600/30 cursor-pointer"
          >
            {isLoading ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-spin"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>

        {/* Footnote reassurance */}
        <div className="flex items-center justify-center mt-3 px-2 max-w-4xl mx-auto w-full text-center">
          <p className="text-xs sm:text-sm text-slate-400 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            100% Private & Grounded in your files. Documents never leave this device without authorization.
          </p>
          {forceCloud && (
            <span className="text-xs sm:text-sm text-amber-400 font-bold ml-4">
              ☁ Cloud Reasoning Active
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ matterTitle, onQuery }: { matterTitle?: string | null; onQuery: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12 text-center animate-fade-in w-full max-w-3xl mx-auto">
      <div className="w-16 h-16 rounded-3xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mb-6 text-3xl shadow-lg shadow-blue-500/10">
        ⚖️
      </div>
      <h2 className="text-white font-bold text-3xl sm:text-4xl mb-3 tracking-tight">
        {matterTitle ? `Matter Workspace: ${matterTitle}` : "Legal AI Workspace"}
      </h2>
      <p className="text-slate-300 text-base sm:text-lg leading-relaxed mb-8 max-w-2xl font-normal">
        Your offline cognitive memory engine for case laws, court records, contracts, and filings. Select an inquiry below or type in any factual question:
      </p>

      <div className="w-full text-left mb-3">
        <p className="text-blue-300 text-xs sm:text-sm font-bold uppercase tracking-wider">
          Suggested Litigation & Case Inquiries:
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full">
        {SAMPLE_QUERIES.map((q, i) => (
          <button
            key={i}
            onClick={() => onQuery(q)}
            className="text-left text-sm sm:text-base font-semibold text-slate-100 bg-[#181b22] border border-[#2d323f] hover:border-blue-500/60 hover:bg-[#202532] rounded-2xl px-6 py-4 transition-all shadow-sm flex items-center justify-between group cursor-pointer"
          >
            <span>{q}</span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all flex-shrink-0 ml-3"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
