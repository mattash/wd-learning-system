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
  QuizForm: ({ questions }: { questions: Array<{ prompt: string }> }) => (
    <div>Quiz questions: {questions.length}</div>
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
  getLessonProgress: vi.fn(),
  getLessonWithQuestions: vi.fn(),
  isUserEnrolledForLesson: vi.fn(),
}));

import LessonPage from "@/app/app/lessons/[lessonId]/page";
import { requireParishRole } from "@/lib/authz";
import {
  getBestScore,
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
    vi.mocked(getBestScore).mockResolvedValue(100);
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

    expect(screen.getByText("Reading lesson")).toBeInTheDocument();
    expect(screen.getByText("Review status: Reviewed · Pages 2-4")).toBeInTheDocument();
    expect(screen.getByText("Document review: Pages 2-4")).toBeInTheDocument();
    expect(screen.getByTitle("Reading lesson document")).toHaveAttribute("src", "/docs/reading.pdf#page=2");
    expect(screen.getByText("Quiz questions: 1")).toBeInTheDocument();
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
    expect(screen.getByText("Quiz questions: 0")).toBeInTheDocument();
  });
});
