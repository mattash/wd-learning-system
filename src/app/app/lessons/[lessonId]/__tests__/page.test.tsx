import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigationMocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: navigationMocks.redirect,
  notFound: navigationMocks.notFound,
}));

vi.mock("@/components/player/youtube-player", () => ({
  YoutubePlayer: ({ videoId }: { videoId: string }) => <div>Video player: {videoId}</div>,
}));

vi.mock("@/components/quiz-form", () => ({
  QuizForm: vi.fn(
    ({
      passingScore,
      questions,
    }: {
      passingScore: number;
      questions: Array<{ prompt: string }>;
    }) => (
      <div>
        Quiz questions: {questions.length}; passing score: {passingScore}
      </div>
    ),
  ),
}));

vi.mock("@/components/document-review-card", () => ({
  DocumentReviewCard: ({ documentLabel }: { documentLabel: string }) => <div>Document review: {documentLabel}</div>,
}));

vi.mock("@/lib/authz", () => ({
  requireParishRole: vi.fn(),
}));

vi.mock("@/lib/e2e-mode", () => ({
  isE2ESmokeMode: vi.fn(() => false),
}));

vi.mock("@/lib/repositories/lessons", () => ({
  getBestScore: vi.fn(),
  getCourseIdForLesson: vi.fn(),
  getLessonNavContext: vi.fn(),
  getLessonProgress: vi.fn(),
  getLessonWithQuestions: vi.fn(),
  isUserEnrolledForLesson: vi.fn(),
}));

vi.mock("@/lib/repositories/courses", () => ({
  getCourseTreeWithProgress: vi.fn(),
}));

vi.mock("@/components/course-sidebar", () => ({
  CourseSidebar: () => <div>Course sidebar</div>,
}));

import LessonPage from "@/app/app/lessons/[lessonId]/page";
import { QuizForm } from "@/components/quiz-form";
import { requireParishRole } from "@/lib/authz";
import { getCourseTreeWithProgress } from "@/lib/repositories/courses";
import {
  getBestScore,
  getCourseIdForLesson,
  getLessonNavContext,
  getLessonProgress,
  getLessonWithQuestions,
  isUserEnrolledForLesson,
} from "@/lib/repositories/lessons";

describe("LessonPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "user-1",
      parishId: "parish-1",
      role: "student",
    });
    vi.mocked(isUserEnrolledForLesson).mockResolvedValue(true);
    vi.mocked(getLessonProgress).mockResolvedValue({
      percent_watched: 100,
      last_position_seconds: 0,
      completed: true,
    });
    vi.mocked(getLessonNavContext).mockResolvedValue({
      lesson: { id: "lesson-1", title: "Test Lesson" },
      course: { id: "course-1", title: "Test Course" },
      module: { id: "module-1", title: "Test Module" },
      previousLesson: null,
      nextLesson: null,
    });
    vi.mocked(getBestScore).mockResolvedValue(100);
    vi.mocked(getCourseIdForLesson).mockResolvedValue("course-1");
    vi.mocked(getCourseTreeWithProgress).mockResolvedValue({
      course: { id: "course-1", title: "Test Course", description: null, published: true, scope: "DIOCESE" as const },
      modules: [{
        id: "module-1",
        title: "Test Module",
        sort_order: 1,
        lessons: [{ id: "lesson-1", title: "Test Lesson", sort_order: 1, content_type: "VIDEO" as const, thumbnailUrl: null, status: "not_started" as const, bestScore: 0 }],
      }],
    });
  });

  it("renders document lessons with review status and iframe", async () => {
    vi.mocked(getLessonWithQuestions).mockResolvedValue({
      id: "lesson-1",
      title: "Reading lesson",
      descriptor: "Read the assigned section.",
      content_type: "DOCUMENT",
      youtube_video_id: null,
      document_url: "/docs/reading.pdf",
      document_page_start: 2,
      document_page_end: 4,
      passing_score: 80,
      module_id: "module-1",
      questions: [{ id: "q1", prompt: "What did you read?", options: ["A"], sort_order: 0 }],
    });

    render(await LessonPage({ params: Promise.resolve({ lessonId: "lesson-1" }) }));

    expect(screen.getByRole("heading", { name: "Reading lesson" })).toBeInTheDocument();
    expect(screen.getByText("Document review: Pages 2-4")).toBeInTheDocument();
    const documentFrame = screen.getByTitle("Reading lesson document");
    expect(documentFrame).toHaveAttribute("src", "/docs/reading.pdf#page=2");
    expect(documentFrame).toHaveAttribute("sandbox", "allow-downloads allow-scripts allow-same-origin");
    expect(documentFrame).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(screen.getByText("Quiz questions: 1; passing score: 80")).toBeInTheDocument();
    expect(vi.mocked(QuizForm).mock.calls[0]?.[0]).toMatchObject({
      passingScore: 80,
    });
  });

  it("renders video lessons with the video player", async () => {
    vi.mocked(getLessonWithQuestions).mockResolvedValue({
      id: "lesson-1",
      title: "Video lesson",
      descriptor: null,
      content_type: "VIDEO",
      youtube_video_id: "abc123",
      document_url: null,
      document_page_start: null,
      document_page_end: null,
      passing_score: 80,
      module_id: "module-1",
      questions: [],
    });

    render(await LessonPage({ params: Promise.resolve({ lessonId: "lesson-1" }) }));

    expect(screen.getByText("Video player: abc123")).toBeInTheDocument();
  });

  it("returns not found for missing lessons before checking enrollment", async () => {
    vi.mocked(getLessonWithQuestions).mockResolvedValue(null);
    vi.mocked(isUserEnrolledForLesson).mockResolvedValue(false);
    navigationMocks.notFound.mockImplementationOnce(() => {
      throw new Error("NEXT_NOT_FOUND");
    });

    await expect(LessonPage({ params: Promise.resolve({ lessonId: "missing-lesson" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );

    expect(navigationMocks.notFound).toHaveBeenCalled();
    expect(isUserEnrolledForLesson).not.toHaveBeenCalled();
    expect(navigationMocks.redirect).not.toHaveBeenCalled();
  });
});
