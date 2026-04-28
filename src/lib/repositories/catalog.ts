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

  // Get parish-scoped course IDs adopted by this parish
  const { data: adoptedCourses, error: adoptedError } = await supabase
    .from("course_parishes")
    .select("course_id")
    .eq("parish_id", parishId);

  if (adoptedError) throw adoptedError;

  const adoptedIds = ((adoptedCourses ?? []) as Array<{ course_id: string }>).map(
    (r) => r.course_id,
  );

  // Build the visibility filter: DIOCESE courses OR parish-adopted PARISH courses
  let query = supabase
    .from("courses")
    .select("id, title, description, thumbnail_url, scope")
    .eq("published", true);

  if (adoptedIds.length > 0) {
    query = query.or(`scope.eq.DIOCESE,and(scope.eq.PARISH,id.in.(${adoptedIds.join(",")}))`);
  } else {
    query = query.eq("scope", "DIOCESE");
  }

  const { data: courses, error: coursesError } = await query.order("created_at", {
    ascending: false,
  });

  if (coursesError) throw coursesError;
  if (!courses || courses.length === 0) return [];

  // Get enrollment status for this user
  const { data: enrollments, error: enrollError } = await supabase
    .from("enrollments")
    .select("course_id")
    .eq("parish_id", parishId)
    .eq("clerk_user_id", clerkUserId);

  if (enrollError) throw enrollError;

  const enrolledSet = new Set(
    ((enrollments ?? []) as Array<{ course_id: string }>).map((e) => e.course_id),
  );

  // Get lesson counts for visible courses
  const courseIds = (courses as Array<{ id: string }>).map((c) => c.id);
  const { data: lessonCounts, error: countError } = await supabase
    .from("modules")
    .select("course_id, lessons(id)")
    .in("course_id", courseIds);

  if (countError) throw countError;

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
