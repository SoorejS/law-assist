import { useState, useCallback, useEffect } from "react";
import { v4 as uuid } from "./lib/uuid";
import type { Message, MatterInfo, Source, Coworker } from "./lib/types";
import {
  sendQuery,
  sendQueryStream,
  fetchMatters,
  checkSetupStatus,
  fetchCurrentUser,
  fetchChatHistory,
  createMatter,
  fetchCoworkers,
  exportMatterCalendarIcs,
  exportMatterWord,
} from "./lib/api";
import { useEngine } from "./hooks/useEngine";
import { DashboardView } from "./components/DashboardView";
import { SourcesSidebar } from "./components/SourcesSidebar";
import { ChatView } from "./components/ChatView";
import { UploadModal } from "./components/UploadModal";
import { SetupScreen } from "./components/SetupScreen";
import { LoginScreen } from "./components/LoginScreen";
import { IntelligenceSidebar } from "./components/IntelligenceSidebar";
import { ToastContainer, useToast } from "./components/Toast";
import { UpdateBanner } from "./components/UpdateBanner";
import { Onboarding } from "./components/Onboarding";
import { ApprovalModal } from "./components/ApprovalModal";
import { CitationViewerModal } from "./components/CitationViewerModal";
import { CommandPalette } from "./components/CommandPalette";
import { DisplaySettingsModal } from "./components/DisplaySettingsModal";
import { useDisplaySettings } from "./hooks/useDisplaySettings";

type AppState = "loading" | "setup" | "login" | "main";

