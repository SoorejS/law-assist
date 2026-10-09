import { useEffect } from "react";
import type { DisplaySettings, FontSize, FontFamily, TextBoldness, Theme } from "../hooks/useDisplaySettings";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: DisplaySettings;
  updateSetting: <K extends keyof DisplaySettings>(key: K, value: DisplaySettings[K]) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  resetAll: () => void;
}

export function DisplaySettingsModal({
  isOpen,
  onClose,
  settings,
  updateSetting,
  zoomIn,
  zoomOut,
  resetZoom,
  resetAll,
}: Props) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-[#161a23] border border-[#2d323f] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#2d323f] bg-[#1a1f2c]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Display & Reading Preferences</h2>
              <p className="text-xs sm:text-sm text-slate-300 font-medium">Uniform typography, zoom, and eye-comfort settings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-[#202532] transition-colors text-lg font-bold"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-7 space-y-6">
          {/* Section 1: In-App Zoom */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm sm:text-base font-bold text-white">Interface Zoom (Display Scale)</label>
                <p className="text-xs sm:text-sm text-slate-300">Scales all buttons, navigation, and text proportionally</p>
              </div>
              <span className="text-base sm:text-lg font-bold text-blue-400 px-3 py-1 bg-blue-500/10 rounded-xl border border-blue-500/30 font-mono">
                {settings.zoom}%
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={zoomOut}
                disabled={settings.zoom <= 80}
                className="px-4 py-2.5 bg-[#202532] hover:bg-[#2c3344] disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold rounded-xl border border-[#2d323f] transition-colors flex items-center gap-1.5 text-sm"
              >
                <span>−</span> Zoom Out
              </button>

              <div className="flex-1 flex gap-1.5 justify-center">
                {[80, 100, 115, 125, 150].map((z) => (
                  <button
                    key={z}
                    onClick={() => updateSetting("zoom", z)}
                    className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all border ${
                      settings.zoom === z
                        ? "bg-blue-600 text-white border-blue-500 shadow-md"
                        : "bg-[#11131a] text-slate-300 hover:text-white border-[#2d323f]"
                    }`}
                  >
                    {z}%
                  </button>
                ))}
              </div>

              <button
                onClick={zoomIn}
                disabled={settings.zoom >= 150}
                className="px-4 py-2.5 bg-[#202532] hover:bg-[#2c3344] disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold rounded-xl border border-[#2d323f] transition-colors flex items-center gap-1.5 text-sm"
              >
                <span>+</span> Zoom In
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              💡 Tip: You can also use standard browser shortcuts <kbd className="bg-[#202532] px-1 rounded text-white font-mono">Ctrl + +</kbd> or <kbd className="bg-[#202532] px-1 rounded text-white font-mono">Ctrl + Wheel</kbd> anywhere in ProAssist.
            </p>
          </div>

          <hr className="border-[#2d323f]" />

          {/* Section 2: Font Family / Typographic Style */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm sm:text-base font-bold text-white">Font Style (Typographic Persona)</label>
              <p className="text-xs sm:text-sm text-slate-300">Choose between modern screen fonts or traditional courtroom editorial serif</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: "sans" as FontFamily,
                  title: "Modern Screen",
                  fontSample: "Plus Jakarta Sans",
                  desc: "Clean, high aperture, optimal on standard computer monitors",
                },
                {
                  id: "serif" as FontFamily,
                  title: "Courtroom Editorial",
                  fontSample: "Merriweather Serif",
                  desc: "Classic legal book style (Supreme Court / AIR reporter feel)",
                },
                {
                  id: "system" as FontFamily,
                  title: "Windows ClearType",
                  fontSample: "Segoe UI System",
                  desc: "Sharp native Windows rendering with maximum contrast",
                },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => updateSetting("fontFamily", f.id)}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    settings.fontFamily === f.id
                      ? "bg-blue-600/15 border-blue-500 shadow-sm"
                      : "bg-[#11131a] border-[#2d323f] hover:border-[#3d4455]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-white text-sm sm:text-base">{f.title}</span>
                    {settings.fontFamily === f.id && (
                      <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    )}
                  </div>
                  <div className="text-xs text-blue-400 font-medium mb-1">{f.fontSample}</div>
                  <p className="text-xs text-slate-300 leading-relaxed">{f.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <hr className="border-[#2d323f]" />

          {/* Section 3: Base Font Size Scale */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm sm:text-base font-bold text-white">Base Font Size</label>
              <p className="text-xs sm:text-sm text-slate-300">Adjust the core body reading size throughout dossiers, briefs, and notes</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: "compact" as FontSize, label: "Compact", size: "14px", desc: "High density" },
                { id: "standard" as FontSize, label: "Standard", size: "16px", desc: "Balanced" },
                { id: "large" as FontSize, label: "Large", size: "18px", desc: "Easy reading" },
                { id: "xlarge" as FontSize, label: "Extra Large", size: "20px", desc: "Senior advocate" },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => updateSetting("fontSize", s.id)}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    settings.fontSize === s.id
                      ? "bg-blue-600 text-white border-blue-500 shadow-md font-bold"
                      : "bg-[#11131a] text-slate-300 hover:text-white border-[#2d323f]"
                  }`}
                >
                  <div className="font-bold text-sm sm:text-base">{s.label}</div>
                  <div className="text-xs opacity-80">{s.size} · {s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <hr className="border-[#2d323f]" />

          {/* Section 4: Text Boldness & Theme in 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Text Boldness */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm sm:text-base font-bold text-white">Text Clarity / Boldness</label>
                <p className="text-xs text-slate-300">Thickens stroke lines for weaker or older eyes</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => updateSetting("textBoldness", "normal")}
                  className={`flex-1 py-2.5 px-3 rounded-xl border text-center transition-all text-xs sm:text-sm font-semibold ${
                    settings.textBoldness === "normal"
                      ? "bg-blue-600 text-white border-blue-500 shadow-md"
                      : "bg-[#11131a] text-slate-300 hover:text-white border-[#2d323f]"
                  }`}
                >
                  Regular Weight
                </button>
                <button
                  onClick={() => updateSetting("textBoldness", "bold")}
                  className={`flex-1 py-2.5 px-3 rounded-xl border text-center transition-all text-xs sm:text-sm font-bold ${
                    settings.textBoldness === "bold"
                      ? "bg-blue-600 text-white border-blue-500 shadow-md"
                      : "bg-[#11131a] text-slate-300 hover:text-white border-[#2d323f]"
                  }`}
                >
                  Bolder Copy
                </button>
              </div>
            </div>

            {/* Theme */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm sm:text-base font-bold text-white">Color Tone</label>
                <p className="text-xs text-slate-300">Eye-fatigue reduction & paper emulation</p>
              </div>

              <div className="flex gap-2">
                {[
                  { id: "obsidian" as Theme, label: "Obsidian" },
                  { id: "slate" as Theme, label: "Slate Navy" },
                  { id: "paper" as Theme, label: "Paper Mode" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => updateSetting("theme", t.id)}
                    className={`flex-1 py-2.5 px-2 rounded-xl border text-center transition-all text-xs sm:text-sm font-semibold ${
                      settings.theme === t.id
                        ? "bg-blue-600 text-white border-blue-500 shadow-md"
                        : "bg-[#11131a] text-slate-300 hover:text-white border-[#2d323f]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <hr className="border-[#2d323f]" />

          {/* Section 5: Live Legal Reading Preview Box */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Live Legal Text Preview
            </span>
            <div className="p-4 sm:p-5 rounded-xl bg-[#11131a] border border-[#2d323f] text-slate-100 leading-relaxed space-y-2 select-none shadow-inner">
              <div className="text-xs font-bold text-blue-400 tracking-wide uppercase">
                Supreme Court of India · Bail Jurisprudence Sample
              </div>
              <p className="leading-relaxed">
                "Personal liberty is a very precious fundamental right guaranteed under Article 21 of the Constitution of India. An arrest brings with it humiliation and curtails freedom. When analyzing an application for anticipatory bail, the courts must balance the individual’s liberty against the interests of a fair investigation without imposing unachievable conditions."
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2d323f] bg-[#1a1f2c] flex items-center justify-between">
          <button
            onClick={() => {
              resetAll();
            }}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition-colors"
          >
            Reset to Default
          </button>

          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-600/25 cursor-pointer"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
}
