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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm p-4">
      <div
        className="bg-[#1e1f20] border border-[#3c4043] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col animate-fade-in"
        role="dialog"
        aria-modal="true"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#303134] bg-[#282a2c]/50">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#9aa0a6]">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, coworker, or matter... (Ctrl+K)"
            className="flex-1 bg-transparent border-none text-[#e8eaed] placeholder-[#9aa0a6] text-sm focus:outline-none"
            autoFocus
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold text-[#9aa0a6] bg-[#303134] border border-[#3c4043] rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#9aa0a6]">
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
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors ${
                    isSelected
                      ? "bg-blue-600/20 text-[#e8eaed] border border-blue-500/30"
                      : "text-[#bdc1c6] hover:bg-[#282a2c]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isSelected ? "bg-blue-600 text-white" : "bg-[#303134] text-[#9aa0a6]"
                    }`}>
                      {cmd.category === "Matters" && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                      )}
                      {cmd.category === "Coworkers" && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="8.5" cy="7" r="4" />
                          <polyline points="17 11 19 13 23 9" />
                        </svg>
                      )}
                      {cmd.category === "Quick Actions" && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#e8eaed] truncate">
                        {cmd.title}
                      </div>
                      {cmd.subtitle && (
                        <div className="text-xs text-[#9aa0a6] truncate">
                          {cmd.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {cmd.badge && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#303134] text-[#9aa0a6]">
                        {cmd.badge}
                      </span>
                    )}
                    <span className="text-[11px] text-[#5f6368] font-mono">
                      {cmd.category}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="px-4 py-2 bg-[#131314] border-t border-[#303134] flex items-center justify-between text-[11px] text-[#9aa0a6]">
          <div className="flex items-center gap-3">
            <span><kbd className="bg-[#282a2c] px-1 rounded">↑↓</kbd> to navigate</span>
            <span><kbd className="bg-[#282a2c] px-1 rounded">↵</kbd> to select</span>
            <span><kbd className="bg-[#282a2c] px-1 rounded">ESC</kbd> to close</span>
          </div>
          <span className="text-blue-400 font-medium">ProAssist Spotlight</span>
        </div>
      </div>
    </div>
  );
}
