import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigationMocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: navigationMocks.notFound,
  redirect: navigationMocks.redirect,
}));

vi.mock("@/lib/authz", () => ({
  requireParishRole: vi.fn(),
}));

vi.mock("@/lib/repositories/courses", () => ({
  getCourseTree: vi.fn(),
  isUserEnrolledInCourse: vi.fn(),
}));

vi.mock("@/lib/repositories/course-join-requests", () => ({
  getStudentPendingRequests: vi.fn(),
}));

vi.mock("@/components/course-join/request-join-button", () => ({
  RequestJoinButton: ({ courseId, initiallyRequested }: { courseId: string; initiallyRequested?: boolean }) => (
    <button>{initiallyRequested ? `Request sent ${courseId}` : `Request ${courseId}`}</button>
  ),
}));

import CoursePreviewPage from "@/app/app/courses/[courseId]/preview/page";
import { requireParishRole } from "@/lib/authz";
import { getStudentPendingRequests } from "@/lib/repositories/course-join-requests";
import { getCourseTree, isUserEnrolledInCourse } from "@/lib/repositories/courses";

const courseId = "11111111-1111-4111-8111-111111111111";

describe("CoursePreviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireParishRole).mockResolvedValue({
      parishId: "parish-1",
      clerkUserId: "user-1",
      role: "student",
    });
    vi.mocked(isUserEnrolledInCourse).mockResolvedValue(false);
    vi.mocked(getStudentPendingRequests).mockResolvedValue([]);
    vi.mocked(getCourseTree).mockResolvedValue({
      course: {
        id: courseId,
        title: "Foundations",
        description: "Learn the basics.",
        published: true,
        scope: "DIOCESE",
        thumbnailUrl: "/course.png",
        instructor: "Fr. Mesrop",
        durationHours: 2,
        category: "Catechesis",
      },
      modules: [
        {
          id: "module-1",
          title: "Getting Started",
          sort_order: 1,
          lessons: [
            {
              id: "lesson-1",
              title: "Welcome",
              sort_order: 1,
              content_type: "VIDEO",
              thumbnail_url: null,
              passing_score: 80,
              questions: [],
            },
          ],
        },
      ],
    });
  });

  it("renders the course preview with a request-join CTA for an unenrolled student", async () => {
    render(await CoursePreviewPage({ params: Promise.resolve({ courseId }) }));

    expect(screen.getByRole("heading", { name: "Foundations" })).toBeInTheDocument();
    expect(screen.getByText("Learn the basics.")).toBeInTheDocument();
    expect(screen.getByText("Getting Started")).toBeInTheDocument();
    expect(screen.getByText("Welcome")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Back to catalog" })).toHaveAttribute("href", "/app/catalog");
    expect(screen.getByRole("button", { name: `Request ${courseId}` })).toBeInTheDocument();
  });

  it("renders an empty outline for a course without lessons", async () => {
    vi.mocked(getCourseTree).mockResolvedValue({
      course: {
        id: courseId,
        title: "Preview Only",
        description: null,
        published: true,
        scope: "PARISH",
        thumbnailUrl: null,
        instructor: null,
        durationHours: null,
        category: null,
      },
      modules: [],
    });

    render(await CoursePreviewPage({ params: Promise.resolve({ courseId }) }));

    expect(screen.getByRole("heading", { name: "Preview Only" })).toBeInTheDocument();
    expect(screen.getByText("No lessons have been added to this course yet.")).toBeInTheDocument();
  });

  it("redirects an enrolled student to the course detail page", async () => {
    vi.mocked(isUserEnrolledInCourse).mockResolvedValue(true);

    await expect(CoursePreviewPage({ params: Promise.resolve({ courseId }) })).rejects.toThrow(
      `NEXT_REDIRECT:/app/courses/${courseId}`,
    );
    expect(getCourseTree).not.toHaveBeenCalled();
  });

  it("returns 404 when the course is not visible to the parish", async () => {
    vi.mocked(getCourseTree).mockResolvedValue(null);

    await expect(CoursePreviewPage({ params: Promise.resolve({ courseId }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(navigationMocks.notFound).toHaveBeenCalled();
  });

  it("shows the request as already sent when a pending request exists", async () => {
    vi.mocked(getStudentPendingRequests).mockResolvedValue([
      {
        id: "request-1",
        parishId: "parish-1",
        clerkUserId: "user-1",
        courseId,
        status: "PENDING",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    ]);

    render(await CoursePreviewPage({ params: Promise.resolve({ courseId }) }));

    expect(screen.getByRole("button", { name: `Request sent ${courseId}` })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: `Request ${courseId}` })).not.toBeInTheDocument();
  });

  it("ignores pending requests for other courses", async () => {
    vi.mocked(getStudentPendingRequests).mockResolvedValue([
      {
        id: "request-1",
        parishId: "parish-1",
        clerkUserId: "user-1",
        courseId: "another-course",
        status: "PENDING",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    ]);

    render(await CoursePreviewPage({ params: Promise.resolve({ courseId }) }));

    expect(screen.getByRole("button", { name: `Request ${courseId}` })).toBeInTheDocument();
  });
});
