import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireDioceseAdmin: vi.fn(),
}));

vi.mock("@/lib/repositories/diocese-admin", () => ({
  getDioceseOverview: vi.fn(),
}));

import DioceseAdminPage from "@/app/app/admin/page";
import { requireDioceseAdmin } from "@/lib/authz";
import { getDioceseOverview } from "@/lib/repositories/diocese-admin";

describe("DioceseAdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin-1");
    vi.mocked(getDioceseOverview).mockResolvedValue({
      parishCount: 2,
      userCount: 12,
      parishMembershipCount: 7,
      dioceseAdminCount: 1,
      courseCount: 4,
      publishedCourseCount: 3,
      enrollmentCount: 20,
      progressRecordCount: 10,
      completedProgressRecordCount: 5,
    });
  });

  it("requires a diocese admin before rendering overview data", async () => {
    render(await DioceseAdminPage());

    expect(vi.mocked(requireDioceseAdmin)).toHaveBeenCalledBefore(vi.mocked(getDioceseOverview));
    expect(screen.getByText("Parishes")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open access tool →" })).toHaveAttribute(
      "href",
      "/app/admin/memberships",
    );
    expect(screen.getByText("Parish memberships")).toBeInTheDocument();
    expect(screen.getByText("7 active")).toBeInTheDocument();
  });

  it("does not load overview data when the guard rejects access", async () => {
    const accessError = new Error("redirect");
    vi.mocked(requireDioceseAdmin).mockRejectedValue(accessError);

    await expect(DioceseAdminPage()).rejects.toThrow(accessError);
    expect(getDioceseOverview).not.toHaveBeenCalled();
  });
});
