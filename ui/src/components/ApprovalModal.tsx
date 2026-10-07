import React from "react";

interface ApprovalModalProps {
  isOpen: boolean;
  title: string;
  actionDescription: string;
  dataScope?: string;
  privacyBadgeText?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDangerous?: boolean;
  onApprove: () => void;
  onCancel: () => void;
}

export function ApprovalModal({
  isOpen,
  title,
  actionDescription,
  dataScope,
  privacyBadgeText = "Offline PII Filter Active: Personal identifiers (PAN, Aadhaar, phone, email) redacted prior to transmission.",
  confirmLabel = "Approve Action",
  cancelLabel = "Cancel (Stay Local)",
  isDangerous = false,
  onApprove,
  onCancel,
}: ApprovalModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#1e1f20] border border-[#303134] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden">
        {/* Top Accent bar */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 ${isDangerous ? "bg-amber-500" : "bg-gradient-to-r from-blue-500 to-indigo-500"}`} />

        {/* Header with icon */}
        <div className="flex items-start gap-3.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                Action Approval Gate
              </span>
            </div>
            <h3 className="text-lg font-semibold text-[#e8eaed] mt-1">{title}</h3>
          </div>
        </div>

        {/* Action description */}
        <p className="text-[13px] text-[#bdc1c6] leading-relaxed mb-4">
          {actionDescription}
        </p>

        {/* Data Scope details */}
        {dataScope && (
          <div className="bg-[#131314] rounded-xl p-3 border border-[#303134] mb-4 text-xs space-y-1">
            <span className="text-[#9aa0a6] font-medium block">Data Scope:</span>
            <span className="text-[#e8eaed] font-mono text-[11px] block break-all">{dataScope}</span>
          </div>
        )}

        {/* Privacy badge */}
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs mb-6">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className="leading-tight text-[11px]">{privacyBadgeText}</span>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#303134]">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-medium text-[#bdc1c6] hover:text-white bg-[#303134]/60 hover:bg-[#303134] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onApprove}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/20 transition-all flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
