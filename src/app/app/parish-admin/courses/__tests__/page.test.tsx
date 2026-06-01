import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/parish-course-adoption-manager", () => ({
  ParishCourseAdoptionManager: ({
    adoptedCourses,
    availableCourses,
  }: {
    adoptedCourses: unknown[];
    availableCourses: unknown[];
  }) => <div>Course adoption manager: {adoptedCourses.length} adopted, {availableCourses.length} available</div>,
}));

vi.mock("@/lib/authz", () => ({
  requireParishRole: vi.fn(),
}));

vi.mock("@/lib/repositories/parish-admin", () => ({
  getParishAdminDashboardDataForUser: vi.fn(),
}));

import CoursesPage from "@/app/app/parish-admin/courses/page";
import { requireParishRole } from "@/lib/authz";
import { getParishAdminDashboardDataForUser } from "@/lib/repositories/parish-admin";

describe("CoursesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires parish admin before loading course adoption data", async () => {
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "user-1",
      parishId: "parish-1",
      role: "instructor",
    });

    await expect(CoursesPage()).resolves.toBeNull();

    expect(requireParishRole).toHaveBeenCalledWith("parish_admin");
    expect(getParishAdminDashboardDataForUser).not.toHaveBeenCalled();
  });

  it("renders course adoption data for parish admins", async () => {
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "user-1",
      parishId: "parish-1",
      role: "parish_admin",
    });
    vi.mocked(getParishAdminDashboardDataForUser).mockResolvedValue({
      role: "parish_admin",
      overview: {
        memberCount: 0,
        enrollmentCount: 0,
        activeLearnerCount: 0,
        stalledLearnerCount: 0,
        completionRate: 0,
        pendingJoinRequestCount: 0,
      },
      visibleCourses: [],
      dioceseCourses: [],
      adoptedParishCourses: [
        { id: "course-1", title: "Adopted Course", description: null, published: true, scope: "PARISH" },
      ],
      availableParishCourses: [
        { id: "course-2", title: "Available Course", description: null, published: true, scope: "PARISH" },
      ],
      enrollments: [],
      members: [],
      cohorts: [],
      communicationSends: [],
      participationRows: [],
    });

    render(await CoursesPage());

    expect(getParishAdminDashboardDataForUser).toHaveBeenCalledWith({
      clerkUserId: "user-1",
      parishId: "parish-1",
      role: "parish_admin",
    });
    expect(screen.getByText("Course adoption manager: 1 adopted, 1 available")).toBeInTheDocument();
  });
});
