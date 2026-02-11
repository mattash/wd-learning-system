import { describe, expect, it } from "vitest";

import { gradeQuiz, isLessonComplete } from "@/lib/grading";

describe("gradeQuiz", () => {
  it("calculates score percentage", () => {
    const result = gradeQuiz([1, 2, 1], [
      { correct_option_index: 1 },
      { correct_option_index: 0 },
      { correct_option_index: 1 },
    ]);

    expect(result.score).toBe(67);
    expect(result.total).toBe(3);
  });
});

describe("isLessonComplete", () => {
  it("requires both video completion and passing quiz score", () => {
    expect(
      isLessonComplete({ videoCompleted: true, bestScore: 80, passingScore: 80 }),
    ).toBe(true);
    expect(
      isLessonComplete({ videoCompleted: false, bestScore: 100, passingScore: 80 }),
    ).toBe(false);
  });
});
