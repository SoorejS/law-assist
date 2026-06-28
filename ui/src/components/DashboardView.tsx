import { useState } from "react";
import type { MatterInfo } from "../lib/types";

interface Props {
  matters: MatterInfo[];
  onSelectMatter: (id: string) => void;
  onCreateMatter: (title: string) => void;
}

export function DashboardView({ matters, onSelectMatter, onCreateMatter }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim()) {
      onCreateMatter(newTitle.trim());
      setNewTitle("");
      setShowCreate(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#131314] p-8 text-white relative h-full">
      <div className="max-w-6xl mx-auto mt-8">
        <h1 className="text-3xl font-medium mb-8">My Notebooks</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {/* Create New Card */}
          {showCreate ? (
            <div className="bg-[#1e1f20] border border-blue-500/50 rounded-2xl p-5 shadow-lg flex flex-col h-48 transition-all relative overflow-hidden">
              <form onSubmit={handleCreate} className="h-full flex flex-col">
                <input
                  autoFocus
                  type="text"
                  placeholder="Notebook title..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="bg-transparent border-b border-slate-600 focus:border-blue-500 text-white text-lg font-medium outline-none pb-2 mb-4"
                />
                <div className="mt-auto flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="text-sm text-slate-400 hover:text-white px-3 py-1.5 rounded-full"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-full font-medium transition-colors"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="bg-[#1e1f20] hover:bg-[#282a2c] border border-[#2a2b2e] rounded-2xl p-5 shadow-sm flex flex-col items-center justify-center h-48 transition-colors group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5v14" />
                </svg>
              </div>
              <span className="text-[#a8c7fa] font-medium">Create notebook</span>
            </button>
          )}

          {/* Matter Cards */}
          {matters.map((m) => (
            <button
              key={m.id}
              onClick={() => onSelectMatter(m.id)}
              className="bg-[#1e1f20] hover:bg-[#282a2c] border border-[#2a2b2e] rounded-2xl p-5 shadow-sm flex flex-col items-start h-48 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-[#303134] flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e8eaed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h2 className="text-lg font-medium text-[#e8eaed] truncate w-full mb-1">{m.title || m.id}</h2>
              <div className="mt-auto text-sm text-[#9aa0a6] flex items-center gap-2">
                <span>{m.file_count} sources</span>
                <span>·</span>
                <span className="truncate">{new Date(m.created_at).toLocaleDateString()}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
