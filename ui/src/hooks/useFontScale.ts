import { useState, useEffect } from "react";

export type FontScale = "normal" | "large" | "xlarge";

export function useFontScale() {
  const [fontScale, setFontScaleState] = useState<FontScale>(() => {
    const saved = localStorage.getItem("proassist_font_scale") as FontScale;
    return saved === "large" || saved === "xlarge" ? saved : "normal";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-font-scale", fontScale);
    localStorage.setItem("proassist_font_scale", fontScale);
  }, [fontScale]);

  const cycleFontScale = () => {
    setFontScaleState((prev) => {
      if (prev === "normal") return "large";
      if (prev === "large") return "xlarge";
      return "normal";
    });
  };

  const setScale = (scale: FontScale) => {
    setFontScaleState(scale);
  };

  return { fontScale, setFontScale: setScale, cycleFontScale };
}
