import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigationMocks = vi.hoisted(() => ({
  notFound: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: navigationMocks.notFound,
}));

vi.mock("@/components/admin-lesson-question-manager", () => ({
  AdminLessonQuestionManager: ({ lesson }: { lesson: { questions: unknown[] } }) => (
    <div>Question manager: {lesson.questions.length}</div>
  ),
}));

vi.mock("@/lib/authz", () => ({
  requireDioceseAdmin: vi.fn(),
}));

vi.mock("@/lib/repositories/diocese-admin", () => ({
  getCourseLessonContentForAdmin: vi.fn(),
}));

import DioceseAdminLessonQuestionsPage from "@/app/app/admin/courses/[courseId]/lessons/[lessonId]/page";
import { requireDioceseAdmin } from "@/lib/authz";
import { getCourseLessonContentForAdmin } from "@/lib/repositories/diocese-admin";

describe("DioceseAdminLessonQuestionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin-1");
    vi.mocked(getCourseLessonContentForAdmin).mockResolvedValue({
      course: {
        id: "course-1",
        title: "Test Course",
        description: null,
        thumbnail_url: null,
        scope: "DIOCESE",
        published: true,
        publicly_browseable: false,
        created_at: "2026-01-01",
        updated_at: "2026-01-02",
      },
      module: {
        id: "module-1",
        course_id: "course-1",
        title: "Test Module",
        descriptor: null,
        thumbnail_url: null,
        sort_order: 1,
        lessons: [],
      },
      lesson: {
        id: "lesson-1",
        title: "Test Lesson",
        module_id: "module-1",
        descriptor: null,
        thumbnail_url: null,
        content_type: "VIDEO",
        youtube_video_id: "abc123",
        document_url: null,
        document_page_start: null,
        document_page_end: null,
        passing_score: 80,
        sort_order: 1,
        questions: [],
      },
    });
  });

  it("requires a diocese admin before rendering lesson questions", async () => {
    render(
      await DioceseAdminLessonQuestionsPage({
        params: Promise.resolve({ courseId: "course-1", lessonId: "lesson-1" }),
      }),
    );

    expect(vi.mocked(requireDioceseAdmin).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(getCourseLessonContentForAdmin).mock.invocationCallOrder[0],
    );
    expect(getCourseLessonContentForAdmin).toHaveBeenCalledWith("course-1", "lesson-1");
    expect(screen.getByText("Lesson question builder: Test Lesson")).toBeInTheDocument();
    expect(screen.getByText("Question manager: 0")).toBeInTheDocument();
  });

  it("does not load lesson content when the guard rejects access", async () => {
    const accessError = new Error("redirect");
    vi.mocked(requireDioceseAdmin).mockRejectedValue(accessError);

    await expect(
      DioceseAdminLessonQuestionsPage({
        params: Promise.resolve({ courseId: "course-1", lessonId: "lesson-1" }),
      }),
    ).rejects.toThrow(accessError);
    expect(getCourseLessonContentForAdmin).not.toHaveBeenCalled();
  });
});
