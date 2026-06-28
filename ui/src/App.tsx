import { useState, useCallback, useEffect } from "react";
import { v4 as uuid } from "./lib/uuid";
import type { Message, MatterInfo } from "./lib/types";
import { sendQuery, fetchMatters, checkSetupStatus, fetchCurrentUser, fetchChatHistory, createMatter } from "./lib/api";
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

type AppState = "loading" | "setup" | "login" | "main";

function MainApp() {
  const { status: engineStatus } = useEngine();
  const [appState, setAppState] = useState<AppState>("loading");
  const [matters, setMatters] = useState<MatterInfo[]>([]);
  const [selectedMatter, setSelectedMatter] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [user, setUser] = useState<any>(null);
  const { addToast } = useToast();

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

  // Load matters when entering main state
  useEffect(() => {
    if (appState !== "main") return;
    refreshMatters();
  }, [appState]);

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
      setMessages(prev => [...prev, userMsg]);
      setIsLoading(true);
      try {
        const result = await sendQuery(query, selectedMatter, forceCloud);
        const aiMsg: Message = {
          id: uuid(),
          role: "assistant",
          content: result.answer,
          sources: result.sources,
          backend: result.backend_used,
          escalated: result.escalated,
          timing: result.timing,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMsg]);
      } catch (e: any) {
        const errMsg: Message = {
          id: uuid(),
          role: "assistant",
          content: `Engine error: ${e?.message ?? "unknown error"}. Please ensure the engine is running.`,
          timestamp: new Date(),
          isError: true,
        };
        setMessages(prev => [...prev, errMsg]);
        addToast("Query failed. Check the engine is running.", "error");
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, selectedMatter]
  );

  const handleNewMatter = useCallback(async (name: string) => {
    try {
      const res = await createMatter(name);
      await refreshMatters();
      setSelectedMatter(res.id);
      addToast(`Notebook "${name}" created.`, "success");
    } catch (e: any) {
      addToast(`Failed to create notebook: ${e?.message ?? "unknown error"}`, "error");
    }
  }, [refreshMatters]);

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
    <div className="flex h-screen bg-[#131314] font-sans overflow-hidden">
      <UpdateBanner />

      {/* User profile / logout */}
      <div className="absolute top-4 right-6 z-50">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 bg-[#1e1f20] hover:bg-[#282a2c] border border-[#303134] px-3 py-1.5 rounded-full text-xs font-medium text-[#e8eaed] transition-colors"
        >
          <div className="w-5 h-5 bg-[#8ab4f8] rounded-full text-[#131314] flex items-center justify-center font-bold text-[10px]">
            {user?.full_name?.charAt(0)?.toUpperCase()}
          </div>
          {user?.full_name} · Logout
        </button>
      </div>

      {!selectedMatter ? (
        <DashboardView
          matters={matters}
          onSelectMatter={setSelectedMatter}
          onCreateMatter={handleNewMatter}
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
          <div className="flex flex-col flex-1 overflow-hidden relative z-10 bg-[#131314]">
            <ChatView
              messages={messages}
              isLoading={isLoading}
              selectedFolder={selectedMatter}
              matterTitle={currentMatter?.title}
              onSend={handleSend}
              onClearChat={() => setMessages([])}
            />
          </div>

          {/* Right Sidebar (AI Intelligence) */}
          <IntelligenceSidebar matterId={selectedMatter} />
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
