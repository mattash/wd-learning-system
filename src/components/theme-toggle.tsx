"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";

const THEME_KEY = "wd-lms-theme";

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

const themeListeners = new Set<() => void>();

function emitThemeChange() {
  themeListeners.forEach((listener) => listener());
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";

  const savedTheme = localStorage.getItem(THEME_KEY);
  return savedTheme === "light" || savedTheme === "dark" ? savedTheme : getSystemTheme();
}

function subscribeToTheme(callback: () => void) {
  themeListeners.add(callback);

  if (typeof window === "undefined") {
    return () => {
      themeListeners.delete(callback);
    };
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === THEME_KEY || event.key === null) {
      callback();
    }
  };

  window.addEventListener("storage", handleStorage);

  if (typeof window.matchMedia !== "function") {
    return () => {
      themeListeners.delete(callback);
      window.removeEventListener("storage", handleStorage);
    };
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const handleSystemThemeChange = () => {
    if (!localStorage.getItem(THEME_KEY)) {
      callback();
    }
  };

  mediaQuery.addEventListener("change", handleSystemThemeChange);

  return () => {
    themeListeners.delete(callback);
    window.removeEventListener("storage", handleStorage);
    mediaQuery.removeEventListener("change", handleSystemThemeChange);
  };
}

function subscribeToHydration() {
  return () => {};
}

export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme>(subscribeToTheme, getStoredTheme, () => "light");
  const mounted = useSyncExternalStore(subscribeToHydration, () => true, () => false);

  useEffect(() => {
    if (!mounted) return;
    applyTheme(theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [mounted, theme]);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    localStorage.setItem(THEME_KEY, nextTheme);
    applyTheme(nextTheme);
    emitThemeChange();
  };

  return (
    <Button aria-label="Toggle theme" onClick={toggleTheme} size="icon" variant="outline">
      {mounted ? (
        theme === "dark" ? <Sun aria-hidden="true" className="h-4 w-4" /> : <Moon aria-hidden="true" className="h-4 w-4" />
      ) : (
        <span aria-hidden="true" className="block h-4 w-4" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
