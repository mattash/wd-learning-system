import { E2E_COURSE, E2E_LESSON, E2E_MODULE } from "@/lib/e2e-fixtures";
import { isE2ESmokeMode } from "@/lib/e2e-mode";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export interface VisibleCourse {
  id: string;
  title: string;
  description: string | null;
  published: boolean;
  scope: "DIOCESE" | "PARISH";
}

export interface CourseModule {
  id: string;
  title: string;
  sort_order: number;
  lessons: { id: string; title: string; sort_order: number }[];
}

export async function listVisibleCourses(parishId: string): Promise<VisibleCourse[]> {
  if (isE2ESmokeMode()) {
    return [E2E_COURSE];
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("get_visible_courses", {
    p_parish_id: parishId,
  });

  if (error) throw error;
  return (data ?? []) as VisibleCourse[];
}

export async function listEnrolledVisibleCourses(
  parishId: string,
  clerkUserId: string,
): Promise<VisibleCourse[]> {
  if (isE2ESmokeMode()) {
    return [E2E_COURSE];
  }

  const [visibleCourses, enrollments] = await Promise.all([
    listVisibleCourses(parishId),
    getSupabaseAdminClient()
      .from("enrollments")
      .select("course_id")
      .eq("parish_id", parishId)
      .eq("clerk_user_id", clerkUserId),
  ]);

  if (enrollments.error) {
    throw enrollments.error;
  }

  const enrolledCourseIds = new Set(
    (((enrollments.data ?? []) as Array<{ course_id: string }>).map((row) => row.course_id)) ?? [],
  );

  return visibleCourses.filter((course) => enrolledCourseIds.has(course.id));
}

export async function isUserEnrolledInCourse({
  parishId,
  clerkUserId,
  courseId,
}: {
  parishId: string;
  clerkUserId: string;
  courseId: string;
}): Promise<boolean> {
  if (isE2ESmokeMode()) {
    return courseId === E2E_COURSE.id;
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

export async function getCourseTree(courseId: string, parishId: string) {
  if (isE2ESmokeMode()) {
    if (courseId !== E2E_COURSE.id) return null;
    return {
      course: E2E_COURSE,
      modules: [
        {
          ...E2E_MODULE,
          lessons: [{ id: E2E_LESSON.id, title: E2E_LESSON.title, sort_order: 1 }],
        },
      ],
    };
  }

  const supabase = getSupabaseAdminClient();
  const visibleCourses = await listVisibleCourses(parishId);
  const course = visibleCourses.find((item) => item.id === courseId);

  if (!course) return null;

  const { data: modules, error: modulesError } = await supabase
    .from("modules")
    .select("id,title,sort_order, lessons(id,title,sort_order)")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });

  if (modulesError) throw modulesError;
  return { course, modules: ((modules ?? []) as CourseModule[]) ?? [] };
}
