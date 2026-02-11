import { getSupabaseAdminClient } from "@/lib/supabase/server";

interface LessonQuestion {
  id: string;
  prompt: string;
  options: unknown;
  sort_order: number;
}

export interface LessonWithQuestions {
  id: string;
  title: string;
  youtube_video_id: string;
  passing_score: number;
  module_id: string;
  questions: LessonQuestion[];
}

export async function getLessonWithQuestions(
  lessonId: string,
): Promise<LessonWithQuestions | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("lessons")
    .select(
      "id,title,youtube_video_id,passing_score,module_id, questions(id,prompt,options,sort_order)",
    )
    .eq("id", lessonId)
    .order("sort_order", { referencedTable: "questions", ascending: true })
    .maybeSingle();

  if (error) throw error;
  return (data as LessonWithQuestions | null) ?? null;
}

export async function getVideoProgress(
  lessonId: string,
  parishId: string,
  clerkUserId: string,
): Promise<{ percent_watched: number; last_position_seconds: number; completed: boolean } | null> {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("video_progress")
    .select("percent_watched,last_position_seconds,completed")
    .eq("lesson_id", lessonId)
    .eq("parish_id", parishId)
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  return (data as { percent_watched: number; last_position_seconds: number; completed: boolean } | null) ?? null;
}

export async function getBestScore(lessonId: string, parishId: string, clerkUserId: string) {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("quiz_attempts")
    .select("score")
    .eq("lesson_id", lessonId)
    .eq("parish_id", parishId)
    .eq("clerk_user_id", clerkUserId)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();

  return ((data as { score: number } | null)?.score ?? 0);
}
