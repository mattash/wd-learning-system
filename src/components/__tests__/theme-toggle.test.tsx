import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeToggle } from "@/components/theme-toggle";

describe("ThemeToggle", () => {
  let systemThemeListener: (() => void) | undefined;
  let systemThemeMatches = false;

  beforeEach(() => {
    systemThemeListener = undefined;
    systemThemeMatches = false;

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: systemThemeMatches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((_event: string, listener: () => void) => {
          systemThemeListener = listener;
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    localStorage.removeItem("wd-lms-theme");
  });
  it("applies saved theme from localStorage", async () => {
    localStorage.setItem("wd-lms-theme", "dark");

    render(<ThemeToggle />);

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
    expect(screen.getByRole("button", { name: "Toggle theme" })).toBeInTheDocument();
  });

  it("toggles and persists theme", async () => {
    localStorage.setItem("wd-lms-theme", "light");

    render(<ThemeToggle />);

    const button = await screen.findByRole("button", { name: "Toggle theme" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
    expect(localStorage.getItem("wd-lms-theme")).toBe("dark");
  });

  it("falls back to system theme when no saved theme", async () => {
    localStorage.removeItem("wd-lms-theme");

    render(<ThemeToggle />);

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("light");
    });
  });

  it("continues following system theme when no theme is saved", async () => {
    systemThemeMatches = true;

    render(<ThemeToggle />);

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
    expect(localStorage.getItem("wd-lms-theme")).toBeNull();

    systemThemeMatches = false;
    systemThemeListener?.();

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("light");
    });
    expect(localStorage.getItem("wd-lms-theme")).toBeNull();
  });

  it("toggles from dark to light", async () => {
    localStorage.setItem("wd-lms-theme", "dark");

    render(<ThemeToggle />);

    const button = await screen.findByRole("button", { name: "Toggle theme" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("light");
    });
    expect(localStorage.getItem("wd-lms-theme")).toBe("light");
  });

  it("includes sr-only text for accessibility", async () => {
    render(<ThemeToggle />);

    await screen.findByRole("button", { name: "Toggle theme" });
    expect(screen.getByText("Toggle theme")).toBeInTheDocument();
  });
});
