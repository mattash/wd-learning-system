import { E2E_COURSE } from "@/lib/e2e-fixtures";
import { isE2ESmokeMode } from "@/lib/e2e-mode";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export interface CatalogCourse {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  scope: "DIOCESE" | "PARISH";
  lessonCount: number;
  enrolled: boolean;
}

export async function getCatalogCourses(
  parishId: string,
  clerkUserId: string,
): Promise<CatalogCourse[]> {
  if (isE2ESmokeMode()) {
    return [
      {
        ...E2E_COURSE,
        thumbnailUrl: "/globe.svg",
        lessonCount: 2,
        enrolled: true,
      },
    ];
  }

  const supabase = getSupabaseAdminClient();

  // Get published DIOCESE courses + parish-scoped courses adopted by this parish
  const { data: courses, error } = await supabase
    .from("courses")
    .select("id, title, description, thumbnail_url, scope")
    .eq("published", true)
    .or(`scope.eq.DIOCESE,and(scope.eq.PARISH,id.in.(select course_id from course_parishes where parish_id.eq.${parishId}))`)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!courses || courses.length === 0) return [];

  // Get enrollment status for this user
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("course_id")
    .eq("parish_id", parishId)
    .eq("clerk_user_id", clerkUserId);

  const enrolledSet = new Set(
    ((enrollments ?? []) as Array<{ course_id: string }>).map((e) => e.course_id),
  );

  // Get lesson counts
  const courseIds = (courses as Array<{ id: string }>).map((c) => c.id);
  const { data: lessonCounts } = await supabase
    .from("modules")
    .select("course_id, lessons(id)")
    .in("course_id", courseIds);

  const lessonCountByCourse = new Map<string, number>();
  for (const mod of (lessonCounts ?? []) as Array<{
    course_id: string;
    lessons: Array<{ id: string }>;
  }>) {
    const current = lessonCountByCourse.get(mod.course_id) ?? 0;
    lessonCountByCourse.set(mod.course_id, current + (mod.lessons?.length ?? 0));
  }

  return (courses as Array<{
    id: string;
    title: string;
    description: string | null;
    thumbnail_url: string | null;
    scope: "DIOCESE" | "PARISH";
  }>).map((course) => ({
    id: course.id,
    title: course.title,
    description: course.description,
    thumbnailUrl: course.thumbnail_url,
    scope: course.scope,
    lessonCount: lessonCountByCourse.get(course.id) ?? 0,
    enrolled: enrolledSet.has(course.id),
  }));
}
