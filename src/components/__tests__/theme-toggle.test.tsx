import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ThemeToggle } from "@/components/theme-toggle";

describe("ThemeToggle", () => {
  it("applies saved theme from localStorage", async () => {
    localStorage.setItem("wd-lms-theme", "dark");

    render(<ThemeToggle />);

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
    expect(screen.getByRole("button", { name: "Toggle theme" })).toHaveTextContent(
      "Toggle Theme",
    );
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
});
