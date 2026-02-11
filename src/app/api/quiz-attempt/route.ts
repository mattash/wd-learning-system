import { NextResponse } from "next/server";

import { requireAuth, requireParishRole } from "@/lib/authz";
import { gradeQuiz } from "@/lib/grading";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { quizSubmissionSchema } from "@/lib/validation/quiz";

export async function POST(req: Request) {
  const clerkUserId = await requireAuth();
  const { parishId } = await requireParishRole("student");
  const payload = quizSubmissionSchema.parse(await req.json());

  if (payload.parishId !== parishId) {
    return NextResponse.json({ error: "Invalid parish context" }, { status: 403 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: questions, error: questionError } = await supabase
    .from("questions")
    .select("id,correct_option_index")
    .eq("lesson_id", payload.lessonId)
    .order("sort_order", { ascending: true });

  if (questionError || !questions) {
    return NextResponse.json({ error: "Could not fetch questions" }, { status: 400 });
  }

  const grade = gradeQuiz(
    payload.answers,
    (questions as Array<{ correct_option_index: number }>),
  );

  const { error } = await supabase.from("quiz_attempts").insert({
    parish_id: parishId,
    clerk_user_id: clerkUserId,
    lesson_id: payload.lessonId,
    answers: payload.answers,
    score: grade.score,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, score: grade.score, total: grade.total });
}
