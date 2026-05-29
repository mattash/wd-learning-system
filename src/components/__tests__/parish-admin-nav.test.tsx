import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ParishAdminNav } from "@/components/parish-admin-nav";

const usePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
}));

describe("ParishAdminNav", () => {
  beforeEach(() => {
    usePathname.mockReset();
  });

  it("marks an exact section route active", () => {
    usePathname.mockReturnValue("/app/parish-admin/courses");

    render(<ParishAdminNav />);

    expect(screen.getByRole("link", { name: "Course Adoption" }).className).toContain(
      "bg-primary",
    );
    expect(screen.getByRole("link", { name: "Overview" }).className).not.toContain("bg-primary");
  });

  it("marks a matching descendant route active", () => {
    usePathname.mockReturnValue("/app/parish-admin/people/123");

    render(<ParishAdminNav />);

    expect(screen.getByRole("link", { name: "People" }).className).toContain("bg-primary");
    expect(screen.getByRole("link", { name: "Overview" }).className).not.toContain("bg-primary");
  });

  it("does not mark sibling prefixes active", () => {
    usePathname.mockReturnValue("/app/parish-admin/courses-archive");

    render(<ParishAdminNav />);

    expect(screen.getByRole("link", { name: "Course Adoption" }).className).not.toContain(
      "bg-primary",
    );
  });
});
