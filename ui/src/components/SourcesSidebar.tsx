import { useEffect, useState } from "react";
import { fetchFiles, deleteFile } from "../lib/api";
import type { FileInfo } from "../lib/types";

interface Props {
  matterId: string;
  matterTitle?: string;
  onShowUpload: () => void;
  onGoHome: () => void;
}

export function SourcesSidebar({ matterId, matterTitle, onShowUpload, onGoHome }: Props) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const data = await fetchFiles(matterId);
      setFiles(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
    
    // Listen for upload done event
    const handleUploadDone = () => loadFiles();
    window.addEventListener("upload_done", handleUploadDone);
    return () => window.removeEventListener("upload_done", handleUploadDone);
  }, [matterId]);

  const handleDelete = async (filename: string) => {
    if (!window.confirm(`Are you sure you want to remove "${filename}" and its indexed knowledge from this dossier?`)) {
      return;
    }
    try {
      await deleteFile(matterId, filename);
      await loadFiles();
    } catch (e) {
      console.error("Failed to delete file", e);
    }
  };

  return (
    <aside className="w-[320px] xl:w-[360px] flex-shrink-0 bg-[#101218] border-r border-[#232834] flex flex-col h-full select-none">
      {/* Brand / Navigation Header */}
      <div className="flex items-center gap-3.5 px-6 py-5 border-b border-[#232834] bg-[#141720]">
        <button 
          onClick={onGoHome}
          className="w-9 h-9 rounded-xl bg-[#202532] hover:bg-blue-600/20 text-slate-200 hover:text-blue-300 flex items-center justify-center transition-all flex-shrink-0 border border-[#2d3344] cursor-pointer shadow-sm"
          title="Back to All Workspaces"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div className="overflow-hidden">
          <span className="text-xs uppercase font-bold text-blue-400 tracking-wider block">Dossier Workspace</span>
          <div className="text-white text-base sm:text-lg font-bold tracking-tight truncate" title={matterTitle || "Matter Dossier"}>
            {matterTitle || "Matter Dossier"}
          </div>
        </div>
      </div>

      {/* Sources Header Bar */}
      <div className="px-6 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-200 uppercase tracking-wider">Indexed Documents</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#202532] text-blue-300 border border-[#2d3344]">
            {files.length}
          </span>
        </div>
      </div>

      {/* Add Sources Button */}
      <div className="px-6 mb-5">
        <button
          onClick={onShowUpload}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm sm:text-base font-bold transition-all shadow-md shadow-blue-600/30 cursor-pointer"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          + Add Case Documents
        </button>
      </div>

      {/* Source list */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
            <div className="w-6 h-6 border-3 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium">Loading dossier records...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-6 px-4 py-8 text-center bg-[#151821] rounded-2xl border border-dashed border-[#2d3344]">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <p className="text-slate-200 text-sm font-semibold mb-1">
              No files in this dossier yet
            </p>
            <p className="text-slate-400 text-xs leading-relaxed max-w-[200px]">
              Click "+ Add Case Documents" above to ingest PDFs, FIRs, Word files, contracts, or tax returns.
            </p>
          </div>
        ) : (
          files.map((f) => (
            <div
              key={f.source_file}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-[#151821] border border-[#252a38] text-slate-100 hover:border-blue-500/40 hover:bg-[#1a1f2b] group transition-all shadow-sm"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <div className="overflow-hidden">
                  <span className="text-sm sm:text-base font-semibold text-white truncate block" title={f.source_file}>
                    {f.source_file}
                  </span>
                  <span className="text-xs text-slate-400 font-medium block">
                    {f.chunks ?? (f as any).chunk_count ?? 0} passages indexed
                  </span>
                </div>
              </div>
              <button 
                onClick={() => handleDelete(f.source_file)}
                className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-400 transition-all rounded-xl hover:bg-red-500/10 cursor-pointer"
                title="Remove Document"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
