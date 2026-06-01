import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/admin-course-manager", () => ({
  AdminCourseManager: ({ courses }: { courses: unknown[] }) => (
    <div>Course manager: {courses.length}</div>
  ),
}));

vi.mock("@/lib/authz", () => ({
  requireDioceseAdmin: vi.fn(),
}));

vi.mock("@/lib/repositories/diocese-admin", () => ({
  listCourses: vi.fn(),
}));

import DioceseAdminCoursesPage from "@/app/app/admin/courses/page";
import { requireDioceseAdmin } from "@/lib/authz";
import { listCourses } from "@/lib/repositories/diocese-admin";

describe("DioceseAdminCoursesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin-1");
    vi.mocked(listCourses).mockResolvedValue([
      {
        id: "course-1",
        title: "Test Course",
        description: "Course description",
        thumbnail_url: null,
        instructor: null,
        duration_hours: null,
        category: null,
        scope: "DIOCESE",
        published: true,
        publicly_browseable: false,
        created_at: "2026-01-01",
        updated_at: "2026-01-02",
      },
    ]);
  });

  it("requires a diocese admin before rendering course data", async () => {
    render(await DioceseAdminCoursesPage());

    expect(vi.mocked(requireDioceseAdmin).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(listCourses).mock.invocationCallOrder[0],
    );
    expect(listCourses).toHaveBeenCalledWith(100);
    expect(screen.getByRole("heading", { name: "Courses" })).toBeInTheDocument();
    expect(screen.getByText("Course manager: 1")).toBeInTheDocument();
  });

  it("does not render a create link to an unimplemented course detail route", async () => {
    render(await DioceseAdminCoursesPage());

    expect(screen.queryByRole("link", { name: /create course/i })).not.toBeInTheDocument();
  });

  it("does not load course data when the guard rejects access", async () => {
    const accessError = new Error("redirect");
    vi.mocked(requireDioceseAdmin).mockRejectedValue(accessError);

    await expect(DioceseAdminCoursesPage()).rejects.toThrow(accessError);
    expect(listCourses).not.toHaveBeenCalled();
  });
});
