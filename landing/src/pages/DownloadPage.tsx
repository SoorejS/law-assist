import { useNavigate } from "react-router-dom";
import { useState } from "react";

// Release manifest — in production this is fetched from https://law-assist.com/releases/release.json
const RELEASE = {
  version: "1.0.0",
  released: "2026-06-17",
  changelog: [
    "Initial public release",
    "Full offline AI engine with local LLM",
    "Multi-user RBAC with Netflix-style login",
    "Automated intelligence extraction (Timeline, People, Contradictions)",
    "PDF, DOCX, TXT, CSV, XLSX ingestion support",
    "NotebookLM-inspired 3-panel workspace",
  ],
  artifacts: [
    {
      id: "exe",
      label: "Windows Installer (EXE)",
      sublabel: "Recommended for most users",
      description: "Full installer with setup wizard, start menu shortcut and uninstaller.",
      icon: "🪟",
      badge: "Recommended",
      badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      filename: "law-assist-1.0.0-Setup.exe",
      size: "~260 MB",
      sha256: "49cc386f4b98c762379df4b1ce4d1be3913d6aefa9bfdfa067ac1b34eca6a991",
      url: "https://github.com/SoorejS/law-assist-landing/releases/download/v1.0.0/law-assist-1.0.0-Setup.exe",
    },
    {
      id: "zip",
      label: "Portable ZIP",
      sublabel: "No installation required",
      description: "Extract and run. No admin rights needed. Perfect for USB drives.",
      icon: "📦",
      badge: null,
      filename: "law-assist-1.0.0-Portable.zip",
      size: "~260 MB",
      sha256: "99e8a7e153cb4bfdd8810839b0747bdd367cf655c4e63766fa985539d6803067",
      url: "",
      comingSoon: true,
    },
    {
      id: "mac",
      label: "macOS Installer",
      sublabel: "Apple Silicon & Intel",
      description: "Native macOS application bundle with Metal GPU acceleration.",
      icon: "🍎",
      badge: null,
      filename: "law-assist-1.0.0.dmg",
      size: "TBD",
      sha256: "Pending",
      url: "",
      comingSoon: true,
    },
    {
      id: "iso",
      label: "Enterprise ISO",
      sublabel: "For IT-managed deployments",
      description: "Bootable ISO for silent enterprise deployment via Group Policy or SCCM.",
      icon: "🏢",
      badge: "Enterprise",
      badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
      filename: "law-assist-1.0.0-Enterprise.iso",
      size: "TBD",
      sha256: "Pending",
      url: "",
      comingSoon: true,
    },
  ],
};

interface Artifact {
  id: string;
  label: string;
  sublabel: string;
  description: string;
  icon: string;
  badge?: string | null;
  badgeColor?: string;
  filename: string;
  size: string;
  sha256: string;
  url: string;
  comingSoon?: boolean;
}

