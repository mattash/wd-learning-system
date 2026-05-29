import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/parish-people-manager", () => ({
  ParishPeopleManager: ({ members }: { members: unknown[] }) => <div>Members: {members.length}</div>,
}));

vi.mock("@/lib/authz", () => ({
  requireParishRole: vi.fn(),
}));

vi.mock("@/lib/repositories/parish-admin", () => ({
  getParishAdminDashboardDataForUser: vi.fn(),
}));

import PeoplePage from "@/app/app/parish-admin/people/page";
import { requireParishRole } from "@/lib/authz";
import { getParishAdminDashboardDataForUser } from "@/lib/repositories/parish-admin";

describe("PeoplePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires parish admin before loading parish people data", async () => {
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "user-1",
      parishId: "parish-1",
      role: "instructor",
    });

    const result = await PeoplePage();

    expect(requireParishRole).toHaveBeenCalledWith("parish_admin");
    expect(getParishAdminDashboardDataForUser).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("renders parish people for parish admins", async () => {
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "user-1",
      parishId: "parish-1",
      role: "parish_admin",
    });
    vi.mocked(getParishAdminDashboardDataForUser).mockResolvedValue({
      role: "parish_admin",
      overview: {
        memberCount: 1,
        enrollmentCount: 0,
        activeLearnerCount: 0,
        stalledLearnerCount: 0,
        completionRate: 0,
        pendingJoinRequestCount: 0,
      },
      visibleCourses: [],
      dioceseCourses: [],
      adoptedParishCourses: [],
      availableParishCourses: [],
      enrollments: [],
      members: [{ clerk_user_id: "member-1", display_name: "Member One", email: "member@example.com", role: "student" }],
      cohorts: [],
      communicationSends: [],
      participationRows: [],
    });

    render(await PeoplePage());

    expect(getParishAdminDashboardDataForUser).toHaveBeenCalledWith({
      clerkUserId: "user-1",
      parishId: "parish-1",
      role: "parish_admin",
    });
    expect(screen.getByText("Members: 1")).toBeInTheDocument();
  });
});
