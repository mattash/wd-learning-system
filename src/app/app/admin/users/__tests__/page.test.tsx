import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/admin-user-directory-manager", () => ({
  AdminUserDirectoryManager: ({
    initialParishes,
    initialUsers,
  }: {
    initialParishes: unknown[];
    initialUsers: unknown[];
  }) => (
    <div>
      Directory users: {initialUsers.length}; parishes: {initialParishes.length}
    </div>
  ),
}));

vi.mock("@/lib/authz", () => ({
  requireDioceseAdmin: vi.fn(),
}));

vi.mock("@/lib/repositories/diocese-admin", () => ({
  listDioceseUserDirectory: vi.fn(),
}));

import DioceseAdminUsersPage from "@/app/app/admin/users/page";
import { requireDioceseAdmin } from "@/lib/authz";
import { listDioceseUserDirectory } from "@/lib/repositories/diocese-admin";

describe("DioceseAdminUsersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin-1");
    vi.mocked(listDioceseUserDirectory).mockResolvedValue({
      users: [
        {
          clerk_user_id: "user-1",
          email: "user@example.com",
          display_name: "User One",
          onboarding_completed_at: null,
          created_at: "2026-01-01",
          is_diocese_admin: false,
          memberships: [],
        },
      ],
      parishes: [{ id: "parish-1", name: "St Anne" }],
    });
  });

  it("requires a diocese admin before rendering directory data", async () => {
    render(await DioceseAdminUsersPage());

    expect(requireDioceseAdmin).toHaveBeenCalledBefore(listDioceseUserDirectory);
    expect(listDioceseUserDirectory).toHaveBeenCalledWith(200);
    expect(screen.getByRole("heading", { name: "Users" })).toBeInTheDocument();
    expect(screen.getByText("Directory users: 1; parishes: 1")).toBeInTheDocument();
  });

  it("does not load directory data when the guard rejects access", async () => {
    const accessError = new Error("redirect");
    vi.mocked(requireDioceseAdmin).mockRejectedValue(accessError);

    await expect(DioceseAdminUsersPage()).rejects.toThrow(accessError);
    expect(listDioceseUserDirectory).not.toHaveBeenCalled();
  });
});
