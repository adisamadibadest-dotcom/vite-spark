import { useEffect, useState, useCallback } from "react";

export type Theme = "dark" | "light" | "auto";

const STORAGE_KEY = "apex_theme";

function resolveTheme(theme: Theme): "dark" | "light" {
  if (theme === "auto") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function applyResolved(resolved: "dark" | "light") {
  const html = document.documentElement;
  if (resolved === "light") {
    html.classList.add("light");
  } else {
    html.classList.remove("light");
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem(STORAGE_KEY) as Theme) ?? "dark";
  });

  useEffect(() => {
    applyResolved(resolveTheme(theme));
  }, [theme]);

  useEffect(() => {
    if (theme !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyResolved(resolveTheme("auto"));
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
  }, []);

  return { theme, setTheme };
}