function DownloadCard({ artifact }: { artifact: Artifact }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = () => {
    if (artifact.comingSoon) return;
    setDownloading(true);
    // In production, this would point to the real file URL
    // For now, we show the download intent clearly
    window.open(artifact.url, "_blank");
    setTimeout(() => setDownloading(false), 2000);
  };

  return (
    <div className={`group bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] rounded-2xl p-7 transition-all flex flex-col ${artifact.comingSoon ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <span className="text-3xl">{artifact.icon}</span>
        {artifact.badge && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${artifact.badgeColor}`}>
            {artifact.badge}
          </span>
        )}
      </div>

      <h3 className="text-lg font-semibold text-white mb-1">{artifact.label}</h3>
      <p className="text-xs text-blue-400 font-medium mb-3">{artifact.sublabel}</p>
      <p className="text-slate-400 text-sm leading-relaxed mb-6 flex-1">{artifact.description}</p>

      <div className="space-y-2 mb-6 text-xs text-slate-500">
        <div className="flex justify-between">
          <span>Version</span>
          <span className="text-slate-300 font-mono">{RELEASE.version}</span>
        </div>
        <div className="flex justify-between">
          <span>Released</span>
          <span className="text-slate-300">{RELEASE.released}</span>
        </div>
        <div className="flex justify-between">
          <span>Size</span>
          <span className="text-slate-300">{artifact.size}</span>
        </div>
        <div className="flex justify-between">
          <span>SHA256</span>
          <span className="text-slate-500 font-mono truncate ml-4 text-right">{artifact.sha256}</span>
        </div>
      </div>

      <button
        onClick={handleDownload}
        disabled={downloading || artifact.comingSoon}
        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${artifact.comingSoon ? 'bg-slate-800 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white'}`}
      >
        {artifact.comingSoon ? (
          "Coming Soon"
        ) : downloading ? (
          <>
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Preparing download…
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download {artifact.id.toUpperCase()}
          </>
        )}
      </button>
      <p className="text-center text-[11px] text-slate-600 mt-2">{artifact.filename}</p>
    </div>
  );
}

export default function DownloadPage() {
  const navigate = useNavigate();
  const [showChecksums, setShowChecksums] = useState(false);
  const [showChangelog, setShowChangelog] = useState(true);

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-300" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Nav */}
      <nav className="fixed w-full z-50 bg-[#0B1120]/80 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <span className="text-lg font-bold text-white" style={{ fontFamily: "Outfit, sans-serif" }}>law-assist</span>
          </button>
          <button onClick={() => navigate("/")} className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to home
          </button>
        </div>
      </nav>

      <div className="pt-28 pb-20 max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-6">
            v{RELEASE.version} · Released {RELEASE.released}
          </div>
          <h1 className="text-5xl font-bold text-white mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
            Download law-assist
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Free to download. Runs 100% offline on your Windows PC. No accounts. No subscriptions.
          </p>
        </div>

        {/* Download Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
          {RELEASE.artifacts.map(artifact => (
            <DownloadCard key={artifact.id} artifact={artifact as Artifact} />
          ))}
        </div>

        {/* System Requirements */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-7">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span>💻</span> System Requirements
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-400">
              {[
                ["OS", "Windows 10 / 11 (64-bit)"],
                ["RAM", "8GB minimum · 16GB recommended"],
                ["Storage", "5GB free space (for AI model)"],
                ["CPU", "x86-64 · 4 cores recommended"],
                ["GPU", "Not required (CPU inference)"],
                ["Network", "Only for optional cloud escalation"],
              ].map(([key, val], i) => (
                <li key={i} className="flex justify-between">
                  <span className="text-slate-500">{key}</span>
                  <span className="text-slate-300">{val}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Release Notes */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-7">
            <button
              onClick={() => setShowChangelog(!showChangelog)}
              className="w-full flex items-center justify-between text-white font-semibold mb-4"
            >
              <span className="flex items-center gap-2">📋 v{RELEASE.version} Release Notes</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform ${showChangelog ? "rotate-180" : ""}`}>
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </button>
            {showChangelog && (
              <ul className="space-y-2">
                {RELEASE.changelog.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-400">
                    <span className="text-emerald-400 flex-shrink-0 mt-0.5">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* SHA256 Checksums */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowChecksums(!showChecksums)}
            className="w-full flex items-center justify-between px-7 py-5 text-white font-medium hover:bg-white/[0.02] transition-colors"
          >
            <span className="flex items-center gap-2 text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              SHA256 Checksums — Verify your download
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform ${showChecksums ? "rotate-180" : ""}`}>
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>
          {showChecksums && (
            <div className="px-7 pb-7 border-t border-white/5">
              <p className="text-xs text-slate-500 mb-4 mt-4">Run <code className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">certutil -hashfile &lt;filename&gt; SHA256</code> in PowerShell to verify.</p>
              <div className="space-y-2">
                {RELEASE.artifacts.map(a => (
                  <div key={a.id} className="flex items-center gap-3 font-mono text-xs">
                    <span className="text-slate-500 min-w-[180px]">{a.filename}</span>
                    <span className="text-slate-600">{a.sha256}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Version History */}
        <div className="mt-12 text-center">
          <h3 className="text-white font-semibold mb-6">Version History</h3>
          <div className="inline-flex flex-col gap-2 text-sm text-slate-500">
            {[["1.0.0", "2026-06-17", "Initial public release"]].map(([v, d, desc], i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-3 bg-white/[0.02] border border-white/5 rounded-xl">
                <span className="text-blue-400 font-mono font-semibold">{v}</span>
                <span>{d}</span>
                <span className="text-slate-400">{desc}</span>
                <span className="text-emerald-400 text-xs font-semibold">Current</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