function MainApp() {
  const { status: engineStatus } = useEngine();
  const displaySettings = useDisplaySettings();
  const [showDisplaySettings, setShowDisplaySettings] = useState(false);
  const [appState, setAppState] = useState<AppState>("loading");
  const [matters, setMatters] = useState<MatterInfo[]>([]);
  const [coworkers, setCoworkers] = useState<Coworker[]>([]);
  const [selectedMatter, setSelectedMatter] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [activeCitationSource, setActiveCitationSource] = useState<Source | null>(null);
  const [user, setUser] = useState<any>(null);
  const [approvalGate, setApprovalGate] = useState<{
    isOpen: boolean;
    title: string;
    actionDescription: string;
    dataScope?: string;
    onApprove: () => void;
  } | null>(null);
  const { addToast } = useToast();

  const requestApproval = useCallback((opts: {
    title: string;
    actionDescription: string;
    dataScope?: string;
    onApprove: () => void;
  }) => {
    setApprovalGate({
      isOpen: true,
      ...opts,
    });
  }, []);

  // Initialize Auth State
  useEffect(() => {
    if (engineStatus !== "ready") return;
    const init = async () => {
      try {
        const isSetup = await checkSetupStatus();
        if (!isSetup) { setAppState("setup"); return; }
        const token = localStorage.getItem("auth_token");
        if (!token) { setAppState("login"); return; }
        try {
          const u = await fetchCurrentUser();
          setUser(u);
          setAppState("main");
          // Show onboarding for first-time users
          if (!localStorage.getItem("onboarding_complete")) {
            setShowOnboarding(true);
          }
        } catch {
          setAppState("login");
        }
      } catch (e) {
        console.error("Initialization error:", e);
      }
    };
    init();
  }, [engineStatus]);

  // Handle auto logout
  useEffect(() => {
    const onAuthExpired = () => {
      setAppState("login");
      addToast("Your session expired. Please sign in again.", "info");
    };
    window.addEventListener("auth_expired", onAuthExpired);
    return () => window.removeEventListener("auth_expired", onAuthExpired);
  }, []);

  // Load coworkers and matters when entering main state
  useEffect(() => {
    if (appState !== "main") return;
    refreshMatters();
    fetchCoworkers().then(res => setCoworkers(res.coworkers || [])).catch(() => {});
  }, [appState]);

  // Global Ctrl+K / Cmd+K listener for Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Load chat history when matter changes
  useEffect(() => {
    if (appState !== "main") return;
    setMessages([]);
    if (selectedMatter) {
      fetchChatHistory(selectedMatter)
        .then(hist => {
          const formatted = hist.map(m => ({
            id: uuid(),
            role: m.role,
            content: m.content,
            timestamp: new Date(m.created_at || Date.now()),
          }));
          setMessages(formatted);
        })
        .catch(console.error);
    }
  }, [selectedMatter, appState]);

  const refreshMatters = useCallback(async () => {
    try {
      const data = await fetchMatters();
      setMatters(data);
    } catch {
      addToast("Could not load notebooks. Is the engine running?", "error");
    }
  }, []);

  const handleSend = useCallback(
    async (query: string, forceCloud: boolean) => {
      if (isLoading) return;
      const userMsg: Message = { id: uuid(), role: "user", content: query, timestamp: new Date() };
      const aiMsgId = uuid();
      const streamingPlaceholder: Message = {
        id: aiMsgId,
        role: "assistant",
        content: "",
        isStreaming: true,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMsg, streamingPlaceholder]);
      setIsLoading(true);

      try {
        await sendQueryStream(
          query,
          selectedMatter,
          forceCloud,
          {
            onMetadata: (meta) => {
              setMessages(prev =>
                prev.map(m =>
                  m.id === aiMsgId
                    ? {
                        ...m,
                        sources: meta.sources,
                        backend: meta.backend_used,
                        escalated: meta.escalated,
                        cached: meta.cached,
                      }
                    : m
                )
              );
            },
            onToken: (token) => {
              setMessages(prev =>
                prev.map(m =>
                  m.id === aiMsgId
                    ? { ...m, content: m.content + token }
                    : m
                )
              );
            },
            onDone: (result) => {
              setMessages(prev =>
                prev.map(m =>
                  m.id === aiMsgId
                    ? {
                        ...m,
                        content: result.answer,
                        sources: result.sources,
                        backend: result.backend_used,
                        escalated: result.escalated,
                        timing: result.timing,
                        follow_ups: result.follow_ups,
                        cached: result.cached,
                        isStreaming: false,
                      }
                    : m
                )
              );
            },
          }
        );
      } catch (streamErr: any) {
        // Fallback to traditional non-streaming query
        try {
          const result = await sendQuery(query, selectedMatter, forceCloud);
          setMessages(prev =>
            prev.map(m =>
              m.id === aiMsgId
                ? {
                    ...m,
                    content: result.answer,
                    sources: result.sources,
                    backend: result.backend_used,
                    escalated: result.escalated,
                    timing: result.timing,
                    follow_ups: result.follow_ups,
                    cached: result.cached,
                    isStreaming: false,
                  }
                : m
            )
          );
        } catch (e: any) {
          setMessages(prev =>
            prev.map(m =>
              m.id === aiMsgId
                ? {
                    ...m,
                    content: `Engine error: ${e?.message ?? "unknown error"}. Please ensure the engine is running.`,
                    isError: true,
                    isStreaming: false,
                  }
                : m
            )
          );
          addToast("Query failed. Check the engine is running.", "error");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, selectedMatter]
  );

  const handleNewMatter = useCallback(async (name: string, tags?: string[]) => {
    try {
      const res = await createMatter(name, "", tags || []);
      await refreshMatters();
      setSelectedMatter(res.id);
      addToast(`Matter "${name}" created.`, "success");
    } catch (e: any) {
      addToast(`Failed to create matter: ${e?.message ?? "unknown error"}`, "error");
    }
  }, [refreshMatters]);

  const handleExportCalendar = useCallback(async () => {
    if (!selectedMatter) return;
    try {
      const blob = await exportMatterCalendarIcs(selectedMatter);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ProAssist_Deadlines_${selectedMatter}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      addToast("Deadlines exported to calendar (.ics)", "success");
    } catch (e: any) {
      addToast("Failed to export calendar deadlines", "error");
    }
  }, [selectedMatter]);

  const handleExportWord = useCallback(async (matterId?: string) => {
    const targetId = matterId || selectedMatter;
    if (!targetId) return;
    try {
      const blob = await exportMatterWord(targetId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const targetM = matters.find(m => m.id === targetId);
      const safeTitle = targetM ? targetM.title.replace(/[^a-zA-Z0-9_-]/g, "_") : `Matter_${targetId}`;
      a.download = `${safeTitle}_Brief.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      addToast("Executive report exported (.docx)", "success");
    } catch (e: any) {
      addToast("Failed to export Word report", "error");
    }
  }, [selectedMatter, matters]);

  const handleUploadDone = useCallback(
    (matterId: string) => {
      refreshMatters().then(() => setSelectedMatter(matterId));
      addToast("Sources uploaded successfully.", "success");
    },
    [refreshMatters]
  );

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    setUser(null);
    setSelectedMatter(null);
    setMessages([]);
    setAppState("login");
  };

  if (engineStatus !== "ready" || appState === "loading") {
    return <StartingScreen status={engineStatus} />;
  }
  if (appState === "setup") {
    return <SetupScreen onComplete={() => setAppState("login")} />;
  }
  if (appState === "login") {
    return <LoginScreen onLogin={async () => {
      const u = await fetchCurrentUser();
      setUser(u);
      setAppState("main");
      if (!localStorage.getItem("onboarding_complete")) setShowOnboarding(true);
    }} />;
  }

  const currentMatter = matters.find(m => m.id === selectedMatter);

  return (
    <div className="flex h-screen bg-[#0d0f14] font-sans overflow-hidden">
      <UpdateBanner />

      {/* Top right quick actions */}
      <div className="absolute top-4 right-6 z-50 flex items-center gap-2.5">
        {/* In-App Zoom Stepper */}
        <div className="flex items-center bg-[#161a23] border border-[#2d323f] rounded-xl overflow-hidden shadow-sm">
          <button
            onClick={displaySettings.zoomOut}
            disabled={displaySettings.settings.zoom <= 80}
            title="Zoom Out (Ctrl + Minus)"
            className="px-2.5 py-2 text-slate-300 hover:text-white hover:bg-[#202532] transition-colors text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed"
          >
            −
          </button>
          <button
            onClick={() => setShowDisplaySettings(true)}
            title="Click to open Display & Font Settings"
            className="px-2.5 py-2 text-xs sm:text-sm font-bold text-blue-400 hover:bg-[#202532] border-x border-[#2d323f] transition-colors font-mono"
          >
            {displaySettings.settings.zoom}%
          </button>
          <button
            onClick={displaySettings.zoomIn}
            disabled={displaySettings.settings.zoom >= 150}
            title="Zoom In (Ctrl + Plus)"
            className="px-2.5 py-2 text-slate-300 hover:text-white hover:bg-[#202532] transition-colors text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>

        {/* Display & Reading Preferences */}
        <button
          onClick={() => setShowDisplaySettings(true)}
          className="flex items-center gap-2 bg-[#161a23] hover:bg-[#202532] border border-[#2d323f] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-200 hover:text-white transition-colors shadow-sm cursor-pointer"
          title="Open Display, Font Style, and Reading Preferences"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Display</span>
        </button>

        <button
          onClick={() => setShowCommandPalette(true)}
          className="flex items-center gap-2 bg-[#161a23] hover:bg-[#202532] border border-[#2d323f] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-200 transition-colors shadow-sm"
          title="Global Search & Navigation (Ctrl+K)"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-400">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>Spotlight</span>
          <kbd className="bg-[#202532] text-xs px-1.5 py-0.5 rounded border border-[#2d323f] text-slate-400 font-mono">
            Ctrl+K
          </kbd>
        </button>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 bg-[#161a23] hover:bg-[#202532] border border-[#2d323f] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white transition-colors shadow-sm"
        >
          <div className="w-6 h-6 bg-blue-600 rounded-full text-white flex items-center justify-center font-bold text-xs">
            {user?.full_name?.charAt(0)?.toUpperCase()}
          </div>
          <span>{user?.full_name} · Logout</span>
        </button>
      </div>

      {!selectedMatter ? (
        <DashboardView
          matters={matters}
          onSelectMatter={setSelectedMatter}
          onCreateMatter={handleNewMatter}
          onOpenCommandPalette={() => setShowCommandPalette(true)}
          onExportWord={(mId) => handleExportWord(mId)}
          onOpenDisplaySettings={() => setShowDisplaySettings(true)}
        />
      ) : (
        <div className="flex flex-1 overflow-hidden h-full">
          {/* Left Sidebar (Sources) */}
          <SourcesSidebar
            matterId={selectedMatter}
            matterTitle={currentMatter?.title}
            onShowUpload={() => setShowUpload(true)}
            onGoHome={() => setSelectedMatter(null)}
          />

          {/* Center (Chat) */}
          <div className="flex flex-col flex-1 overflow-hidden relative z-10 bg-[#0d0f14]">
            {/* Top Bar with Word Export & Actions */}
            <div className="flex-shrink-0 h-16 bg-[#161a23] border-b border-[#2d323f] flex items-center justify-between px-6 z-20">
              <div className="flex items-center gap-3 text-white font-medium">
                <span className="text-lg sm:text-xl font-bold text-white">{currentMatter?.title || selectedMatter}</span>
                {currentMatter?.tags && currentMatter.tags.length > 0 && (
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/30">
                    {currentMatter.tags[0]}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mr-[440px]">
                <button
                  onClick={() => handleExportWord()}
                  className="text-xs sm:text-sm font-semibold bg-[#202532] hover:bg-[#2c3344] text-slate-200 hover:text-white border border-[#2d323f] rounded-xl px-4 py-2 flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                  title="Export full executive case brief as Microsoft Word (.docx)"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  <span>Export Brief (.docx)</span>
                </button>
                <button
                  onClick={handleExportCalendar}
                  className="text-xs sm:text-sm font-semibold bg-[#202532] hover:bg-[#2c3344] text-slate-200 hover:text-white border border-[#2d323f] rounded-xl px-4 py-2 flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                  title="Export court deadlines to Calendar (.ics)"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span>Calendar (.ics)</span>
                </button>
              </div>
            </div>

            <ChatView
              messages={messages}
              isLoading={isLoading}
              selectedFolder={selectedMatter}
              matterTitle={currentMatter?.title}
              onSend={handleSend}
              onClearChat={() => setMessages([])}
              onSelectSource={setActiveCitationSource}
              onRequestApproval={requestApproval}
            />
          </div>

          {/* Right Sidebar (AI Coworkers & Notebook Guide) */}
          <IntelligenceSidebar
            matterId={selectedMatter}
            matterTitle={currentMatter?.title}
            onRequestApproval={requestApproval}
            onOutcomeGenerated={(out) => {
              addToast(`Coworker "${out.coworker_name}" completed task!`, "success");
            }}
            onExportWord={() => handleExportWord()}
          />
        </div>
      )}

      {showUpload && (
        <UploadModal
          matters={matters}
          defaultMatter={selectedMatter}
          onClose={() => setShowUpload(false)}
          onDone={handleUploadDone}
        />
      )}

      {showOnboarding && (
        <Onboarding
          onComplete={() => {
            localStorage.setItem("onboarding_complete", "true");
            setShowOnboarding(false);
          }}
        />
      )}

      {/* Interactive Citation Viewer Modal */}
      <CitationViewerModal
        source={activeCitationSource}
        onClose={() => setActiveCitationSource(null)}
      />

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        matters={matters}
        coworkers={coworkers}
        currentMatterId={selectedMatter}
        onSelectMatter={setSelectedMatter}
        onOpenNewMatter={() => {
          setSelectedMatter(null);
        }}
        onOpenUpload={() => setShowUpload(true)}
        onOpenGlobalSearch={() => setShowCommandPalette(true)}
        onOpenCoworkers={() => {}}
        onExportCalendar={handleExportCalendar}
        onExportWord={handleExportWord}
        onOpenDisplaySettings={() => setShowDisplaySettings(true)}
      />

      {/* Human-in-the-Loop Action Approval Gate (OpenWorker Protocol) */}
      <ApprovalModal
        isOpen={!!approvalGate?.isOpen}
        title={approvalGate?.title || "Action Approval Gate"}
        actionDescription={approvalGate?.actionDescription || ""}
        dataScope={approvalGate?.dataScope}
        onApprove={() => {
          const fn = approvalGate?.onApprove;
          setApprovalGate(null);
          fn?.();
        }}
        onCancel={() => setApprovalGate(null)}
      />

      {/* Display & Reading Preferences Modal */}
      <DisplaySettingsModal
        isOpen={showDisplaySettings}
        onClose={() => setShowDisplaySettings(false)}
        settings={displaySettings.settings}
        updateSetting={displaySettings.updateSetting}
        zoomIn={displaySettings.zoomIn}
        zoomOut={displaySettings.zoomOut}
        resetZoom={displaySettings.resetZoom}
        resetAll={displaySettings.resetAll}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastContainer>
      <MainApp />
    </ToastContainer>
  );
}

function StartingScreen({ status }: { status: any }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#0B1120]">
      <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-2xl ring-4 ring-blue-500/20">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </div>
      {status === "starting" ? (
        <>
          <div className="text-center">
            <p className="text-white text-xl font-semibold mb-2">Starting law-assist Engine…</p>
            <p className="text-slate-400 text-sm">Loading AI models securely on your machine.</p>
          </div>
          <div className="flex gap-1.5 mt-2">
            {[0, 150, 300].map((d, i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        </>
      ) : (
        <div className="text-center">
          <p className="text-white text-xl font-semibold mb-2">Engine Offline</p>
          <p className="text-slate-400 text-sm max-w-sm">
            The AI engine is not running. Start it with <code className="bg-slate-800 px-2 py-0.5 rounded text-blue-400">python api.py</code>
          </p>
        </div>
      )}
    </div>
  );
}
