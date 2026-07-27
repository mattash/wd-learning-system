import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PublicLearningHeader } from "@/components/public-learning-header";

describe("PublicLearningHeader", () => {
  it("renders St. John navigation with the catalog highlighted", () => {
    render(<PublicLearningHeader current="catalog" />);

    expect(screen.getByRole("link", { name: "St. John Learning home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Course catalog" })).toHaveAttribute("href", "/catalog");
    expect(screen.getByRole("link", { name: "Course catalog" }).className).toContain("text-foreground");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the mobile menu and closes it after navigation", () => {
    render(<PublicLearningHeader current="course" />);

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
    const mobileNavigation = screen.getByRole("navigation", { name: "Mobile navigation" });
    expect(mobileNavigation).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Course catalog" })[1].className).toContain("text-muted-foreground");

    const mobileSignIn = screen.getAllByRole("link", { name: "Sign in" })[1];
    mobileSignIn.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(mobileSignIn);

    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the mobile menu from the menu control", () => {
    render(<PublicLearningHeader current="catalog" />);

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));

    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).not.toBeInTheDocument();
  });
});
