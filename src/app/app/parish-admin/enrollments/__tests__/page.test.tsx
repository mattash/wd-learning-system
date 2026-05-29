import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/parish-enrollment-manager", () => ({
  ParishEnrollmentManager: ({
    courses,
    enrollments,
    members,
  }: {
    courses: unknown[];
    enrollments: unknown[];
    members: unknown[];
  }) => (
    <div>
      Enrollment manager: {courses.length} courses, {enrollments.length} enrollments, {members.length} members
    </div>
  ),
}));

vi.mock("@/lib/authz", () => ({
  requireParishRole: vi.fn(),
}));

vi.mock("@/lib/repositories/parish-admin", () => ({
  getParishAdminDashboardDataForUser: vi.fn(),
}));

import EnrollmentsPage from "@/app/app/parish-admin/enrollments/page";
import { requireParishRole } from "@/lib/authz";
import { getParishAdminDashboardDataForUser } from "@/lib/repositories/parish-admin";

describe("EnrollmentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires parish admin before loading enrollment data", async () => {
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "user-1",
      parishId: "parish-1",
      role: "instructor",
    });

    await expect(EnrollmentsPage()).resolves.toBeNull();

    expect(requireParishRole).toHaveBeenCalledWith("parish_admin");
    expect(getParishAdminDashboardDataForUser).not.toHaveBeenCalled();
  });

  it("renders enrollment management data for parish admins", async () => {
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
          cohort_id: null,
          created_at: "2026-05-29T00:00:00.000Z",
        },
      ],
      members: [{ clerk_user_id: "member-1", display_name: "Member One", email: "member@example.com", role: "student" }],
      cohorts: [],
      communicationSends: [],
      participationRows: [],
    });

    render(await EnrollmentsPage());

    expect(getParishAdminDashboardDataForUser).toHaveBeenCalledWith({
      clerkUserId: "user-1",
      parishId: "parish-1",
      role: "parish_admin",
    });
    expect(screen.getByText("Enrollment manager: 1 courses, 1 enrollments, 1 members")).toBeInTheDocument();
  });
});
