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
    try {
      await deleteFile(matterId, filename);
      await loadFiles();
    } catch (e) {
      console.error("Failed to delete file", e);
    }
  };

  return (
    <aside className="w-[300px] flex-shrink-0 bg-[#1e1f20] border-r border-[#303134] flex flex-col h-full select-none">
      {/* Brand / Navigation Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#303134]">
        <button 
          onClick={onGoHome}
          className="w-8 h-8 rounded-full bg-[#303134] hover:bg-[#3c4043] flex items-center justify-center transition-colors flex-shrink-0"
          title="Back to Notebooks"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e8eaed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div className="text-[#e8eaed] text-lg font-medium tracking-tight truncate">
          {matterTitle || "Notebook"}
        </div>
      </div>

      <div className="px-4 py-4 flex items-center justify-between">
        <span className="text-base font-medium text-[#e8eaed]">Sources</span>
        <button className="text-[#9aa0a6] hover:text-[#e8eaed] transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19V5a2 2 0 0 1 2-2h13.4a.5.5 0 0 1 .49.6l-2.7 14a2 2 0 0 1-2 1.4H4z" />
            <path d="M4 19a2 2 0 0 0 2 2h12" />
          </svg>
        </button>
      </div>

      {/* Add Sources Button */}
      <div className="px-4 mb-4">
        <button
          onClick={onShowUpload}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#303134] hover:bg-[#3c4043] text-[#e8eaed] text-sm font-medium transition-colors border border-[#3c4043]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add sources
        </button>
      </div>

      {/* Source list */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1 pb-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-[#8ab4f8] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-8 px-4 text-center">
             <svg className="mb-4 text-[#9aa0a6]" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <p className="text-[#9aa0a6] text-sm leading-relaxed">
              Saved sources will appear here.<br/>
              Click Add source above to add PDFs, websites, text, videos, or audio files.
            </p>
          </div>
        ) : (
          files.map((f) => (
            <div
              key={f.source_file}
              className="flex items-center justify-between px-3 py-3 rounded-xl text-[#e8eaed] hover:bg-[#282a2c] group transition-colors"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8ab4f8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span className="text-sm font-medium truncate" title={f.source_file}>
                  {f.source_file}
                </span>
              </div>
              <button 
                onClick={() => handleDelete(f.source_file)}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-[#9aa0a6] hover:text-[#f28b82] transition-all rounded-md hover:bg-[#303134]"
                title="Delete Source"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
