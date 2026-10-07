import React, { useState, useEffect } from "react";
import {
  fetchCoworkers,
  runCoworker,
  createCustomCoworker,
  deleteCustomCoworker,
  exportCoworkerBundle,
  importCoworkerBundle,
  exportMatterWord,
  exportMatterCalendarIcs,
  compareMatterDocs,
  fetchFiles,
} from "../lib/api";
import type { Coworker, CoworkerOutcome } from "../lib/types";

interface Props {
  matterId: string | null;
  matterTitle?: string;
  onRequestApproval: (opts: {
    title: string;
    actionDescription: string;
    dataScope?: string;
    onApprove: () => void;
  }) => void;
  onOutcomeGenerated?: (outcome: CoworkerOutcome) => void;
}

export function CoworkerPanel({ matterId, matterTitle, onRequestApproval, onOutcomeGenerated }: Props) {
  const [coworkers, setCoworkers] = useState<Coworker[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [activeCoworker, setActiveCoworker] = useState<Coworker | null>(null);
  const [outcome, setOutcome] = useState<CoworkerOutcome | null>(null);
  const [running, setRunning] = useState(false);
  const [runProgress, setRunProgress] = useState("");
  const [customInstruction, setCustomInstruction] = useState("");
  const [forceCloud, setForceCloud] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Document comparison states
  const [matterFiles, setMatterFiles] = useState<any[]>([]);
  const [doc1, setDoc1] = useState("");
  const [doc2, setDoc2] = useState("");
  const [diffFocus, setDiffFocus] = useState("");
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [comparing, setComparing] = useState(false);

  // Load coworkers on mount
  useEffect(() => {
    loadCoworkers();
  }, []);

  const loadCoworkers = async () => {
    setLoadingList(true);
    try {
      const res = await fetchCoworkers();
      setCoworkers(res.coworkers || []);
    } catch (e: any) {
      setError(e.message || "Failed to load coworkers");
    } finally {
      setLoadingList(false);
    }
  };

  const handleStartTask = (coworker: Coworker) => {
    if (!matterId) return;
    setActiveCoworker(coworker);
    setCustomInstruction("");

    if (coworker.id === "contract_diff") {
      fetchFiles(matterId).then((files) => {
        setMatterFiles(files || []);
        if (files && files.length >= 2) {
          setDoc1(files[0].source_file);
          setDoc2(files[1].source_file);
          setShowDiffModal(true);
          return;
        }
        executeTask(coworker, "");
      }).catch(() => {
        executeTask(coworker, "");
      });
      return;
    }

    if (forceCloud) {
      onRequestApproval({
        title: `Cloud Escalation: ${coworker.name}`,
        actionDescription: `You are about to run the autonomous Coworker "${coworker.name}" with Cloud AI enabled. Matter document excerpts will be analyzed with high-reasoning cloud models.`,
        dataScope: `Matter: ${matterTitle || matterId} (Excerpts with PII Redaction)`,
        onApprove: () => executeTask(coworker, ""),
      });
    } else {
      executeTask(coworker, "");
    }
  };

  const handleRunDiff = async () => {
    if (!matterId || !doc1 || !doc2) return;
    setComparing(true);
    setError(null);
    try {
      const res = await compareMatterDocs(matterId, doc1, doc2, diffFocus || undefined);
      setShowDiffModal(false);
      const comp = res.comparison;
      const syntheticOutcome: CoworkerOutcome = {
        coworker_id: "contract_diff",
        coworker_name: "Contract & Document Redline Analyzer",
        role: "Comparative Document & Redline Specialist",
        status: "success",
        title: `Redline Comparison: ${doc1} vs ${doc2}`,
        summary: comp.summary,
        key_findings: comp.additions.map((a: string) => `[ADDED in ${doc2}]: ${a}`).concat(
          comp.deletions.map((d: string) => `[REMOVED from ${doc1}]: ${d}`)
        ),
        risk_matrix: (comp.modifications || []).map((m: any) => ({
          item: m.clause,
          severity: "high" as const,
          detail: `${m.risk_impact} (Was: "${m.doc1_version}", Now: "${m.doc2_version}")`,
        })),
        action_plan: [
          { step: 1, action: `Review and verify altered terms: ${comp.risk_assessment}`, owner_or_deadline: "Immediate" },
          { step: 2, action: `Approve or reject changes proposed in ${doc2}`, owner_or_deadline: "Partner Review" },
        ],
        citations: [
          { source: doc1, page: "Draft A", reference: "Base version" },
          { source: doc2, page: "Draft B", reference: "Compared version" },
        ],
        markdown_memo: `# Redline Comparison\n\n**Base Document**: ${doc1}\n**Revised Document**: ${doc2}\n\n## Summary\n${comp.summary}\n\n## Added Terms\n${comp.additions.map((a: string) => `- ${a}`).join("\n")}\n\n## Deleted Terms\n${comp.deletions.map((d: string) => `- ${d}`).join("\n")}\n\n## Risk Assessment\n${comp.risk_assessment}`,
        backend_used: res.backend,
        timing: { retrieval_ms: 50, generation_ms: 1200, total_ms: 1250 },
      };
      setOutcome(syntheticOutcome);
      onOutcomeGenerated?.(syntheticOutcome);
    } catch (e: any) {
      setError(e.message || "Document comparison failed");
    } finally {
      setComparing(false);
    }
  };

  const handleExportCalendar = async () => {
    if (!matterId) return;
    try {
      const blob = await exportMatterCalendarIcs(matterId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ProAssist_Deadlines_${matterId}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || "Failed to export calendar deadlines");
    }
  };

  const executeTask = async (coworker: Coworker, customPrompt: string) => {
    if (!matterId) return;
    setRunning(true);
    setError(null);
    setOutcome(null);
    setRunProgress("Reading and retrieving matter excerpts...");

    const pTimer = setTimeout(() => {
      setRunProgress("Synthesizing multi-step outcome & risk matrix...");
    }, 3000);

    const pTimer2 = setTimeout(() => {
      setRunProgress("Generating structured briefing & citations...");
    }, 8000);

    try {
      const res = await runCoworker(
        matterId,
        coworker.id,
        customPrompt || undefined,
        forceCloud
      );
      setOutcome(res);
      onOutcomeGenerated?.(res);
    } catch (e: any) {
      setError(e.message || "Coworker run failed");
    } finally {
      clearTimeout(pTimer);
      clearTimeout(pTimer2);
      setRunning(false);
      setRunProgress("");
    }
  };

  const handleExportWord = async () => {
    if (!matterId) return;
    try {
      const blob = await exportMatterWord(matterId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ProAssist_Outcome_${matterId}.docx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || "Export failed");
    }
  };

  const handleCopyMarkdown = () => {
    if (!outcome) return;
    navigator.clipboard.writeText(outcome.markdown_memo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExportBundle = async (cid: string) => {
    try {
      const bundle = await exportCoworkerBundle(cid);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(bundle, null, 2));
      const a = document.createElement("a");
      a.href = dataStr;
      a.download = `${cid}.bundle.json`;
      a.click();
    } catch (e: any) {
      setError(e.message || "Failed to export bundle");
    }
  };

  const handleDeleteCoworker = async (cid: string) => {
    if (!confirm("Are you sure you want to delete this custom coworker?")) return;
    try {
      await deleteCustomCoworker(cid);
      loadCoworkers();
    } catch (e: any) {
      setError(e.message || "Failed to delete coworker");
    }
  };

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case "scale":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
            <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
            <path d="M7 21h10" />
            <path d="M12 3v18" />
            <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
          </svg>
        );
      case "shield-alert":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        );
      case "calendar-clock":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" />
            <path d="M16 2v4" />
            <path d="M8 2v4" />
            <path d="M3 10h18" />
            <circle cx="16" cy="16" r="6" />
            <polyline points="16 14 16 16 18 16" />
          </svg>
        );
      case "file-text":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        );
      case "receipt":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z" />
            <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
            <path d="M12 6v12" />
          </svg>
        );
      case "heart-pulse":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
          </svg>
        );
      case "git-compare":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="18" r="3" />
            <circle cx="6" cy="6" r="3" />
            <path d="M13 6h3a2 2 0 0 1 2 2v7" />
            <path d="M11 18H8a2 2 0 0 1-2-2V9" />
          </svg>
        );
      default:
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        );
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#1e1f20] text-[#e8eaed]">
      {/* Header bar */}
      <div className="p-4 border-b border-[#303134] bg-[#1e1f20]/90 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <h2 className="text-[14px] font-semibold flex items-center gap-1.5">
              AI Coworkers
              <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full font-medium">
                OpenWorker
              </span>
            </h2>
            <p className="text-[11px] text-[#9aa0a6]">Autonomous outcome specialists</p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          title="Create Custom Coworker or Import Bundle"
          className="p-1.5 rounded-lg bg-[#303134] hover:bg-[#3c4043] text-[#e8eaed] text-xs transition-colors flex items-center gap-1"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span className="text-[11px] font-medium hidden sm:inline">Add / Import</span>
        </button>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Error notification */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 font-bold ml-2">×</button>
          </div>
        )}

        {/* Execution progress */}
        {running && (
          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-center space-y-3 animate-pulse">
            <div className="w-8 h-8 mx-auto border-3 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="text-xs font-semibold text-blue-400">
                {activeCoworker?.name} is working...
              </p>
              <p className="text-[11px] text-[#9aa0a6] mt-0.5">{runProgress}</p>
            </div>
          </div>
        )}

        {/* Outcome View */}
        {outcome && !running && (
          <div className="space-y-4 animate-fade-in">
            {/* Outcome Header Card */}
            <div className="p-4 rounded-2xl bg-[#131314] border border-[#303134] space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    Completed Outcome
                  </span>
                  <h3 className="text-[15px] font-semibold text-white mt-1.5">{outcome.title}</h3>
                  <p className="text-[11px] text-[#9aa0a6]">{outcome.coworker_name} · {outcome.role}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleExportWord}
                    title="Export as Microsoft Word (.docx)"
                    className="p-1.5 bg-[#303134] hover:bg-[#3c4043] rounded-lg text-xs text-[#e8eaed] transition-colors flex items-center gap-1"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span className="text-[10px]">.docx</span>
                  </button>
                  <button
                    onClick={handleExportCalendar}
                    title="Sync Deadlines to Calendar (.ics)"
                    className="p-1.5 bg-[#303134] hover:bg-[#3c4043] rounded-lg text-xs text-[#e8eaed] transition-colors flex items-center gap-1"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span className="text-[10px]">.ics</span>
                  </button>
                  <button
                    onClick={handleCopyMarkdown}
                    title="Copy Markdown Memo"
                    className="p-1.5 bg-[#303134] hover:bg-[#3c4043] rounded-lg text-xs text-[#e8eaed] transition-colors"
                  >
                    {copied ? (
                      <span className="text-[10px] text-emerald-400 font-semibold">Copied!</span>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Summary */}
              <p className="text-xs text-[#bdc1c6] leading-relaxed bg-[#1e1f20] p-3 rounded-xl border border-[#303134]">
                {outcome.summary}
              </p>
            </div>

            {/* Key Findings */}
            {outcome.key_findings && outcome.key_findings.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#9aa0a6] flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  Key Evidential Findings
                </h4>
                <div className="space-y-1.5">
                  {outcome.key_findings.map((f, i) => (
                    <div key={i} className="text-xs bg-[#131314] p-2.5 rounded-xl border border-[#303134] text-[#e8eaed] flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span className="leading-relaxed">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risk Matrix */}
            {outcome.risk_matrix && outcome.risk_matrix.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#9aa0a6] flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                  Risk Matrix & Exposure
                </h4>
                <div className="space-y-2">
                  {outcome.risk_matrix.map((r, i) => {
                    const sev = r.severity?.toLowerCase();
                    const badgeClass =
                      sev === "high"
                        ? "bg-red-500/10 text-red-400 border-red-500/20"
                        : sev === "medium"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-blue-500/10 text-blue-400 border-blue-500/20";

                    return (
                      <div key={i} className="p-3 bg-[#131314] rounded-xl border border-[#303134] space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">{r.item}</span>
                          <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border ${badgeClass}`}>
                            {r.severity}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#9aa0a6]">{r.detail}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Plan */}
            {outcome.action_plan && outcome.action_plan.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#9aa0a6] flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  Action Plan & Next Steps
                </h4>
                <div className="space-y-1.5">
                  {outcome.action_plan.map((a, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-2.5 bg-[#131314] rounded-xl border border-[#303134] text-xs">
                      <span className="w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                        {a.step || i + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-white leading-relaxed">{a.action}</p>
                        {a.owner_or_deadline && (
                          <span className="text-[10px] text-[#9aa0a6] block mt-0.5">
                            Target: {a.owner_or_deadline}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {outcome.coworker_id === "deadline_tracker" && (
                  <button
                    onClick={handleExportCalendar}
                    className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-md transition-colors mt-2"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    1-Click Sync All Deadlines to Calendar (.ics)
                  </button>
                )}
              </div>
            )}

            {/* Back button */}
            <button
              onClick={() => setOutcome(null)}
              className="w-full py-2.5 bg-[#303134] hover:bg-[#3c4043] rounded-xl text-xs font-semibold text-[#e8eaed] transition-colors"
            >
              ← Back to Coworkers List
            </button>
          </div>
        )}

        {/* List of Coworkers (when no active outcome) */}
        {!outcome && !running && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-[#9aa0a6] font-medium">Available Specialists</span>
              {/* Cloud Escalation Toggle */}
              <label className="flex items-center gap-1.5 text-[11px] cursor-pointer text-[#bdc1c6]">
                <input
                  type="checkbox"
                  checked={forceCloud}
                  onChange={(e) => setForceCloud(e.target.checked)}
                  className="rounded bg-[#131314] border-[#303134] text-blue-500 focus:ring-0"
                />
                <span>Cloud AI Escalation</span>
              </label>
            </div>

            {loadingList ? (
              <div className="text-center py-10 text-xs text-[#9aa0a6]">Loading Coworker catalog...</div>
            ) : coworkers.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#9aa0a6]">No Coworkers available for this workspace.</div>
            ) : (
              coworkers.map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 rounded-2xl bg-[#131314] border border-[#303134] hover:border-[#4d5156] transition-all space-y-2.5 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                        {renderIcon(c.icon)}
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-white group-hover:text-blue-400 transition-colors">
                          {c.name}
                        </h4>
                        <span className="text-[10px] text-[#9aa0a6]">{c.role}</span>
                      </div>
                    </div>

                    {/* Actions for custom coworker */}
                    {!c.is_builtin && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleExportBundle(c.id)}
                          title="Export Portable Bundle (.bundle.json)"
                          className="p-1 hover:text-blue-400 text-[#9aa0a6]"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteCoworker(c.id)}
                          title="Delete Custom Coworker"
                          className="p-1 hover:text-red-400 text-[#9aa0a6]"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-[#bdc1c6] leading-relaxed">
                    {c.description}
                  </p>

                  <div className="pt-1 flex items-center justify-end">
                    <button
                      onClick={() => handleStartTask(c)}
                      disabled={!matterId}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-[11px] font-semibold text-white transition-all flex items-center gap-1.5 shadow-sm shadow-blue-600/20"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      Run Workflow
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Custom Coworker & Bundle Modal */}
      {showCreateModal && (
        <CreateCoworkerModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadCoworkers();
          }}
        />
      )}

      {/* Document Comparison (Diff) Modal */}
      {showDiffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#1e1f20] border border-[#3c4043] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#303134] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="18" cy="18" r="3" />
                    <circle cx="6" cy="6" r="3" />
                    <path d="M13 6h3a2 2 0 0 1 2 2v7" />
                    <path d="M11 18H8a2 2 0 0 1-2-2V9" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Compare Document Versions</h3>
                  <p className="text-[11px] text-[#9aa0a6]">Contract & Document Redline Analyzer</p>
                </div>
              </div>
              <button onClick={() => setShowDiffModal(false)} className="text-[#9aa0a6] hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#bdc1c6] font-medium mb-1">Base Document (Doc 1 / Original):</label>
                <select
                  value={doc1}
                  onChange={(e) => setDoc1(e.target.value)}
                  className="w-full bg-[#131314] border border-[#303134] rounded-xl p-2.5 text-white outline-none focus:border-blue-500 text-xs"
                >
                  {matterFiles.map((f, i) => (
                    <option key={i} value={f.source_file}>{f.source_file}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#bdc1c6] font-medium mb-1">Revised Document (Doc 2 / Revision):</label>
                <select
                  value={doc2}
                  onChange={(e) => setDoc2(e.target.value)}
                  className="w-full bg-[#131314] border border-[#303134] rounded-xl p-2.5 text-white outline-none focus:border-blue-500 text-xs"
                >
                  {matterFiles.map((f, i) => (
                    <option key={i} value={f.source_file}>{f.source_file}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#bdc1c6] font-medium mb-1">Optional Focus (e.g. indemnity, payment, termination):</label>
                <input
                  type="text"
                  placeholder="Leave empty for full contractual redline"
                  value={diffFocus}
                  onChange={(e) => setDiffFocus(e.target.value)}
                  className="w-full bg-[#131314] border border-[#303134] rounded-xl p-2.5 text-white outline-none focus:border-blue-500 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-[#303134]">
              <button
                onClick={() => setShowDiffModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-[#9aa0a6] hover:text-white bg-[#303134]/60"
              >
                Cancel
              </button>
              <button
                onClick={handleRunDiff}
                disabled={comparing || !doc1 || !doc2 || doc1 === doc2}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 transition-all shadow-md flex items-center gap-1.5"
              >
                {comparing ? "Analyzing Redlines..." : "Run Redline Comparison"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateCoworkerModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [tab, setTab] = useState<"create" | "import">("create");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("sparkles");
  const [vertical, setVertical] = useState("all");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [defaultQuery, setDefaultQuery] = useState("");
  const [bundleJson, setBundleJson] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim() || !role.trim() || !systemPrompt.trim() || !defaultQuery.trim()) {
      setModalError("Please fill out all required fields.");
      return;
    }
    setSaving(true);
    setModalError(null);
    try {
      await createCustomCoworker({
        name,
        role,
        description,
        icon,
        vertical,
        system_prompt: systemPrompt,
        default_query: defaultQuery,
      });
      onSuccess();
    } catch (e: any) {
      setModalError(e.message || "Failed to create coworker");
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async () => {
    if (!bundleJson.trim()) {
      setModalError("Please paste bundle JSON content.");
      return;
    }
    setSaving(true);
    setModalError(null);
    try {
      const parsed = JSON.parse(bundleJson);
      await importCoworkerBundle(parsed);
      onSuccess();
    } catch (e: any) {
      setModalError(e.message || "Invalid bundle JSON format");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setBundleJson(text);
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#1e1f20] border border-[#303134] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <span className="text-blue-400">⚡</span>
            OpenWorker Portable Coworker
          </h3>
          <button onClick={onClose} className="text-[#9aa0a6] hover:text-white text-lg">×</button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 border-b border-[#303134] pb-3 mb-4 text-xs font-medium">
          <button
            onClick={() => setTab("create")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              tab === "create" ? "bg-blue-600 text-white" : "text-[#9aa0a6] hover:text-white"
            }`}
          >
            Create Coworker
          </button>
          <button
            onClick={() => setTab("import")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              tab === "import" ? "bg-blue-600 text-white" : "text-[#9aa0a6] hover:text-white"
            }`}
          >
            Import .bundle.json
          </button>
        </div>

        {modalError && (
          <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl mb-3">
            {modalError}
          </div>
        )}

        {tab === "create" ? (
          <div className="space-y-3 text-xs max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <label className="block text-[#9aa0a6] mb-1">Coworker Name *</label>
              <input
                type="text"
                placeholder="e.g. Contract Discrepancy Spotter"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#131314] border border-[#303134] rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[#9aa0a6] mb-1">Professional Role / Persona *</label>
              <input
                type="text"
                placeholder="e.g. Senior Contract Specialist"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-[#131314] border border-[#303134] rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[#9aa0a6] mb-1">Description</label>
              <input
                type="text"
                placeholder="What outcome does this coworker deliver?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-[#131314] border border-[#303134] rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[#9aa0a6] mb-1">Vertical</label>
                <select
                  value={vertical}
                  onChange={(e) => setVertical(e.target.value)}
                  className="w-full bg-[#131314] border border-[#303134] rounded-xl px-3 py-2 text-white outline-none"
                >
                  <option value="all">All Professions</option>
                  <option value="law_firm">Law Firm (Legal)</option>
                  <option value="ca_firm">CA Firm (Finance)</option>
                  <option value="medical">Healthcare (Medical)</option>
                  <option value="generic">Enterprise Generic</option>
                </select>
              </div>

              <div>
                <label className="block text-[#9aa0a6] mb-1">Icon</label>
                <select
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="w-full bg-[#131314] border border-[#303134] rounded-xl px-3 py-2 text-white outline-none"
                >
                  <option value="sparkles">✨ Sparkles</option>
                  <option value="scale">⚖️ Legal Scale</option>
                  <option value="shield-alert">🛡️ Due Diligence Shield</option>
                  <option value="calendar-clock">📅 Calendar & Deadlines</option>
                  <option value="file-text">📄 Advisory Memo</option>
                  <option value="receipt">🧾 Tax & Audit</option>
                  <option value="heart-pulse">🩺 Clinical Records</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[#9aa0a6] mb-1">Default Objective / Task Query *</label>
              <textarea
                rows={2}
                placeholder="e.g. cross-check all clauses for termination liabilities..."
                value={defaultQuery}
                onChange={(e) => setDefaultQuery(e.target.value)}
                className="w-full bg-[#131314] border border-[#303134] rounded-xl p-2.5 text-white outline-none resize-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[#9aa0a6] mb-1">Specialized System Prompt *</label>
              <textarea
                rows={3}
                placeholder="You are an expert contract specialist with 15 years experience..."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full bg-[#131314] border border-[#303134] rounded-xl p-2.5 text-white outline-none resize-none focus:border-blue-500"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[#9aa0a6] mb-1">Upload .bundle.json file</label>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="text-xs text-[#9aa0a6] file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-blue-600 file:text-white file:text-xs hover:file:bg-blue-500"
              />
            </div>

            <div>
              <label className="block text-[#9aa0a6] mb-1">Or paste Bundle JSON</label>
              <textarea
                rows={8}
                placeholder='{"format": "openworker_bundle_v1", "bundle": {...}}'
                value={bundleJson}
                onChange={(e) => setBundleJson(e.target.value)}
                className="w-full bg-[#131314] border border-[#303134] rounded-xl p-2.5 text-white font-mono text-[11px] outline-none resize-none focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {/* Modal buttons */}
        <div className="flex justify-end gap-2.5 mt-5 pt-3 border-t border-[#303134]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-[#9aa0a6] hover:text-white bg-[#303134]/60 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={tab === "create" ? handleCreate : handleImport}
            disabled={saving}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 transition-all flex items-center gap-1.5 shadow-md shadow-blue-600/20"
          >
            {saving ? "Saving..." : tab === "create" ? "Create Coworker" : "Import Bundle"}
          </button>
        </div>
      </div>
    </div>
  );
}
