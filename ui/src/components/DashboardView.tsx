import { useState, useMemo } from "react";
import type { MatterInfo } from "../lib/types";
import { exportMatterCalendarIcs } from "../lib/api";
import { useFontScale } from "../hooks/useFontScale";

interface Props {
  matters: MatterInfo[];
  onSelectMatter: (id: string) => void;
  onCreateMatter: (title: string, tags?: string[]) => void;
  onOpenCommandPalette?: () => void;
  onExportWord?: (matterId: string) => void;
  onOpenDisplaySettings?: () => void;
}

const PRESET_TAGS = [
  "#ActiveTrial",
  "#ContractReview",
  "#DueDiligence",
  "#TaxCompliance",
  "#Arbitration",
  "#CorporateFiling",
];

export function DashboardView({
  matters,
  onSelectMatter,
  onCreateMatter,
  onOpenCommandPalette,
  onExportWord,
  onOpenDisplaySettings,
}: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [activeFilterTag, setActiveFilterTag] = useState<string | null>(null);
  const { fontScale, cycleFontScale } = useFontScale();

  // Collect all unique tags across matters
  const allTags = useMemo(() => {
    const set = new Set<string>();
    matters.forEach((m) => {
      (m.tags || []).forEach((t) => set.add(t));
    });
    return Array.from(set);
  }, [matters]);

  // Filter matters by selected tag
  const filteredMatters = useMemo(() => {
    if (!activeFilterTag) return matters;
    return matters.filter((m) => (m.tags || []).includes(activeFilterTag));
  }, [matters, activeFilterTag]);

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleAddCustomTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const formatted = tagInput.trim().startsWith("#") ? tagInput.trim() : `#${tagInput.trim()}`;
      if (!selectedTags.includes(formatted)) {
        setSelectedTags((prev) => [...prev, formatted]);
      }
      setTagInput("");
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim()) {
      onCreateMatter(newTitle.trim(), selectedTags);
      setNewTitle("");
      setSelectedTags([]);
      setShowCreate(false);
    }
  };

  const handleExportCalendar = async (e: React.MouseEvent, matterId: string) => {
    e.stopPropagation();
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
    } catch (err) {
      console.error("Calendar export failed:", err);
    }
  };

  const fontScaleLabel = {
    normal: "Standard (100%)",
    large: "Large (115%)",
    xlarge: "Extra Large (130%)",
  }[fontScale];

  return (
    <div className="flex-1 overflow-y-auto bg-[#0d0f14] p-6 sm:p-10 text-slate-100 relative h-full">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header with Search & Quick Palette shortcut & Text Size */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[#232834] pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="w-3.5 h-3.5 rounded-full bg-blue-500 shadow-md shadow-blue-500/50" />
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Active Workspaces & Matters
              </h1>
            </div>
            <p className="text-base sm:text-lg text-slate-300 mt-2 font-normal leading-relaxed">
              Private, local-first legal dossiers, litigation timelines, and financial audits.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Reading Comfort & Display Settings */}
            <button
              onClick={() => {
                if (onOpenDisplaySettings) onOpenDisplaySettings();
                else cycleFontScale();
              }}
              title="Configure Font Style, Zoom, and Reading Comfort"
              className="flex items-center gap-2 bg-[#181b22] hover:bg-[#222733] border border-[#2d323f] hover:border-blue-500/40 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-200 transition-colors cursor-pointer shadow-sm"
            >
              <span className="text-blue-400 font-bold text-base">A±</span>
              <span className="hidden sm:inline">Display:</span>
              <span className="text-blue-300 font-medium">{fontScaleLabel}</span>
            </button>

            {onOpenCommandPalette && (
              <button
                onClick={onOpenCommandPalette}
                className="flex items-center gap-2.5 bg-[#181b22] hover:bg-[#222733] border border-[#2d323f] hover:border-blue-500/40 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-200 transition-colors group cursor-pointer shadow-sm"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-400 group-hover:text-blue-400 transition-colors">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span>Spotlight Search</span>
                <kbd className="bg-[#242936] text-[11px] px-2 py-0.5 rounded-md border border-[#343b4c] text-slate-300 font-mono">
                  Ctrl + K
                </kbd>
              </button>
            )}
          </div>
        </div>

        {/* Tag Filters */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2.5 overflow-x-auto pb-2 text-sm">
            <span className="text-slate-400 font-semibold text-xs uppercase tracking-wider mr-1">Filter Dossiers:</span>
            <button
              onClick={() => setActiveFilterTag(null)}
              className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeFilterTag === null
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400"
                  : "bg-[#181b22] text-slate-300 hover:text-white hover:bg-[#242936] border border-[#2d323f]"
              }`}
            >
              All Dossiers ({matters.length})
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveFilterTag(activeFilterTag === tag ? null : tag)}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeFilterTag === tag
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400"
                    : "bg-[#181b22] text-slate-300 hover:text-white hover:bg-[#242936] border border-[#2d323f]"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Matter Grid — Spacious 3-Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
          {/* Create New Card */}
          {showCreate ? (
            <div className="bg-[#181b22] border-2 border-blue-500 rounded-2xl p-6 shadow-2xl flex flex-col justify-between min-h-[250px] transition-all relative">
              <form onSubmit={handleCreate} className="h-full flex flex-col justify-between space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-blue-400 block mb-1">
                    Matter Dossier Title
                  </label>
                  <input
                    autoFocus
                    type="text"
                    placeholder="e.g. O.S. 423/2026 - Ramesh vs State..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-[#111318] border border-[#2d323f] focus:border-blue-500 rounded-xl px-4 py-3 text-white text-base sm:text-lg font-semibold outline-none transition-colors"
                  />

                  {/* Preset Tag chips */}
                  <div className="mt-4">
                    <span className="text-xs uppercase font-bold text-slate-400 block mb-2">
                      Assign Practice Tag / Status
                    </span>
                    <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                      {PRESET_TAGS.map((tag) => {
                        const isSelected = selectedTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleToggleTag(tag)}
                            className={`text-xs px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                              isSelected
                                ? "bg-blue-600 text-white shadow-sm ring-1 ring-blue-300"
                                : "bg-[#111318] text-slate-300 hover:text-white border border-[#2d323f]"
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="Type custom tag and press Enter..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleAddCustomTag}
                    className="w-full bg-[#111318] border border-[#2d323f] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white mt-3 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-[#232834]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreate(false);
                      setSelectedTags([]);
                    }}
                    className="text-sm font-semibold text-slate-300 hover:text-white px-4 py-2 rounded-xl hover:bg-[#242936] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                  >
                    Create Dossier
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="bg-[#181b22] hover:bg-[#1f2430] border-2 border-dashed border-[#2d323f] hover:border-blue-500/60 rounded-2xl p-7 shadow-sm flex flex-col items-center justify-center min-h-[250px] transition-all group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-blue-600/20 transition-all shadow-md">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5v14" />
                </svg>
              </div>
              <span className="text-blue-300 font-bold text-lg group-hover:text-white transition-colors">
                + New Matter Dossier
              </span>
              <span className="text-sm text-slate-400 mt-1.5 text-center">
                Initialize private case folder for documents & AI
              </span>
            </button>
          )}

          {/* Matter Dossier Cards */}
          {filteredMatters.map((m) => (
            <div
              key={m.id}
              onClick={() => onSelectMatter(m.id)}
              className="bg-[#181b22] hover:bg-[#1f2430] border border-[#2d323f] hover:border-blue-500/50 rounded-2xl p-6 shadow-md hover:shadow-2xl hover:shadow-black/60 flex flex-col justify-between min-h-[250px] transition-all text-left cursor-pointer group relative"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-11 h-11 rounded-xl bg-[#242936] group-hover:bg-blue-600/20 text-blue-400 flex items-center justify-center transition-colors border border-[#343b4c]">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Word Brief Export */}
                    {onExportWord && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onExportWord(m.id);
                        }}
                        title="Export Full Case Brief to Word (.docx)"
                        className="p-2 rounded-xl text-slate-400 hover:text-blue-300 hover:bg-[#252b38] transition-colors"
                      >
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                      </button>
                    )}

                    {/* Calendar Sync */}
                    <button
                      onClick={(e) => handleExportCalendar(e, m.id)}
                      title="Sync Deadlines to Calendar (.ics)"
                      className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-[#252b38] transition-colors"
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </button>
                  </div>
                </div>

                <h2 className="text-xl font-bold text-white group-hover:text-blue-300 truncate w-full mb-2 transition-colors tracking-tight">
                  {m.title || m.id}
                </h2>
                {m.description ? (
                  <p className="text-sm text-slate-300 line-clamp-2 leading-relaxed mb-3">
                    {m.description}
                  </p>
                ) : (
                  <p className="text-sm text-slate-400 italic mb-3">
                    Click to open case timeline & chat assistant.
                  </p>
                )}

                {/* Tags */}
                {m.tags && m.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {m.tags.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#111318] text-blue-300 border border-blue-500/30"
                      >
                        {tag}
                      </span>
                    ))}
                    {m.tags.length > 3 && (
                      <span className="text-xs text-slate-400 px-1 py-1 font-medium">
                        +{m.tags.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-5 pt-3.5 border-t border-[#232834] text-xs sm:text-sm text-slate-300 flex items-center justify-between font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  {m.file_count} documents · {m.chunk_count} passages
                </span>
                <span className="text-slate-400 font-normal">
                  {new Date(m.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
