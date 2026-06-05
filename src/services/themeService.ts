import type { AppTheme } from "../types/settings";

const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

function prefersDarkMode(): boolean {
  return typeof window !== "undefined" && window.matchMedia(DARK_MEDIA_QUERY).matches;
}

export function applyTheme(theme: AppTheme): void {
  if (typeof document === "undefined") {
    return;
  }

  const resolvedTheme = theme === "system" ? (prefersDarkMode() ? "dark" : "light") : theme;
  const root = document.documentElement;

  root.dataset.theme = theme;
  root.classList.toggle("dark", resolvedTheme === "dark");
}

export function listenToSystemThemeChange(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia(DARK_MEDIA_QUERY);
  const handler = () => callback();

  mediaQuery.addEventListener("change", handler);

  return () => {
    mediaQuery.removeEventListener("change", handler);
  };
}
