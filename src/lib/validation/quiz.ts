import { z } from "zod";

export const quizSubmissionSchema = z.object({
  lessonId: z.string().uuid(),
  parishId: z.string().uuid(),
  answers: z.array(z.number().int().min(0)),
});

export type QuizSubmission = z.infer<typeof quizSubmissionSchema>;
