"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/language-provider";

type Theme = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  toggleTheme: () => void;
} | null>(null);

function setDocumentTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = localStorage.getItem("taurus-theme");
    const initial: Theme = stored === "dark" || stored === "light"
      ? stored
      : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    setTheme(initial);
    setDocumentTheme(initial);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      localStorage.setItem("taurus-theme", next);
      setDocumentTheme(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const label = theme === "dark" ? t("Switch to light mode") : t("Switch to dark mode");

  return (
    <button
      aria-label={label}
      className={`theme-toggle ${compact ? "theme-toggle-compact" : ""}`}
      onClick={toggleTheme}
      title={label}
      type="button"
    >
      <span aria-hidden="true" className="theme-toggle-icon">{theme === "dark" ? "☀" : "☾"}</span>
      <span>{t(theme === "dark" ? "Light mode" : "Dark mode")}</span>
    </button>
  );
}
