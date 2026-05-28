import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/parish-communications-manager", () => ({
  ParishCommunicationsManager: () => <div>Communications manager</div>,
}));

vi.mock("@/lib/authz", () => ({
  requireParishRole: vi.fn(),
}));

vi.mock("@/lib/repositories/parish-admin", () => ({
  getParishAdminDashboardDataForUser: vi.fn(),
}));

import CommunicationsPage from "@/app/app/parish-admin/communications/page";
import { requireParishRole } from "@/lib/authz";
import { getParishAdminDashboardDataForUser } from "@/lib/repositories/parish-admin";

describe("CommunicationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not fetch parish-admin dashboard data for instructors", async () => {
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "user-1",
      parishId: "parish-1",
      role: "instructor",
    });

    await expect(CommunicationsPage()).resolves.toBeNull();

    expect(requireParishRole).toHaveBeenCalledWith("parish_admin");
    expect(getParishAdminDashboardDataForUser).not.toHaveBeenCalled();
  });
});
