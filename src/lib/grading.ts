export interface GradeQuestion {
  correct_option_index: number;
}

export function gradeQuiz(
  answers: number[],
  questions: GradeQuestion[],
): { score: number; total: number } {
  if (!questions.length) return { score: 0, total: 0 };
  const correct = questions.reduce((acc, question, idx) => {
    return acc + (answers[idx] === question.correct_option_index ? 1 : 0);
  }, 0);
  const score = Math.round((correct / questions.length) * 100);
  return { score, total: questions.length };
}

export function isLessonComplete(params: {
  videoCompleted: boolean;
  bestScore: number;
  passingScore: number;
}) {
  return params.videoCompleted && params.bestScore >= params.passingScore;
}
