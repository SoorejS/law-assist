import { useState, useCallback } from "react";
import type { MatterInfo } from "../lib/types";

interface Props {
  folders: MatterInfo[];
  selectedFolder: string | null;
  onSelectFolder: (id: string | null) => void;
  onNewFolder: (name: string) => void;
  onShowUpload: () => void;
}

export function Sidebar({
  folders,
  selectedFolder,
  onSelectFolder,
  onNewFolder,
  onShowUpload,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = useCallback(() => {
    const name = newName.trim();
    if (!name) return;
    onNewFolder(name);
    setNewName("");
    setCreating(false);
  }, [newName, onNewFolder]);

  return (
    <aside className="w-64 flex-shrink-0 bg-slate-900/95 backdrop-blur-lg border-r border-slate-800 flex flex-col h-full select-none shadow-2xl z-10 relative">
      {/* Brand */}
      <div
        className="flex items-center gap-2.5 px-4 py-4 border-b border-slate-700/60"
        data-tauri-drag-region
      >
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </div>
        <div>
          <div className="text-white text-sm font-semibold tracking-tight leading-none">
            Saravonix
          </div>
          <div className="text-slate-400 text-[10px] mt-0.5">Memory Engine</div>
        </div>
      </div>

      {/* All documents shortcut */}
      <div className="px-3 pt-3">
        <button
          onClick={() => onSelectFolder(null)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
            selectedFolder === null
              ? "bg-blue-600 text-white"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <span className="font-medium">All Documents</span>
        </button>
      </div>

      {/* Folders section */}
      <div className="px-3 pt-4 pb-1 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          Matters / Folders
        </span>
        <button
          onClick={() => setCreating(true)}
          className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"
          title="New folder"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M12 5v14" />
          </svg>
        </button>
      </div>

      {/* New folder input */}
      {creating && (
        <div className="px-3 mb-1">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") {
                setCreating(false);
                setNewName("");
              }
            }}
            placeholder="Matter name..."
            className="w-full bg-slate-800 text-white text-xs rounded-md px-2.5 py-1.5 outline-none border border-slate-600 focus:border-blue-500 placeholder:text-slate-500"
          />
        </div>
      )}

      {/* Folder list */}
      <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-0.5">
        {folders.length === 0 && !creating && (
          <p className="text-slate-600 text-xs text-center mt-6 leading-relaxed px-2">
            No folders yet.
            <br />
            Create one to organise your documents.
          </p>
        )}
        {folders.map((f) => (
          <FolderItem
            key={f.id}
            folder={f}
            selected={selectedFolder === f.id}
            onSelect={() => onSelectFolder(f.id)}
          />
        ))}
      </div>

      {/* Bottom actions */}
      <div className="border-t border-slate-700/60 p-3 space-y-1.5">
        <button
          onClick={onShowUpload}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Ingest Documents
        </button>
      </div>
    </aside>
  );
}

function FolderItem({
  folder,
  selected,
  onSelect,
}: {
  folder: MatterInfo;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-lg transition-colors group ${
        selected
          ? "bg-blue-600/20 text-blue-300"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
      }`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="flex-shrink-0 mt-0.5"
      >
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate leading-tight">
          {folder.title || folder.id}
        </div>
        <div
          className={`text-[10px] mt-0.5 ${selected ? "text-blue-400/70" : "text-slate-600 group-hover:text-slate-500"}`}
        >
          {folder.file_count} file{folder.file_count !== 1 ? "s" : ""} ·{" "}
          {folder.chunk_count} chunks
        </div>
      </div>
    </button>
  );
}
