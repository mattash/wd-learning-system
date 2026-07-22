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
  it.each([
    {
      case: "content incomplete without a quiz",
      params: {
        contentCompleted: false,
        bestScore: 0,
        passingScore: 80,
        questionCount: 0,
      },
      expected: false,
    },
    {
      case: "content complete without a quiz",
      params: {
        contentCompleted: true,
        bestScore: 0,
        passingScore: 80,
        questionCount: 0,
      },
      expected: true,
    },
    {
      case: "quiz below the passing score",
      params: {
        contentCompleted: true,
        bestScore: 79,
        passingScore: 80,
        questionCount: 1,
      },
      expected: false,
    },
    {
      case: "quiz equal to the passing score",
      params: {
        contentCompleted: true,
        bestScore: 80,
        passingScore: 80,
        questionCount: 1,
      },
      expected: true,
    },
    {
      case: "quiz above the passing score",
      params: {
        contentCompleted: true,
        bestScore: 90,
        passingScore: 80,
        questionCount: 1,
      },
      expected: true,
    },
    {
      case: "content incomplete with a perfect quiz",
      params: {
        contentCompleted: false,
        bestScore: 100,
        passingScore: 80,
        questionCount: 1,
      },
      expected: false,
    },
  ])("returns $expected for $case", ({ params, expected }) => {
    expect(isLessonComplete(params)).toBe(expected);
  });
});
