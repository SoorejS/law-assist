import { useState, useCallback, useRef } from "react";
import type { MatterInfo } from "../lib/types";
import { uploadFile } from "../lib/api";

interface Props {
  matters: MatterInfo[];
  defaultMatter: string | null;
  onClose: () => void;
  onDone: (matterId: string) => void;
}

type FileStatus = "pending" | "uploading" | "done" | "error" | "skipped";

interface FileItem {
  file: File;
  status: FileStatus;
  chunks?: number;
  error?: string;
  progress: number; // 0-100
}

export function UploadModal({ matters, defaultMatter, onClose, onDone }: Props) {
  const targetMatter = defaultMatter ?? "default";
  const [dragOver, setDragOver] = useState(false);
  const [fileItems, setFileItems] = useState<FileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ALLOWED = /\.(pdf|docx|csv|xlsx|xls|txt|md)$/i;
  const MAX_MB = 150;

  const addFiles = useCallback((incoming: File[]) => {
    const valid: FileItem[] = [];
    for (const f of incoming) {
      if (!ALLOWED.test(f.name)) continue;
      const mb = f.size / (1024 * 1024);
      if (mb > MAX_MB) {
        valid.push({ file: f, status: "error", error: `Too large (${mb.toFixed(0)}MB, max ${MAX_MB}MB)`, progress: 0 });
        continue;
      }
      valid.push({ file: f, status: "pending", progress: 0 });
    }
    setFileItems(prev => {
      const names = new Set(prev.map(i => i.file.name));
      return [...prev, ...valid.filter(i => !names.has(i.file.name))];
    });
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const removeFile = (name: string) =>
    setFileItems(prev => prev.filter(i => i.file.name !== name));

  const updateItem = (name: string, patch: Partial<FileItem>) =>
    setFileItems(prev => prev.map(i => i.file.name === name ? { ...i, ...patch } : i));

  const handleUpload = async () => {
    const uploadable = fileItems.filter(i => i.status === "pending");
    if (uploadable.length === 0) return;
    setIsUploading(true);

    for (const item of uploadable) {
      updateItem(item.file.name, { status: "uploading", progress: 10 });
      try {
        // Simulate progress steps while real upload happens
        const progressInterval = setInterval(() => {
          setFileItems(prev => prev.map(i =>
            i.file.name === item.file.name && i.progress < 80
              ? { ...i, progress: i.progress + 15 }
              : i
          ));
        }, 300);

        const result = await uploadFile(item.file, targetMatter);
        clearInterval(progressInterval);

        if (result.skipped) {
          updateItem(item.file.name, { status: "skipped", progress: 100 });
        } else {
          updateItem(item.file.name, { status: "done", chunks: result.chunks_added, progress: 100 });
        }
      } catch (e: any) {
        updateItem(item.file.name, {
          status: "error",
          error: e?.message?.replace(/Engine error \d+: /, "").replace(/{"detail":"/, "").replace(/"}/g, "") || "Upload failed",
          progress: 0,
        });
      }
    }

    setIsUploading(false);
    setIsDone(true);
    onDone(targetMatter);
    window.dispatchEvent(new Event("upload_done"));
    setTimeout(onClose, 2000);
  };

  const pendingCount = fileItems.filter(i => i.status === "pending").length;
  const doneCount = fileItems.filter(i => i.status === "done" || i.status === "skipped").length;
  const errorCount = fileItems.filter(i => i.status === "error").length;

  const statusIcon = (status: FileStatus) => {
    if (status === "done") return <span className="text-emerald-400">✓</span>;
    if (status === "skipped") return <span className="text-amber-400">↩</span>;
    if (status === "error") return <span className="text-red-400">✕</span>;
    if (status === "uploading") return (
      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8ab4f8" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
    );
    return null;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && !isUploading && onClose()}
    >
      <div className="bg-[#1e1f20] rounded-[28px] shadow-2xl w-full max-w-2xl mx-4 overflow-hidden border border-[#303134] relative">
        {!isUploading && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-[#9aa0a6] hover:text-[#e8eaed] p-1.5 rounded-full hover:bg-[#303134] transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}

        <div className="p-8">
          <h2 className="text-[#e8eaed] font-semibold text-xl mb-1">Add sources</h2>
          <p className="text-[#9aa0a6] text-sm mb-6">Upload documents to your notebook. All data stays on this machine.</p>

          {/* Drop Zone */}
          {fileItems.length === 0 && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`w-full border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-all ${
                dragOver
                  ? "border-[#8ab4f8] bg-[#8ab4f8]/5"
                  : "border-[#3c4043] hover:border-[#5f6368] hover:bg-[#282a2c]"
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-[#303134] flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8ab4f8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="text-[#e8eaed] font-medium mb-1">Drop files here or click to browse</p>
                <p className="text-[#9aa0a6] text-sm">PDF, DOCX, TXT, CSV, XLSX · Max {MAX_MB}MB per file</p>
              </div>
            </div>
          )}

          {/* File list */}
          {fileItems.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {fileItems.map(item => (
                <div key={item.file.name} className="flex items-center gap-3 px-4 py-3 bg-[#282a2c] rounded-xl">
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    {statusIcon(item.status) ?? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#e8eaed] truncate">{item.file.name}</span>
                      <span className="text-xs text-[#9aa0a6] ml-2 flex-shrink-0">
                        {item.status === "done" ? `${item.chunks} chunks` :
                         item.status === "skipped" ? "Already ingested" :
                         (item.file.size / 1024 / 1024).toFixed(1) + " MB"}
                      </span>
                    </div>
                    {item.status === "uploading" && (
                      <div className="mt-1.5 w-full bg-[#303134] rounded-full h-1">
                        <div className="bg-[#8ab4f8] h-1 rounded-full transition-all duration-300" style={{ width: `${item.progress}%` }} />
                      </div>
                    )}
                    {item.status === "error" && item.error && (
                      <p className="text-xs text-red-400 mt-1 truncate">{item.error}</p>
                    )}
                  </div>
                  {item.status === "pending" && (
                    <button onClick={() => removeFile(item.file.name)} className="flex-shrink-0 text-[#9aa0a6] hover:text-[#f28b82] transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add more / summary */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {fileItems.length > 0 && !isDone && (
                <button
                  onClick={() => inputRef.current?.click()}
                  className="text-sm text-[#9aa0a6] hover:text-[#e8eaed] transition-colors flex items-center gap-1"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5v14"/>
                  </svg>
                  Add more
                </button>
              )}
              {isDone && (
                <span className="text-sm text-emerald-400 font-medium">
                  ✓ {doneCount} ingested{errorCount > 0 ? `, ${errorCount} failed` : ""}
                </span>
              )}
            </div>

            {pendingCount > 0 && !isUploading && (
              <button
                onClick={handleUpload}
                className="px-6 py-2.5 bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#131314] rounded-full text-sm font-semibold transition-colors"
              >
                Upload {pendingCount} {pendingCount === 1 ? "file" : "files"}
              </button>
            )}
            {isUploading && (
              <span className="text-sm text-[#9aa0a6] flex items-center gap-2">
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Processing…
              </span>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.csv,.xlsx,.xls,.txt,.md"
            className="hidden"
            onChange={e => addFiles(Array.from(e.target.files ?? []))}
          />
        </div>
      </div>
    </div>
  );
}
