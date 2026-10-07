import React, { useEffect, useState } from "react";
import { fetchIntelligence } from "../lib/api";
import type { IntelligenceData } from "../lib/types";
import { CoworkerPanel } from "./CoworkerPanel";

interface Props {
  matterId: string | null;
  matterTitle?: string;
  onRequestApproval: (opts: {
    title: string;
    actionDescription: string;
    dataScope?: string;
    onApprove: () => void;
  }) => void;
  onOutcomeGenerated?: (outcome: any) => void;
  onExportWord?: () => void;
}

export function IntelligenceSidebar({
  matterId,
  matterTitle,
  onRequestApproval,
  onOutcomeGenerated,
  onExportWord,
}: Props) {
  const [activeTab, setActiveTab] = useState<"coworkers" | "guide">("coworkers");
  const [data, setData] = useState<IntelligenceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!matterId) {
      setData(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    fetchIntelligence(matterId)
      .then((res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [matterId]);

  if (!matterId) {
    return (
      <aside className="w-80 flex-shrink-0 bg-[#1e1f20] border-l border-[#303134] p-6 flex flex-col justify-center items-center text-center">
        <div className="w-16 h-16 bg-[#303134] rounded-full flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </div>
        <h3 className="text-[#e8eaed] font-medium mb-2">Notebook Intelligence</h3>
        <p className="text-[#9aa0a6] text-sm">Select a notebook to deploy autonomous Coworkers or view automatically extracted intelligence.</p>
      </aside>
    );
  }

  return (
    <aside className="w-[340px] xl:w-[380px] flex-shrink-0 bg-[#1e1f20] border-l border-[#303134] flex flex-col h-full overflow-hidden shadow-xl z-20">
      {/* Top Tab Bar */}
      <div className="flex border-b border-[#303134] bg-[#1a1b1c] px-2 pt-2 gap-1 flex-shrink-0">
        <button
          onClick={() => setActiveTab("coworkers")}
          className={`flex-1 py-2 text-xs font-semibold rounded-t-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "coworkers"
              ? "bg-[#1e1f20] text-blue-400 border-t-2 border-t-blue-500 border-x border-[#303134]"
              : "text-[#9aa0a6] hover:text-white"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          Coworkers
        </button>

        <button
          onClick={() => setActiveTab("guide")}
          className={`flex-1 py-2 text-xs font-semibold rounded-t-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "guide"
              ? "bg-[#1e1f20] text-blue-400 border-t-2 border-t-blue-500 border-x border-[#303134]"
              : "text-[#9aa0a6] hover:text-white"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          Notebook Guide
        </button>
      </div>

      {/* Tab 1: OpenWorker Coworkers Panel */}
      {activeTab === "coworkers" ? (
        <div className="flex-1 overflow-hidden">
          <CoworkerPanel
            matterId={matterId}
            matterTitle={matterTitle}
            onRequestApproval={onRequestApproval}
            onOutcomeGenerated={onOutcomeGenerated}
          />
        </div>
      ) : (
        /* Tab 2: Notebook Guide */
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 border-b border-[#303134] bg-[#1e1f20]/90 sticky top-0 backdrop-blur-md z-10 flex items-center justify-between">
            <div>
              <h2 className="text-[14px] font-medium text-[#e8eaed] flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-[#8ab4f8]" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Extracted Guide
              </h2>
              <p className="text-[11px] text-[#9aa0a6] mt-0.5 truncate max-w-[170px]">{matterTitle || matterId}</p>
            </div>
            {onExportWord && (
              <button
                onClick={onExportWord}
                className="text-[11px] bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 transition-all shadow-sm"
                title="Download formatted executive case brief (.docx)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span>Export .docx</span>
              </button>
            )}
          </div>

          <div className="p-4 space-y-6">
            {loading && (
              <div className="flex flex-col items-center justify-center py-10 space-y-4">
                <div className="w-8 h-8 border-4 border-[#8ab4f8] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[13px] text-[#9aa0a6] text-center animate-pulse">Extracting intelligence...<br/>This may take 10-20 seconds.</p>
              </div>
            )}

            {error && !loading && (
              <div className="bg-[#f28b82]/10 text-[#f28b82] p-4 rounded-xl text-[13px] border border-[#f28b82]/20">
                Failed to load intelligence: {error}
              </div>
            )}

            {!loading && data && (
              <>
                <Section title="Timeline of Events" icon="calendar">
                  {data.timeline.length === 0 ? (
                    <div className="text-[13px] text-[#9aa0a6]">No timeline events found.</div>
                  ) : (
                    <div className="text-[13px] text-[#e8eaed] border-l-2 border-[#303134] pl-3 py-1 space-y-4">
                      {data.timeline.map((item, i) => (
                        <div key={i}>
                          <div className="text-[11px] font-bold text-[#8ab4f8] tracking-wide mb-1">{item.date}</div>
                          <div className="text-[#9aa0a6] leading-relaxed">{item.event}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                <Section title="People Involved" icon="users">
                  {data.people.length === 0 ? (
                    <div className="text-[13px] text-[#9aa0a6]">No key people found.</div>
                  ) : (
                    <ul className="text-[13px] space-y-3">
                      {data.people.map((p, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#8ab4f8] mt-1.5 flex-shrink-0"/> 
                          <span className="text-[#e8eaed]"><strong>{p.name}</strong> <span className="text-[#9aa0a6]">({p.role})</span></span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                <Section title="Potential Contradictions" icon="alert-triangle">
                  {data.contradictions.length === 0 ? (
                    <div className="text-[13px] text-[#9aa0a6]">No contradictions found.</div>
                  ) : (
                    <div className="space-y-3">
                      {data.contradictions.map((c, i) => (
                        <div key={i} className="bg-[#fde293]/10 text-[#fde293] text-[13px] leading-relaxed p-3.5 rounded-xl border border-[#fde293]/20 shadow-sm">
                          {c}
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                <Section title="Missing Evidence" icon="file-search">
                   {data.missing_evidence.length === 0 ? (
                    <div className="text-[13px] text-[#9aa0a6]">No missing evidence identified.</div>
                  ) : (
                    <div className="text-[13px] text-[#e8eaed] bg-[#303134]/50 p-4 rounded-xl border border-[#303134] space-y-2">
                      {data.missing_evidence.map((me, i) => (
                        <div key={i} className="leading-relaxed flex gap-2">
                          <span className="text-[#9aa0a6]">•</span> {me}
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

function Section({ title, icon, children }: { title: string, icon: string, children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[12px] font-semibold text-[#9aa0a6] mb-3 uppercase tracking-wider flex items-center gap-2">
        {title}
      </h3>
      {children}
    </div>
  );
}
