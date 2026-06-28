import React, { useEffect, useState } from "react";
import { fetchIntelligence } from "../lib/api";
import type { IntelligenceData } from "../lib/types";

export function IntelligenceSidebar({ matterId }: { matterId: string | null }) {
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
        <h3 className="text-[#e8eaed] font-medium mb-2">Notebook guide</h3>
        <p className="text-[#9aa0a6] text-sm">Select a notebook to view automatically extracted intelligence such as timelines, key people, and contradictions.</p>
      </aside>
    );
  }

  return (
    <aside className="w-[320px] flex-shrink-0 bg-[#1e1f20] border-l border-[#303134] flex flex-col h-full overflow-y-auto shadow-xl z-20">
      <div className="p-5 border-b border-[#303134] bg-[#1e1f20]/90 sticky top-0 backdrop-blur-md z-10">
        <h2 className="text-[15px] font-medium text-[#e8eaed] flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-[#8ab4f8]" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Notebook guide
        </h2>
        <p className="text-[13px] text-[#9aa0a6] mt-1 truncate">Extracted from {matterId}</p>
      </div>

      <div className="p-5 space-y-8">
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
