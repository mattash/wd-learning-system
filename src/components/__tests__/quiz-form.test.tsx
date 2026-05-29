import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QuizForm } from "@/components/quiz-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const sampleQuestions = [
  {
    id: "q1",
    prompt: "What is the capital of France?",
    options: ["Paris", "London", "Berlin", "Madrid"],
  },
  {
    id: "q2",
    prompt: "What is 2 + 2?",
    options: ["3", "4", "5", "6"],
  },
];

describe("QuizForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when there are no questions", () => {
    const { container } = render(
      <QuizForm
        lessonId="lesson-1"
        lessonTitle="Test Lesson"
        parishId="parish-1"
        questions={[]}
        nextLesson={null}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders questions and submit button", () => {
    render(
      <QuizForm
        lessonId="lesson-1"
        lessonTitle="Test Lesson"
        parishId="parish-1"
        questions={sampleQuestions}
        nextLesson={null}
      />,
    );

    expect(screen.getByText("What is the capital of France?")).toBeInTheDocument();
    expect(screen.getByText("What is 2 + 2?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit answers" })).toBeDisabled();
  });

  it("enables submit button when all questions are answered", () => {
    render(
      <QuizForm
        lessonId="lesson-1"
        lessonTitle="Test Lesson"
        parishId="parish-1"
        questions={sampleQuestions}
        nextLesson={null}
      />,
    );

    const submitButton = screen.getByRole("button", { name: "Submit answers" });
    expect(submitButton).toBeDisabled();

    // Click an option for each question
    fireEvent.click(screen.getByText("Paris"));
    fireEvent.click(screen.getByText("4"));

    expect(submitButton).toBeEnabled();
  });

  it("submits answers and shows score on success", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ score: 50, correctIndices: [0, 1] }),
    } as Response);

    render(
      <QuizForm
        lessonId="lesson-1"
        lessonTitle="Test Lesson"
        parishId="parish-1"
        questions={sampleQuestions}
        nextLesson={null}
      />,
    );

    fireEvent.click(screen.getByText("Paris"));
    fireEvent.click(screen.getByText("5"));
    fireEvent.click(screen.getByRole("button", { name: "Submit answers" }));

    expect(await screen.findByText("Score: 50%")).toBeInTheDocument();
  });

  it("shows error when quiz submission fails with server message", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Quiz already submitted" }),
    } as Response);

    render(
      <QuizForm
        lessonId="lesson-1"
        lessonTitle="Test Lesson"
        parishId="parish-1"
        questions={sampleQuestions}
        nextLesson={null}
      />,
    );

    fireEvent.click(screen.getByText("Paris"));
    fireEvent.click(screen.getByText("4"));
    fireEvent.click(screen.getByRole("button", { name: "Submit answers" }));

    expect(await screen.findByText("Quiz already submitted")).toBeInTheDocument();
  });

  it("shows fallback error when quiz submission response is not json", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    } as unknown as Response);

    render(
      <QuizForm
        lessonId="lesson-1"
        lessonTitle="Test Lesson"
        parishId="parish-1"
        questions={sampleQuestions}
        nextLesson={null}
      />,
    );

    fireEvent.click(screen.getByText("Paris"));
    fireEvent.click(screen.getByText("4"));
    fireEvent.click(screen.getByRole("button", { name: "Submit answers" }));

    expect(await screen.findByText("Failed to submit quiz answers.")).toBeInTheDocument();
  });

  it("shows error when quiz submission request rejects", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network error"));

    render(
      <QuizForm
        lessonId="lesson-1"
        lessonTitle="Test Lesson"
        parishId="parish-1"
        questions={sampleQuestions}
        nextLesson={null}
      />,
    );

    fireEvent.click(screen.getByText("Paris"));
    fireEvent.click(screen.getByText("4"));
    fireEvent.click(screen.getByRole("button", { name: "Submit answers" }));

    expect(await screen.findByText("Failed to submit quiz answers.")).toBeInTheDocument();
  });

  it("shows completion modal when score is 100 with courseTitle", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ score: 100, certificateId: "cert-123", correctIndices: [0, 1] }),
    } as Response);

    render(
      <QuizForm
        courseTitle="Catechesis 101"
        lessonId="lesson-1"
        lessonTitle="Test Lesson"
        parishId="parish-1"
        questions={sampleQuestions}
        nextLesson={{ id: "next-lesson", title: "Next Up" }}
      />,
    );

    fireEvent.click(screen.getByText("Paris"));
    fireEvent.click(screen.getByText("4"));
    fireEvent.click(screen.getByRole("button", { name: "Submit answers" }));

    // CompletionModal renders when score is 100 and courseTitle is provided
    expect(await screen.findByText("100%")).toBeInTheDocument();
  });
});
