import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/parish-cohort-manager", () => ({
  ParishCohortManager: ({
    cohorts,
    courses,
    enrollments,
    members,
  }: {
    cohorts: unknown[];
    courses: unknown[];
    enrollments: unknown[];
    members: unknown[];
  }) => (
    <div>
      Cohort manager: {cohorts.length} cohorts, {courses.length} courses, {enrollments.length} enrollments,{" "}
      {members.length} members
    </div>
  ),
}));

vi.mock("@/lib/authz", () => ({
  requireParishRole: vi.fn(),
}));

vi.mock("@/lib/repositories/parish-admin", () => ({
  getParishAdminDashboardDataForUser: vi.fn(),
}));

import CohortsPage from "@/app/app/parish-admin/cohorts/page";
import { requireParishRole } from "@/lib/authz";
import { getParishAdminDashboardDataForUser } from "@/lib/repositories/parish-admin";

describe("CohortsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires parish admin before loading cohort data", async () => {
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "user-1",
      parishId: "parish-1",
      role: "instructor",
    });

    await expect(CohortsPage()).resolves.toBeNull();

    expect(requireParishRole).toHaveBeenCalledWith("parish_admin");
    expect(getParishAdminDashboardDataForUser).not.toHaveBeenCalled();
  });

  it("renders cohort data for parish admins", async () => {
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "user-1",
      parishId: "parish-1",
      role: "parish_admin",
    });
    vi.mocked(getParishAdminDashboardDataForUser).mockResolvedValue({
      role: "parish_admin",
      overview: {
        memberCount: 1,
        enrollmentCount: 1,
        activeLearnerCount: 0,
        stalledLearnerCount: 0,
        completionRate: 0,
        pendingJoinRequestCount: 0,
      },
      visibleCourses: [{ id: "course-1", title: "Course One", description: null, published: true, scope: "PARISH" }],
      dioceseCourses: [],
      adoptedParishCourses: [],
      availableParishCourses: [],
      enrollments: [
        {
          id: "enrollment-1",
          clerk_user_id: "member-1",
          course_id: "course-1",
          cohort_id: "cohort-1",
          created_at: "2026-05-29T00:00:00.000Z",
        },
      ],
      members: [{ clerk_user_id: "member-1", display_name: "Member One", email: "member@example.com", role: "student" }],
      cohorts: [
        {
          id: "cohort-1",
          name: "Cohort One",
          facilitator_clerk_user_id: null,
          cadence: "weekly",
          next_session_at: null,
          created_at: "2026-05-29T00:00:00.000Z",
          updated_at: "2026-05-29T00:00:00.000Z",
        },
      ],
      communicationSends: [],
      participationRows: [],
    });

    render(await CohortsPage());

    expect(getParishAdminDashboardDataForUser).toHaveBeenCalledWith({
      clerkUserId: "user-1",
      parishId: "parish-1",
      role: "parish_admin",
    });
    expect(screen.getByText("Cohort manager: 1 cohorts, 1 courses, 1 enrollments, 1 members")).toBeInTheDocument();
  });
});
