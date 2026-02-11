import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Link from "next/link";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders default styles", () => {
    render(<Button>Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain("bg-primary");
    expect(button.className).toContain("text-primary-foreground");
    expect(button.className).toContain("h-10");
  });

  it("renders configured variant and size styles", () => {
    render(
      <Button size="sm" variant="outline">
        Cancel
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Cancel" });
    expect(button.className).toContain("border-border");
    expect(button.className).toContain("bg-card");
    expect(button.className).toContain("h-9");
  });

  it("forwards native attributes", () => {
    render(
      <Button disabled type="submit">
        Submit
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Submit" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("type", "submit");
  });

  it("supports asChild rendering", () => {
    render(
      <Button asChild variant="link">
        <Link href="/courses">Courses</Link>
      </Button>,
    );

    const link = screen.getByRole("link", { name: "Courses" });
    expect(link).toBeInTheDocument();
    expect(link.className).toContain("text-primary");
  });
});
