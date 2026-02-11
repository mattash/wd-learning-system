"use client";

import { useEffect } from "react";

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

export function ThemeToggle() {
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const initialTheme = savedTheme === "light" || savedTheme === "dark"
      ? savedTheme
      : getSystemTheme();

    applyTheme(initialTheme);
  }, []);

  const toggleTheme = () => {
    const currentTheme = document.documentElement.dataset.theme === "dark"
      ? "dark"
      : "light";
    const nextTheme = currentTheme === "light" ? "dark" : "light";
    applyTheme(nextTheme);
    localStorage.setItem(THEME_KEY, nextTheme);
  };

  return (
    <Button aria-label="Toggle theme" onClick={toggleTheme} size="sm" variant="outline">
      Toggle Theme
    </Button>
  );
}
