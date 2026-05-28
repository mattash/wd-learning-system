import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigationMocks = vi.hoisted(() => ({
  notFound: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: navigationMocks.notFound,
}));

vi.mock("@/components/admin-course-content-manager", () => ({
  AdminCourseContentManager: ({ modules }: { modules: unknown[] }) => (
    <div>Course content manager: {modules.length}</div>
  ),
}));

vi.mock("@/lib/authz", () => ({
  requireDioceseAdmin: vi.fn(),
}));

vi.mock("@/lib/repositories/diocese-admin", () => ({
  getCourseContentForAdmin: vi.fn(),
}));

import DioceseAdminCourseContentPage from "@/app/app/admin/courses/[courseId]/page";
import { requireDioceseAdmin } from "@/lib/authz";
import { getCourseContentForAdmin } from "@/lib/repositories/diocese-admin";

describe("DioceseAdminCourseContentPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin-1");
    vi.mocked(getCourseContentForAdmin).mockResolvedValue({
      course: {
        id: "course-1",
        title: "Test Course",
        description: "Course description",
        thumbnail_url: null,
        scope: "DIOCESE",
        published: true,
        created_at: "2026-01-01",
        updated_at: "2026-01-02",
      },
      modules: [
        {
          id: "module-1",
          course_id: "course-1",
          title: "Test Module",
          descriptor: null,
          thumbnail_url: null,
          sort_order: 1,
          lessons: [],
        },
      ],
    });
  });

  it("requires a diocese admin before rendering course content", async () => {
    render(await DioceseAdminCourseContentPage({ params: Promise.resolve({ courseId: "course-1" }) }));

    expect(vi.mocked(requireDioceseAdmin).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(getCourseContentForAdmin).mock.invocationCallOrder[0],
    );
    expect(getCourseContentForAdmin).toHaveBeenCalledWith("course-1");
    expect(screen.getByText("Course content builder: Test Course")).toBeInTheDocument();
    expect(screen.getByText("Course content manager: 1")).toBeInTheDocument();
  });

  it("does not load course content when the guard rejects access", async () => {
    const accessError = new Error("redirect");
    vi.mocked(requireDioceseAdmin).mockRejectedValue(accessError);

    await expect(
      DioceseAdminCourseContentPage({ params: Promise.resolve({ courseId: "course-1" }) }),
    ).rejects.toThrow(accessError);
    expect(getCourseContentForAdmin).not.toHaveBeenCalled();
  });
});
