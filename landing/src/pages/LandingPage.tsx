import { useNavigate } from "react-router-dom";
import { useState } from "react";

// ── Nav ──────────────────────────────────────────────────────────────────────

function Nav() {
  const navigate = useNavigate();
  return (
    <nav className="fixed w-full z-50 bg-[#0B1120]/80 backdrop-blur-lg border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-white" style={{ fontFamily: "Outfit, sans-serif" }}>law-assist</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#security" className="hover:text-white transition-colors">Security</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
        </div>
        <button
          onClick={() => navigate("/download")}
          className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-[0_0_20px_-5px_rgba(37,99,235,0.6)]"
        >
          Download Free
        </button>
      </div>
    </nav>
  );
}

// ── Hero Section ─────────────────────────────────────────────────────────────

function Hero() {
  const navigate = useNavigate();
  return (
    <section className="relative pt-36 pb-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(37,99,235,0.15),transparent)]" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNMzAgMzBoMXYxaC0xek0wIDMwaDF2MUgwek02MCAzMGgxdjFoLTF6TTMwIDBoMXYxaC0xek0zMCA2MGgxdjFoLTF6IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIi8+PC9nPjwvc3ZnPg==')] opacity-40" />

      <div className="max-w-5xl mx-auto px-6 relative z-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold tracking-wide uppercase mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Private · Offline · Zero Cloud
        </div>

        <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight text-white mb-6 leading-[1.05]" style={{ fontFamily: "Outfit, sans-serif" }}>
          Private Legal<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-300 to-indigo-400">
            Intelligence
          </span>
        </h1>

        <p className="text-xl text-slate-400 mb-4 font-medium">Private Legal Intelligence Platform</p>
        <p className="text-lg text-slate-500 mb-12 max-w-2xl mx-auto leading-relaxed">
          Run AI-powered legal research on confidential documents without sending data to external servers. 100% offline. No subscriptions. Complete attorney-client privilege.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <button
            onClick={() => navigate("/download")}
            className="w-full sm:w-auto px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-base transition-all flex items-center justify-center gap-2.5 shadow-[0_0_40px_-8px_rgba(37,99,235,0.5)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download for Windows — Free
          </button>
          <a href="#features" className="w-full sm:w-auto px-8 py-4 rounded-full border border-white/10 hover:bg-white/5 text-white font-medium text-base transition-all text-center">
            See how it works →
          </a>
        </div>

        {/* App Mockup */}
        <div className="mx-auto max-w-5xl rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_80px_-20px_rgba(37,99,235,0.2)]" style={{ background: "linear-gradient(180deg, #1a1d2e 0%, #131314 100%)" }}>
          {/* Window chrome */}
          <div className="h-10 bg-[#1e1f20] border-b border-white/5 flex items-center px-4 gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/60 border border-red-500/30" />
            <div className="w-3 h-3 rounded-full bg-amber-500/60 border border-amber-500/30" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/60 border border-emerald-500/30" />
            <div className="ml-4 flex-1 text-center text-xs text-slate-600">law-assist · Matter: Singh v. State 2024</div>
          </div>
          {/* App layout */}
          <div className="flex h-80 relative">
            {/* Left sidebar */}
            <div className="w-64 border-r border-white/5 p-4 flex flex-col gap-3 flex-shrink-0">
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Sources</div>
                <div className="w-5 h-5 rounded-md bg-blue-500/20 flex items-center justify-center">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#8ab4f8" strokeWidth="3"><path d="M5 12h14M12 5v14"/></svg>
                </div>
              </div>
              {["FIR_2024_001.pdf", "Charge_Sheet.pdf", "Bail_Order.pdf", "Evidence_List.docx", "Witness_Statements.pdf"].map((name, i) => (
                <div key={i} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg ${i === 0 ? "bg-blue-500/10 border border-blue-500/20" : "hover:bg-white/5"}`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={i === 0 ? "#8ab4f8" : "#4b5563"} strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span className={`text-xs truncate ${i === 0 ? "text-blue-300" : "text-slate-500"}`}>{name}</span>
                </div>
              ))}
            </div>

            {/* Chat area */}
            <div className="flex-1 flex flex-col p-6 justify-end gap-3 overflow-hidden">
              <div className="self-end max-w-sm bg-[#303134] rounded-2xl px-4 py-3">
                <p className="text-xs text-slate-300">What are the key facts from the FIR and are there any contradictions with the witness statements?</p>
              </div>
              <div className="max-w-lg">
                <div className="flex gap-2.5 mb-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex-shrink-0 flex items-center justify-center">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </div>
                  <div>
                    <p className="text-xs text-slate-300 mb-2">Based on the FIR No. 2024/001 (Singh v. State), the complainant alleges the incident occurred at 22:00 hrs on 14 March 2024. However, Witness Statement #3 (Ramesh Kumar) places the accused at a different location at 21:45 hrs...</p>
                    <div className="flex gap-1.5">
                      <span className="text-[10px] bg-blue-900/40 border border-blue-700/30 text-blue-400 px-2 py-0.5 rounded-full">FIR_2024_001.pdf · p.2</span>
                      <span className="text-[10px] bg-blue-900/40 border border-blue-700/30 text-blue-400 px-2 py-0.5 rounded-full">Witness_Statements.pdf · p.7</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Input bar */}
              <div className="flex items-center gap-2 bg-[#1e1f20] border border-[#303134] rounded-full px-4 py-2.5">
                <span className="text-xs text-slate-600 flex-1">Ask a question about your documents...</span>
                <div className="w-7 h-7 rounded-full bg-[#303134] flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </div>
              </div>
            </div>

            {/* Right sidebar */}
            <div className="w-56 border-l border-white/5 p-4 flex-shrink-0">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">Notebook guide</div>
              <div className="space-y-3">
                {[
                  { label: "Timeline", icon: "🗓", count: 6 },
                  { label: "Key People", icon: "👤", count: 4 },
                  { label: "Contradictions", icon: "⚠️", count: 2 },
                  { label: "Missing Evidence", icon: "🔍", count: 3 },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{item.icon}</span>
                      <span className="text-xs text-slate-400">{item.label}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-500">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Feature Grid ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: "🔒",
    title: "100% Offline",
    body: "The AI model runs entirely on your local hardware. No API calls, no cloud. Confidential documents never leave your network.",
  },
  {
    icon: "📚",
    title: "NotebookLM for Legal",
    body: "Organize cases into dedicated Notebooks. Chat with your documents and receive answers with exact page citations.",
  },
  {
    icon: "🧠",
    title: "Automated Intelligence",
    body: "Instantly extracts a Timeline of Events, Key People, Contradictions, and Missing Evidence from every uploaded document.",
  },
  {
    icon: "👥",
    title: "Multi-User Workstation",
    body: "Built for shared office PCs. Netflix-style login, Role-Based Access Control, and per-user matter isolation.",
  },
  {
    icon: "📄",
    title: "Universal Documents",
    body: "Ingest PDF, DOCX, TXT, CSV, XLSX files. Automatic document type detection for FIRs, judgments, contracts, affidavits.",
  },
  {
    icon: "⚡",
    title: "Hybrid AI Engine",
    body: "Local LLM for speed and privacy. Optional escalation to Sarvam or Anthropic for complex synthesis — your choice.",
  },
];

function FeatureGrid() {
  return (
    <section id="features" className="py-24 bg-[#080d18]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
            Everything a law firm needs
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Built from the ground up for Indian legal workflows, with support for FIRs, charge sheets, judgments, and more.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <div key={i} className="group p-7 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all cursor-default">
              <div className="text-3xl mb-5">{f.icon}</div>
              <h3 className="text-lg font-semibold text-white mb-3">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Security Section ──────────────────────────────────────────────────────────

function SecuritySection() {
  return (
    <section id="security" className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="rounded-3xl border border-white/5 overflow-hidden" style={{ background: "linear-gradient(135deg, #0f172a 0%, #0B1120 100%)" }}>
          <div className="p-10 md:p-16 grid md:grid-cols-2 gap-12 items-center relative">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl" />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-6">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Bank-Grade Confidentiality
              </div>
              <h2 className="text-4xl font-bold text-white mb-6" style={{ fontFamily: "Outfit, sans-serif" }}>
                Zero Cloud.<br />Zero Risk.
              </h2>
              <p className="text-slate-400 leading-relaxed mb-8">
                Uploading client files to ChatGPT or Gemini may violate attorney-client privilege and local data protection laws. law-assist runs a 1GB local LLM directly on your PC — no internet connection required for inference.
              </p>
              <ul className="space-y-4">
                {[
                  "No internet connection required for document analysis",
                  "No recurring API costs or token billing",
                  "Data never leaves your local hard drive",
                  "Secure JWT sessions per user",
                  "SQLite + sqlite-vec — zero external DB dependencies",
                  "Configurable per-role access controls",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-300 text-sm">
                    <svg className="flex-shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative z-10">
              <div className="rounded-2xl border border-white/10 bg-[#0B1120] p-8 text-center">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/20 flex items-center justify-center mx-auto mb-6">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#8ab4f8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
                  </svg>
                </div>
                <p className="text-white font-semibold mb-2">All processing on your hardware</p>
                <p className="text-slate-500 text-sm mb-6">SQLite · sqlite-vec · Llama.cpp · BGE-m3</p>
                <div className="grid grid-cols-2 gap-3 text-center">
                  {[["0", "External API calls"], ["∞", "Documents supported"], ["8hrs", "JWT session"], ["5", "Default user seats"]].map(([val, label], i) => (
                    <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                      <div className="text-2xl font-bold text-blue-400 mb-1">{val}</div>
                      <div className="text-[11px] text-slate-500">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── How It Works ──────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-[#080d18]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Get started in minutes</h2>
          <p className="text-slate-400 text-lg">No cloud setup. No accounts. No API keys.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: "01", title: "Install", body: "Download the Windows installer and run it. law-assist automatically downloads the AI model (≈1GB) on first launch. No terminal required." },
            { step: "02", title: "Upload", body: "Create a notebook for each case. Drag and drop PDFs, DOCX, or any legal documents. The AI reads and indexes them entirely offline." },
            { step: "03", title: "Research", body: "Ask questions in plain English. Get instant answers with citations. View auto-extracted timelines, people, and contradictions in the sidebar." },
          ].map((s, i) => (
            <div key={i} className="relative">
              {i < 2 && <div className="hidden md:block absolute top-10 left-full w-full h-px bg-gradient-to-r from-blue-600/40 to-transparent -translate-x-8 z-0" />}
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center mb-6">
                  <span className="text-blue-400 font-bold text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>{s.step}</span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{s.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Multi-User Section ────────────────────────────────────────────────────────

function MultiUserSection() {
  const roles = [
    { name: "Senior Partner", color: "bg-purple-500/20 border-purple-500/30 text-purple-300", perms: "Full access" },
    { name: "Associate", color: "bg-blue-500/20 border-blue-500/30 text-blue-300", perms: "Assigned matters" },
    { name: "Paralegal", color: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300", perms: "Read only" },
    { name: "Intern", color: "bg-slate-500/20 border-slate-500/30 text-slate-300", perms: "Chat only" },
  ];
  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl font-bold text-white mb-6" style={{ fontFamily: "Outfit, sans-serif" }}>
              Built for the<br />shared office PC
            </h2>
            <p className="text-slate-400 leading-relaxed mb-8">
              law-assist is designed for a single office computer shared among the whole team. Each person logs in with their own profile and sees only the matters they're assigned to.
            </p>
            <ul className="space-y-4">
              {["Netflix-style profile selection on login", "Role-based access control (RBAC)", "Per-matter access grants", "Secure 8-hour JWT sessions", "Admin panel for user management"].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-slate-300 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-4">Role hierarchy</p>
            {roles.map((r, i) => (
              <div key={i} className={`flex items-center justify-between px-5 py-4 rounded-2xl border ${r.color}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-current/20 flex items-center justify-center text-lg">
                    {["⚖️", "📋", "🗂️", "📝"][i]}
                  </div>
                  <span className="font-medium">{r.name}</span>
                </div>
                <span className="text-xs opacity-70">{r.perms}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

const FAQS = [
  { q: "Does law-assist require an internet connection?", a: "No. Once installed, law-assist runs entirely offline. The AI model is downloaded once during installation and all subsequent processing is local." },
  { q: "What document formats are supported?", a: "PDF, DOCX, TXT, CSV, XLSX, and Markdown. Files up to 150MB each. The system automatically detects document types (FIR, judgment, contract, affidavit, etc.)." },
  { q: "Is client data safe?", a: "Completely. Documents are processed locally and stored in an encrypted SQLite database on your machine. Nothing is sent to external servers." },
  { q: "How many users can use it simultaneously?", a: "The default licence supports 5 users on a shared PC. Each user has their own login, role, and access rights." },
  { q: "What AI model does it use?", a: "By default, a 1GB locally-hosted Qwen model runs offline. Optionally, you can configure Sarvam AI (Indian sovereign cloud) or Anthropic Claude for complex multi-document synthesis." },
  { q: "Can I use it on multiple computers?", a: "Each installation is independent. You can install on multiple PCs in your firm — each with its own database and users." },
  { q: "What happens if the AI model download fails?", a: "law-assist will retry automatically on next launch. You can also manually place the model file in the /engine/models/ folder." },
  { q: "Is there a mobile app?", a: "Not currently. law-assist is a Windows desktop application designed for office PC workstations. A browser-accessible LAN mode is included for tablet access within your office network." },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section id="faq" className="py-24 bg-[#080d18]">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Frequently asked questions</h2>
        </div>
        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <div key={i} className="border border-white/5 rounded-2xl overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-[#e8eaed] font-medium text-sm pr-4">{faq.q}</span>
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={`flex-shrink-0 transition-transform ${open === i ? "rotate-180" : ""}`}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {open === i && (
                <div className="px-6 pb-5">
                  <p className="text-slate-400 text-sm leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  const navigate = useNavigate();
  return (
    <footer className="border-t border-white/5 bg-[#080d18] py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <span className="text-lg font-bold text-white" style={{ fontFamily: "Outfit, sans-serif" }}>law-assist</span>
            </div>
            <p className="text-slate-500 text-sm max-w-xs">Private Legal Intelligence Platform. Offline. Secure. Built for Indian law firms.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-sm">
            <div>
              <p className="text-white font-semibold mb-3">Product</p>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#security" className="hover:text-white transition-colors">Security</a></li>
                <li><button onClick={() => navigate("/download")} className="hover:text-white transition-colors">Download</button></li>
              </ul>
            </div>
            <div>
              <p className="text-white font-semibold mb-3">Resources</p>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Release Notes</a></li>
                <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <p className="text-white font-semibold mb-3">Contact</p>
              <ul className="space-y-2 text-slate-400">
                <li><a href="mailto:support@saravonix.com" className="hover:text-white transition-colors">support@saravonix.com</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-600 text-sm">© 2026 law-assist. Produced by <a href="https://saravonix.com" target="_blank" rel="noopener noreferrer" className="hover:text-white underline decoration-white/20 underline-offset-4">Saravonix</a>. All rights reserved.</p>
          <p className="text-slate-700 text-xs">v1.0.0 · Built with privacy-first architecture</p>
        </div>
      </div>
    </footer>
  );
}

// ── Page Assembly ─────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-300" style={{ fontFamily: "Inter, sans-serif" }}>
      <Nav />
      <Hero />
      <FeatureGrid />
      <SecuritySection />
      <HowItWorks />
      <MultiUserSection />
      <FAQ />
      <Footer />
    </div>
  );
}
