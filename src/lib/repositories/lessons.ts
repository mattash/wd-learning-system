import { E2E_COURSE, E2E_LESSON, E2E_QUESTIONS } from "@/lib/e2e-fixtures";
import { isE2ESmokeMode } from "@/lib/e2e-mode";
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
  if (isE2ESmokeMode()) {
    if (lessonId !== E2E_LESSON.id) return null;
    return {
      ...E2E_LESSON,
      questions: E2E_QUESTIONS.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        options: q.options,
        sort_order: q.sort_order,
      })),
    };
  }

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
  if (isE2ESmokeMode()) {
    return { percent_watched: 0, last_position_seconds: 0, completed: false };
  }

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
  if (isE2ESmokeMode()) {
    return 0;
  }

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

export async function getCourseIdForLesson(lessonId: string): Promise<string | null> {
  if (isE2ESmokeMode()) {
    return lessonId === E2E_LESSON.id ? E2E_COURSE.id : null;
  }

  const supabase = getSupabaseAdminClient();
  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("module_id")
    .eq("id", lessonId)
    .maybeSingle();

  if (lessonError) throw lessonError;
  if (!lesson) return null;

  const { data: moduleRow, error: moduleError } = await supabase
    .from("modules")
    .select("course_id")
    .eq("id", (lesson as { module_id: string }).module_id)
    .maybeSingle();

  if (moduleError) throw moduleError;
  return (moduleRow as { course_id: string } | null)?.course_id ?? null;
}

export async function isUserEnrolledForLesson({
  lessonId,
  parishId,
  clerkUserId,
}: {
  lessonId: string;
  parishId: string;
  clerkUserId: string;
}): Promise<boolean> {
  const courseId = await getCourseIdForLesson(lessonId);
  if (!courseId) return false;

  if (isE2ESmokeMode()) {
    return true;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select("id")
    .eq("parish_id", parishId)
    .eq("clerk_user_id", clerkUserId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}
