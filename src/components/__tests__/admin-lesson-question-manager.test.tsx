import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminLessonQuestionManager } from "@/components/admin-lesson-question-manager";
import type { DioceseLessonRow } from "@/lib/repositories/diocese-admin";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const lesson: DioceseLessonRow = {
  id: "lesson-1",
  module_id: "module-1",
  title: "Lesson",
  descriptor: null,
  thumbnail_url: null,
  content_type: "VIDEO",
  youtube_video_id: "abc123",
  document_url: null,
  document_page_start: null,
  document_page_end: null,
  sort_order: 0,
  passing_score: 80,
  questions: [
    {
      id: "question-1",
      lesson_id: "lesson-1",
      prompt: "Which answer is correct?",
      options: ["", "Correct answer", "Distractor"],
      correct_option_index: 1,
      sort_order: 0,
    },
  ],
};

describe("AdminLessonQuestionManager", () => {
  beforeEach(() => {
    refresh.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("translates the correct answer index after removing blank options", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<AdminLessonQuestionManager lesson={lesson} />);

    fireEvent.click(screen.getByRole("button", { name: "Save question" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/questions/question-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          prompt: "Which answer is correct?",
          options: ["Correct answer", "Distractor"],
          correctOptionIndex: 0,
          sortOrder: 0,
        }),
      }),
    );
    expect(await screen.findByText("Question updated.")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("rejects saving when the selected correct answer is blank", async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminLessonQuestionManager
        lesson={{
          ...lesson,
          questions: [
            {
              ...lesson.questions[0],
              correct_option_index: 0,
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save question" }));

    expect(await screen.findByText("Correct answer must be a filled option.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
