import { useState, useEffect, useCallback } from "react";

export type FontSize = "compact" | "standard" | "large" | "xlarge";
export type FontFamily = "sans" | "serif" | "system";
export type TextBoldness = "normal" | "bold";
export type Theme = "obsidian" | "slate" | "paper";

export interface DisplaySettings {
  zoom: number; // 80 - 150%
  fontSize: FontSize;
  fontFamily: FontFamily;
  textBoldness: TextBoldness;
  theme: Theme;
}

const STORAGE_KEY = "proassist_display_settings_v2";

const DEFAULT_SETTINGS: DisplaySettings = {
  zoom: 100,
  fontSize: "standard",
  fontFamily: "sans",
  textBoldness: "normal",
  theme: "obsidian",
};

const ZOOM_STEPS = [80, 90, 100, 110, 120, 130, 150];

export function useDisplaySettings() {
  const [settings, setSettings] = useState<DisplaySettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
        };
      }
    } catch {
      // Fallback to defaults
    }
    return DEFAULT_SETTINGS;
  });

  // Apply attributes and zoom to document element
  useEffect(() => {
    const root = document.documentElement;

    root.setAttribute("data-font-size", settings.fontSize);
    root.setAttribute("data-font-family", settings.fontFamily);
    root.setAttribute("data-text-boldness", settings.textBoldness);
    root.setAttribute("data-theme", settings.theme);

    // Apply zoom (supported natively in Chromium, Edge, Chrome, Webview2, Electron)
    const zoomRatio = Math.max(0.75, Math.min(1.75, settings.zoom / 100));
    (root.style as any).zoom = zoomRatio.toString();

    // Persist to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore quota errors
    }
  }, [settings]);

  const updateSetting = useCallback(<K extends keyof DisplaySettings>(
    key: K,
    value: DisplaySettings[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const zoomIn = useCallback(() => {
    setSettings((prev) => {
      const nextIdx = ZOOM_STEPS.findIndex((s) => s > prev.zoom);
      const nextZoom = nextIdx !== -1 ? ZOOM_STEPS[nextIdx] : 150;
      return { ...prev, zoom: nextZoom };
    });
  }, []);

  const zoomOut = useCallback(() => {
    setSettings((prev) => {
      const reversed = [...ZOOM_STEPS].reverse();
      const prevIdx = reversed.findIndex((s) => s < prev.zoom);
      const nextZoom = prevIdx !== -1 ? reversed[prevIdx] : 80;
      return { ...prev, zoom: nextZoom };
    });
  }, []);

  const resetZoom = useCallback(() => {
    setSettings((prev) => ({ ...prev, zoom: 100 }));
  }, []);

  const resetAll = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return {
    settings,
    updateSetting,
    zoomIn,
    zoomOut,
    resetZoom,
    resetAll,
  };
}
