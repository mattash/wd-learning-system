import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuizForm } from "@/components/quiz-form";

const baseProps = {
  courseTitle: undefined,
  lessonId: "11111111-1111-4111-8111-111111111111",
  lessonTitle: "Intro lesson",
  nextLesson: null,
  parishId: "22222222-2222-4222-8222-222222222222",
  questions: [
    {
      id: "question-1",
      options: ["Wrong answer", "Correct answer"],
      prompt: "Which option is correct?",
    },
  ],
};

describe("QuizForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows a failed quiz attempt to be changed and submitted again", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ correctIndices: [1], score: 0 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ correctIndices: [1], score: 100 }),
      } as Response);

    render(<QuizForm {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Wrong answer/ }));
    fireEvent.click(screen.getByRole("button", { name: "Submit answers" }));

    expect(await screen.findByText("Review the questions above and try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Correct answer/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Submit answers" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /Correct answer/ }));
    fireEvent.click(screen.getByRole("button", { name: "Submit answers" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [, retryRequest] = fetchMock.mock.calls[1];

    expect(retryRequest).toEqual(expect.objectContaining({ method: "POST" }));
    expect(JSON.parse((retryRequest as RequestInit).body as string)).toEqual({
      answers: [1],
      lessonId: baseProps.lessonId,
      parishId: baseProps.parishId,
    });
  });
});
