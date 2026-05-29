import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/admin-parish-manager", () => ({
  AdminParishManager: ({ parishes }: { parishes: unknown[] }) => (
    <div>Parish manager: {parishes.length}</div>
  ),
}));

vi.mock("@/lib/authz", () => ({
  requireDioceseAdmin: vi.fn(),
}));

vi.mock("@/lib/repositories/diocese-admin", () => ({
  listParishes: vi.fn(),
}));

import DioceseAdminParishesPage from "@/app/app/admin/parishes/page";
import { requireDioceseAdmin } from "@/lib/authz";
import { type DioceseParishRow, listParishes } from "@/lib/repositories/diocese-admin";

function buildParish(index: number): DioceseParishRow {
  return {
    id: `parish-${index}`,
    name: `Parish ${index}`,
    slug: `parish-${index}`,
    allow_self_signup: true,
    archived_at: null,
    created_at: "2026-01-01",
  };
}

describe("DioceseAdminParishesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin-1");
    vi.mocked(listParishes).mockResolvedValue([buildParish(1)]);
  });

  it("requires a diocese admin before rendering parish data", async () => {
    render(await DioceseAdminParishesPage());

    expect(vi.mocked(requireDioceseAdmin)).toHaveBeenCalledBefore(vi.mocked(listParishes));
    expect(listParishes).toHaveBeenCalledWith(101);
    expect(screen.getByRole("heading", { name: "Parishes" })).toBeInTheDocument();
    expect(screen.getByText("Parish manager: 1")).toBeInTheDocument();
  });

  it("shows a truncation notice when more parishes exist than the page displays", async () => {
    vi.mocked(listParishes).mockResolvedValue(Array.from({ length: 101 }, (_, index) => buildParish(index + 1)));

    render(await DioceseAdminParishesPage());

    expect(screen.getByText("Parish manager: 100")).toBeInTheDocument();
    expect(screen.getByText(/Showing the first 100 parishes/)).toBeInTheDocument();
  });

  it("does not load parish data when the guard rejects access", async () => {
    const accessError = new Error("redirect");
    vi.mocked(requireDioceseAdmin).mockRejectedValue(accessError);

    await expect(DioceseAdminParishesPage()).rejects.toThrow(accessError);
    expect(listParishes).not.toHaveBeenCalled();
  });
});
