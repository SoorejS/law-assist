import { useEffect, useState, useMemo } from "react";
import type { MatterInfo, Coworker } from "../lib/types";

interface CommandItem {
  id: string;
  category: "Matters" | "Coworkers" | "Quick Actions";
  title: string;
  subtitle?: string;
  icon: string;
  badge?: string;
  action: () => void;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  matters: MatterInfo[];
  coworkers: Coworker[];
  currentMatterId: string | null;
  onSelectMatter: (matterId: string) => void;
  onOpenNewMatter: () => void;
  onOpenUpload: () => void;
  onOpenGlobalSearch: () => void;
  onOpenCoworkers: (coworkerId?: string) => void;
  onExportCalendar?: () => void;
  onExportWord?: () => void;
  onOpenDisplaySettings?: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  matters,
  coworkers,
  currentMatterId,
  onSelectMatter,
  onOpenNewMatter,
  onOpenUpload,
  onOpenGlobalSearch,
  onOpenCoworkers,
  onExportCalendar,
  onExportWord,
  onOpenDisplaySettings,
}: Props) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset query on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Build command list
  const commands = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [];

    // Quick Actions
    list.push({
      id: "act-new-matter",
      category: "Quick Actions",
      title: "Create New Matter",
      subtitle: "Initialize a new confidential client dossier",
      icon: "plus",
      action: () => {
        onClose();
        onOpenNewMatter();
      },
    });

    list.push({
      id: "act-global-search",
      category: "Quick Actions",
      title: "Global Multi-Matter Search",
      subtitle: "Search across all active client matters and filings",
      icon: "search",
      action: () => {
        onClose();
        onOpenGlobalSearch();
      },
    });

    if (onOpenDisplaySettings) {
      list.push({
        id: "act-display-settings",
        category: "Quick Actions",
        title: "Display & Reading Preferences",
        subtitle: "Adjust zoom, legal editorial serif font, font size, and contrast",
        icon: "settings",
        action: () => {
          onClose();
          onOpenDisplaySettings();
        },
      });
    }

    if (currentMatterId) {
      list.push({
        id: "act-upload-doc",
        category: "Quick Actions",
        title: "Ingest Documents into Matter",
        subtitle: "Upload PDF, DOCX, CSV, Excel or TXT",
        icon: "upload",
        action: () => {
          onClose();
          onOpenUpload();
        },
      });

      if (onExportCalendar) {
        list.push({
          id: "act-export-ics",
          category: "Quick Actions",
          title: "Sync Matter Deadlines to Calendar (.ics)",
          subtitle: "Export court hearings and milestones to Outlook/Apple/Google",
          icon: "calendar",
          action: () => {
            onClose();
            onExportCalendar();
          },
        });
      }

      if (onExportWord) {
        list.push({
          id: "act-export-docx",
          category: "Quick Actions",
          title: "Export Executive Matter Brief (.docx)",
          subtitle: "Generate branded Word report for court or partners",
          icon: "file-text",
          action: () => {
            onClose();
            onExportWord();
          },
        });
      }
    }

    // Coworkers
    coworkers.forEach((c) => {
      list.push({
        id: `coworker-${c.id}`,
        category: "Coworkers",
        title: c.name,
        subtitle: c.role,
        icon: "user-check",
        badge: c.vertical,
        action: () => {
          onClose();
          onOpenCoworkers(c.id);
        },
      });
    });

    // Matters
    matters.forEach((m) => {
      const isCurrent = m.id === currentMatterId;
      list.push({
        id: `matter-${m.id}`,
        category: "Matters",
        title: m.title,
        subtitle: `${m.file_count} files · ${m.chunk_count} passages${m.tags?.length ? ` · ${m.tags.join(", ")}` : ""}`,
        icon: "folder",
        badge: isCurrent ? "Active" : undefined,
        action: () => {
          onClose();
          onSelectMatter(m.id);
        },
      });
    });

    return list;
  }, [matters, coworkers, currentMatterId, onClose, onSelectMatter, onOpenNewMatter, onOpenUpload, onOpenGlobalSearch, onOpenCoworkers, onExportCalendar, onExportWord]);

  // Filter commands by query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.subtitle && c.subtitle.toLowerCase().includes(q)) ||
        c.category.toLowerCase().includes(q)
    );
  }, [commands, query]);

  // Clamp selection index
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, filteredCommands, selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/70 backdrop-blur-sm p-4">
      <div
        className="bg-[#161a23] border border-[#2d323f] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col animate-fade-in"
        role="dialog"
        aria-modal="true"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#2d323f] bg-[#1a1f2c]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, coworkers, or matters... (Ctrl+K)"
            className="flex-1 bg-transparent border-none text-white placeholder-slate-400 text-sm sm:text-base font-medium focus:outline-none"
            autoFocus
          />
          <kbd className="hidden sm:inline-block px-2.5 py-1 text-xs font-bold text-slate-300 bg-[#202532] border border-[#2d323f] rounded-lg">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[400px] overflow-y-auto p-2.5 space-y-1.5">
          {filteredCommands.length === 0 ? (
            <div className="py-10 text-center text-sm sm:text-base text-slate-400 font-medium">
              No matches found for "{query}"
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-left transition-colors ${
                    isSelected
                      ? "bg-blue-600/20 text-white border border-blue-500/40"
                      : "text-slate-300 hover:bg-[#202532]"
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isSelected ? "bg-blue-600 text-white" : "bg-[#202532] text-slate-300 border border-[#2d323f]"
                    }`}>
                      {cmd.category === "Matters" && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                      )}
                      {cmd.category === "Coworkers" && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="8.5" cy="7" r="4" />
                          <polyline points="17 11 19 13 23 9" />
                        </svg>
                      )}
                      {cmd.category === "Quick Actions" && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm sm:text-base font-semibold text-white truncate">
                        {cmd.title}
                      </div>
                      {cmd.subtitle && (
                        <div className="text-xs sm:text-sm text-slate-300 font-medium truncate mt-0.5">
                          {cmd.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 flex-shrink-0 ml-3">
                    {cmd.badge && (
                      <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-[#202532] text-slate-200 border border-[#2d323f]">
                        {cmd.badge}
                      </span>
                    )}
                    <span className="text-xs text-slate-400 font-medium">
                      {cmd.category}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="px-5 py-3 bg-[#11131a] border-t border-[#2d323f] flex items-center justify-between text-xs text-slate-300 font-medium">
          <div className="flex items-center gap-4">
            <span><kbd className="bg-[#202532] px-1.5 py-0.5 rounded text-white font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="bg-[#202532] px-1.5 py-0.5 rounded text-white font-mono">↵</kbd> select</span>
            <span><kbd className="bg-[#202532] px-1.5 py-0.5 rounded text-white font-mono">ESC</kbd> dismiss</span>
          </div>
          <span className="text-blue-400 font-bold">ProAssist Spotlight</span>
        </div>
      </div>
    </div>
  );
}
