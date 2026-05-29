import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DioceseAdminNav } from "@/components/diocese-admin-nav";

const usePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
}));

describe("DioceseAdminNav", () => {
  beforeEach(() => {
    usePathname.mockReset();
  });

  it("marks a matching descendant route active", () => {
    usePathname.mockReturnValue("/app/admin/users/123");

    render(<DioceseAdminNav />);

    expect(screen.getByRole("link", { name: "Users" }).className).toContain("bg-primary");
    expect(screen.getByRole("link", { name: "Overview" }).className).not.toContain("bg-primary");
  });

  it("does not mark sibling prefixes active", () => {
    usePathname.mockReturnValue("/app/admin/usersettings");

    render(<DioceseAdminNav />);

    expect(screen.getByRole("link", { name: "Users" }).className).not.toContain("bg-primary");
  });
});
