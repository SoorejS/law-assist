import { useEffect, useRef, useState, useCallback } from "react";
import type { Message } from "../lib/types";
import { MessageBubble, TypingIndicator } from "./MessageBubble";

interface Props {
  messages: Message[];
  isLoading: boolean;
  selectedFolder: string | null;
  matterTitle?: string;
  onSend: (query: string, forceCloud: boolean) => void;
  onClearChat?: () => void;
}

const SAMPLE_QUERIES = [
  "What is the FIR number for this case?",
  "Summarise the key facts of this matter",
  "Who are the parties involved?",
  "What was the court order on [date]?",
  "Find all evidence related to [person]",
];

export function ChatView({ messages, isLoading, selectedFolder, matterTitle, onSend, onClearChat }: Props) {
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
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }, [input]);

  const handleSend = useCallback(() => {
    const q = input.trim();
    if (!q || isLoading) return;
    onSend(q, forceCloud);
    setInput("");
  }, [input, isLoading, forceCloud, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#131314]">
      {/* Scope banner */}
      {selectedFolder && (
        <div className="flex-shrink-0 bg-blue-50 border-b border-blue-100 px-5 py-2 flex items-center gap-2">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#2563eb"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-xs text-blue-700 font-medium">
            Searching within:{" "}
            <span className="font-semibold">{selectedFolder}</span>
          </span>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {isEmpty && !isLoading ? (
          <EmptyState onQuery={(q) => { setInput(q); textareaRef.current?.focus(); }} />
        ) : (
          <>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {isLoading && <TypingIndicator />}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 bg-transparent px-8 py-6">
        <div className="flex items-end gap-3 max-w-4xl mx-auto w-full">
          <div className="flex-1 bg-[#1e1f20] border border-[#303134] rounded-[24px] focus-within:border-[#8ab4f8] transition-all flex items-end px-2 py-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question or create something"
              rows={1}
              disabled={isLoading}
              className="w-full bg-transparent px-4 py-2.5 text-[15px] text-[#e8eaed] placeholder:text-[#9aa0a6] outline-none resize-none leading-relaxed disabled:opacity-50"
            />
          </div>

          {/* Cloud toggle */}
          <button
            onClick={() => setForceCloud((v) => !v)}
            title={forceCloud ? "Using cloud AI (click to switch to local)" : "Using local AI (click to force cloud)"}
            className={`flex-shrink-0 p-2.5 rounded-xl border transition-colors ${
              forceCloud
                ? "bg-amber-50 border-amber-300 text-amber-600"
                : "bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-600"
            }`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
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
            className="flex-shrink-0 w-10 h-10 rounded-full bg-[#303134] disabled:opacity-40 disabled:cursor-not-allowed text-[#e8eaed] flex items-center justify-center transition-colors mb-1 mr-1"
          >
            {isLoading ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-spin"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
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

        {/* Hint */}
        <div className="flex items-center justify-center mt-2 px-1 max-w-4xl mx-auto w-full">
          <p className="text-[11px] text-[#9aa0a6]">
            Answers are grounded in your documents only. All data stays on this machine.
          </p>
          {forceCloud && (
            <span className="text-[11px] text-amber-600 font-medium ml-4">
              ☁ Cloud mode active
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onQuery }: { onQuery: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 text-center animate-fade-in w-full max-w-2xl mx-auto">
      <div className="text-4xl mb-6">👋</div>
      <h2 className="text-[#e8eaed] font-medium text-3xl mb-4 tracking-tight">
        Let's start your notebook...
      </h2>
      <p className="text-[#9aa0a6] text-sm leading-relaxed mb-10 max-w-xl">
        This is your blank canvas to understand, create, or make progress on something new. I can help you get started or you can go ahead and add your own sources.
      </p>

      <div className="w-full text-left mb-4">
        <p className="text-[#e8eaed] text-sm font-medium mb-3">What would you like this notebook to help you do?</p>
      </div>
      <div className="flex flex-col gap-3 w-full">
        {SAMPLE_QUERIES.slice(0, 3).map((q, i) => (
          <button
            key={i}
            onClick={() => onQuery(q)}
            className="text-left text-[13px] text-[#e8eaed] bg-[#1e1f20] border border-[#303134] rounded-[20px] px-5 py-3 hover:bg-[#282a2c] transition-colors w-max"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
