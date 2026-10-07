import { useState, useMemo } from "react";
import type { MatterInfo } from "../lib/types";
import { exportMatterCalendarIcs } from "../lib/api";

interface Props {
  matters: MatterInfo[];
  onSelectMatter: (id: string) => void;
  onCreateMatter: (title: string, tags?: string[]) => void;
  onOpenCommandPalette?: () => void;
  onExportWord?: (matterId: string) => void;
}

const PRESET_TAGS = [
  "#ActiveTrial",
  "#ContractReview",
  "#DueDiligence",
  "#TaxCompliance",
  "#Arbitration",
  "#CorporateFiling",
];

export function DashboardView({ matters, onSelectMatter, onCreateMatter, onOpenCommandPalette, onExportWord }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [activeFilterTag, setActiveFilterTag] = useState<string | null>(null);

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

  return (
    <div className="flex-1 overflow-y-auto bg-[#131314] p-8 text-white relative h-full">
      <div className="max-w-6xl mx-auto mt-6 space-y-6">
        {/* Header with Search & Quick Palette shortcut */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#282a2c] pb-6">
          <div>
            <h1 className="text-3xl font-medium tracking-tight">Active Workspaces & Matters</h1>
            <p className="text-sm text-[#9aa0a6] mt-1">
              Private, local-first legal and financial dossiers with cryptographically secure AI.
            </p>
          </div>

          {onOpenCommandPalette && (
            <button
              onClick={onOpenCommandPalette}
              className="flex items-center gap-2.5 bg-[#1e1f20] hover:bg-[#282a2c] border border-[#303134] px-4 py-2 rounded-xl text-xs font-medium text-[#bdc1c6] transition-colors self-start sm:self-auto group"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#9aa0a6] group-hover:text-white">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span>Command Palette</span>
              <kbd className="bg-[#303134] text-[10px] px-1.5 py-0.5 rounded border border-[#3c4043] text-[#9aa0a6]">
                Ctrl + K
              </kbd>
            </button>
          )}
        </div>

        {/* Tag Filters */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-[#9aa0a6] font-medium mr-1">Filter by Tag:</span>
            <button
              onClick={() => setActiveFilterTag(null)}
              className={`px-3 py-1 rounded-full font-medium transition-colors ${
                activeFilterTag === null
                  ? "bg-blue-600 text-white"
                  : "bg-[#1e1f20] text-[#9aa0a6] hover:text-white hover:bg-[#282a2c]"
              }`}
            >
              All ({matters.length})
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveFilterTag(activeFilterTag === tag ? null : tag)}
                className={`px-3 py-1 rounded-full font-medium transition-colors ${
                  activeFilterTag === tag
                    ? "bg-blue-600 text-white"
                    : "bg-[#1e1f20] text-[#9aa0a6] hover:text-white hover:bg-[#282a2c] border border-[#303134]"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Matter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {/* Create New Card */}
          {showCreate ? (
            <div className="bg-[#1e1f20] border border-blue-500/50 rounded-2xl p-5 shadow-lg flex flex-col min-h-[220px] transition-all relative overflow-hidden">
              <form onSubmit={handleCreate} className="h-full flex flex-col justify-between space-y-3">
                <div>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Matter / Dossier title..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-transparent border-b border-slate-600 focus:border-blue-500 text-white text-base font-medium outline-none pb-2"
                  />

                  {/* Preset Tag chips */}
                  <div className="mt-3">
                    <span className="text-[10px] uppercase font-bold text-[#9aa0a6] block mb-1.5">
                      Assign Tags / Status
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {PRESET_TAGS.map((tag) => {
                        const isSelected = selectedTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleToggleTag(tag)}
                            className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors ${
                              isSelected
                                ? "bg-blue-600 text-white"
                                : "bg-[#131314] text-[#9aa0a6] hover:text-white border border-[#303134]"
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
                    placeholder="Add custom tag (press Enter)..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleAddCustomTag}
                    className="w-full bg-[#131314] border border-[#303134] rounded-lg px-2 py-1 text-[11px] text-white mt-2 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#303134]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreate(false);
                      setSelectedTags([]);
                    }}
                    className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-full"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-full font-medium transition-colors"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="bg-[#1e1f20] hover:bg-[#282a2c] border border-[#2a2b2e] hover:border-blue-500/40 rounded-2xl p-5 shadow-sm flex flex-col items-center justify-center min-h-[220px] transition-all group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5v14" />
                </svg>
              </div>
              <span className="text-[#a8c7fa] font-medium text-sm">New Matter Dossier</span>
              <span className="text-[11px] text-[#9aa0a6] mt-1">Initialize confidential workspace</span>
            </button>
          )}

          {/* Matter Cards */}
          {filteredMatters.map((m) => (
            <div
              key={m.id}
              onClick={() => onSelectMatter(m.id)}
              className="bg-[#1e1f20] hover:bg-[#282a2c] border border-[#2a2b2e] hover:border-[#3c4043] rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[220px] transition-all text-left cursor-pointer group relative"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-[#303134] group-hover:bg-blue-600/20 group-hover:text-blue-400 flex items-center justify-center transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Quick Word Export icon */}
                    {onExportWord && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onExportWord(m.id);
                        }}
                        title="Export Full Case Brief to Word (.docx)"
                        className="p-1.5 rounded-lg text-[#9aa0a6] hover:text-blue-400 hover:bg-[#303134] opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                      </button>
                    )}

                    {/* Quick Calendar Export icon */}
                    <button
                      onClick={(e) => handleExportCalendar(e, m.id)}
                      title="Export Deadlines to Calendar (.ics)"
                      className="p-1.5 rounded-lg text-[#9aa0a6] hover:text-white hover:bg-[#303134] opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </button>
                  </div>
                </div>

                <h2 className="text-base font-semibold text-[#e8eaed] group-hover:text-blue-300 truncate w-full mb-1 transition-colors">
                  {m.title || m.id}
                </h2>
                {m.description && (
                  <p className="text-xs text-[#9aa0a6] line-clamp-2 leading-relaxed mb-2">
                    {m.description}
                  </p>
                )}

                {/* Tags */}
                {m.tags && m.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {m.tags.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-[#131314] text-[#8ab4f8] border border-[#303134]"
                      >
                        {tag}
                      </span>
                    ))}
                    {m.tags.length > 3 && (
                      <span className="text-[9px] text-[#9aa0a6] px-1 py-0.5">
                        +{m.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-[#2a2b2e] text-xs text-[#9aa0a6] flex items-center justify-between">
                <span>{m.file_count} sources · {m.chunk_count} passages</span>
                <span className="text-[11px]">{new Date(m.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
