import { useState } from "react";

const STEPS = [
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8ab4f8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    ),
    title: "Add your sources",
    body: "Create a notebook for each legal matter. Then click 'Add sources' in the left panel to upload your PDFs, DOCX files, or any documents you want to analyse.",
    cta: "Next →",
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8ab4f8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    title: "Ask anything about your documents",
    body: "Use the chat to ask questions about your case files. law-assist answers only from your documents and always provides citations — no hallucinations.",
    cta: "Next →",
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8ab4f8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    title: "AI Intelligence — auto-extracted",
    body: "The 'Notebook guide' on the right extracts a Timeline of Events, Key People, Contradictions, and Missing Evidence from your documents automatically.",
    cta: "Get started",
  },
];

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1e1f20] border border-[#303134] rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 relative">
        {/* Skip */}
        <button
          onClick={onComplete}
          className="absolute top-4 right-4 text-[#9aa0a6] hover:text-[#e8eaed] text-xs font-medium transition-colors"
        >
          Skip
        </button>

        {/* Step indicator */}
        <div className="flex gap-1.5 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === step ? "bg-[#8ab4f8] w-6" : "bg-[#303134] w-3"
              }`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-[#303134] flex items-center justify-center mb-6">
          {current.icon}
        </div>

        {/* Content */}
        <h2 className="text-xl font-semibold text-[#e8eaed] mb-3">{current.title}</h2>
        <p className="text-[#9aa0a6] text-sm leading-relaxed mb-8">{current.body}</p>

        {/* CTA */}
        <button
          onClick={() => {
            if (isLast) onComplete();
            else setStep(s => s + 1);
          }}
          className="w-full bg-[#8ab4f8] hover:bg-blue-400 text-[#131314] font-semibold py-3 rounded-xl transition-colors"
        >
          {current.cta}
        </button>
      </div>
    </div>
  );
}
