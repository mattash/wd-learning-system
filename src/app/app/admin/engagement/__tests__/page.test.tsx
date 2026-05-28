import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/admin-engagement-report", () => ({
  AdminEngagementReport: ({ courses, parishes }: { courses: unknown[]; parishes: unknown[] }) => (
    <div>
      Engagement report: {courses.length} courses; {parishes.length} parishes
    </div>
  ),
}));

vi.mock("@/components/admin-enrollment-manager", () => ({
  AdminEnrollmentManager: ({
    courses,
    enrollments,
    parishes,
  }: {
    courses: unknown[];
    enrollments: unknown[];
    parishes: unknown[];
  }) => (
    <div>
      Enrollment manager: {courses.length} courses; {enrollments.length} enrollments; {parishes.length} parishes
    </div>
  ),
}));

vi.mock("@/lib/authz", () => ({
  requireDioceseAdmin: vi.fn(),
}));

vi.mock("@/lib/repositories/diocese-admin", () => ({
  listCourses: vi.fn(),
  listEngagement: vi.fn(),
  listEnrollments: vi.fn(),
  listParishes: vi.fn(),
}));

import DioceseAdminEngagementPage from "@/app/app/admin/engagement/page";
import { requireDioceseAdmin } from "@/lib/authz";
import { listCourses, listEngagement, listEnrollments, listParishes } from "@/lib/repositories/diocese-admin";

describe("DioceseAdminEngagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin-1");
    vi.mocked(listEngagement).mockResolvedValue([
      {
        parish_id: "parish-1",
        course_id: "course-1",
        learners_started: 2,
        learners_completed: 1,
      },
    ]);
    vi.mocked(listEnrollments).mockResolvedValue([
      {
        id: "enrollment-1",
        parish_id: "parish-1",
        clerk_user_id: "user-1",
        course_id: "course-1",
        created_at: "2026-01-01",
      },
    ]);
    vi.mocked(listParishes).mockResolvedValue([
      {
        id: "parish-1",
        name: "St Anne",
        slug: "st-anne",
        allow_self_signup: true,
        archived_at: null,
        created_at: "2026-01-01",
      },
    ]);
    vi.mocked(listCourses).mockResolvedValue([
      {
        id: "course-1",
        title: "Intro Course",
        description: null,
        thumbnail_url: null,
        scope: "DIOCESE",
        published: true,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      },
    ]);
  });

  it("requires a diocese admin before rendering engagement data", async () => {
    render(await DioceseAdminEngagementPage());

    const guardCallOrder = vi.mocked(requireDioceseAdmin).mock.invocationCallOrder[0];
    expect(guardCallOrder).toBeLessThan(vi.mocked(listEngagement).mock.invocationCallOrder[0]);
    expect(guardCallOrder).toBeLessThan(vi.mocked(listEnrollments).mock.invocationCallOrder[0]);
    expect(guardCallOrder).toBeLessThan(vi.mocked(listParishes).mock.invocationCallOrder[0]);
    expect(guardCallOrder).toBeLessThan(vi.mocked(listCourses).mock.invocationCallOrder[0]);
    expect(listEngagement).toHaveBeenCalledWith(200);
    expect(listEnrollments).toHaveBeenCalledWith(200);
    expect(listParishes).toHaveBeenCalledWith(200);
    expect(listCourses).toHaveBeenCalledWith(200);
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("of 1 enrolled learners")).toBeInTheDocument();
    expect(screen.getByText("Enrollment manager: 1 courses; 1 enrollments; 1 parishes")).toBeInTheDocument();
    expect(screen.getByText("Engagement report: 1 courses; 1 parishes")).toBeInTheDocument();
  });

  it("does not load engagement data when the guard rejects access", async () => {
    const accessError = new Error("redirect");
    vi.mocked(requireDioceseAdmin).mockRejectedValue(accessError);

    await expect(DioceseAdminEngagementPage()).rejects.toThrow(accessError);
    expect(listEngagement).not.toHaveBeenCalled();
    expect(listEnrollments).not.toHaveBeenCalled();
    expect(listParishes).not.toHaveBeenCalled();
    expect(listCourses).not.toHaveBeenCalled();
  });
});
