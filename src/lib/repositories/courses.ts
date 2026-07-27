import {
  E2E_COURSE,
  E2E_LESSON,
  E2E_MODULE,
  E2E_QUESTIONS,
} from "@/lib/e2e-fixtures";
import { isE2ESmokeMode } from "@/lib/e2e-mode";
import type { CourseCategory } from "@/lib/course-metadata";
import { parseDurationHours } from "@/lib/course-metadata";
import { isLessonComplete } from "@/lib/grading";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export interface VisibleCourse {
  id: string;
  title: string;
  description: string | null;
  published: boolean;
  scope: "DIOCESE" | "PARISH";
  thumbnailUrl?: string | null;
  instructor?: string | null;
  durationHours?: number | null;
  category?: CourseCategory | null;
}

interface CourseModule {
  id: string;
  title: string;
  sort_order: number;
  lessons: Array<{
    id: string;
    title: string;
    sort_order: number;
    content_type: "VIDEO" | "DOCUMENT";
    thumbnail_url: string | null;
    passing_score: number;
    questions: Array<{ id: string }>;
  }>;
}

export interface PublicCoursePreview {
  course: VisibleCourse;
  modules: Array<{
    id: string;
    title: string;
    sort_order: number;
    lessons: Array<{ id: string; title: string; sort_order: number }>;
  }>;
  lessonCount: number;
}

export interface PublicCatalogCourse {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  durationHours: number | null;
  category: CourseCategory | null;
  lessonCount: number;
}

export async function listPublicCatalogCourses(): Promise<PublicCatalogCourse[]> {
  if (isE2ESmokeMode()) {
    return [
      {
        id: E2E_COURSE.id,
        title: E2E_COURSE.title,
        description: E2E_COURSE.description,
        thumbnailUrl: "/course-covers/foundations-course-cover.png",
        durationHours: 1,
        category: "Leadership",
        lessonCount: 1,
      },
    ];
  }

  const supabase = getSupabaseAdminClient();
  const { data: courses, error: coursesError } = await supabase
    .from("courses")
    .select("id,title,description,thumbnail_url,duration_hours,category")
    .eq("published", true)
    .eq("publicly_browseable", true)
    .order("title", { ascending: true });

  if (coursesError) throw coursesError;
  if (!courses || courses.length === 0) return [];

  const courseIds = (courses as Array<{ id: string }>).map((c) => c.id);
  const { data: lessonCounts, error: countError } = await supabase
    .from("modules")
    .select("course_id, lessons(id)")
    .in("course_id", courseIds);

  if (countError) throw countError;

  const lessonCountByCourse = new Map<string, number>();
  for (const mod of (lessonCounts ?? []) as Array<{
    course_id: string;
    lessons: Array<{ id: string }> | null;
  }>) {
    const current = lessonCountByCourse.get(mod.course_id) ?? 0;
    lessonCountByCourse.set(mod.course_id, current + (mod.lessons?.length ?? 0));
  }

  return (courses as Array<{
    id: string;
    title: string;
    description: string | null;
    thumbnail_url: string | null;
    duration_hours: number | string | null;
    category: CourseCategory | null;
  }>).map((course) => ({
    id: course.id,
    title: course.title,
    description: course.description,
    thumbnailUrl: course.thumbnail_url,
    durationHours: parseDurationHours(course.duration_hours),
    category: course.category,
    lessonCount: lessonCountByCourse.get(course.id) ?? 0,
  }));
}

export async function getPublicCoursePreview(courseId: string): Promise<PublicCoursePreview | null> {
  if (isE2ESmokeMode()) {
    if (courseId !== E2E_COURSE.id) return null;
    return {
      course: E2E_COURSE,
      modules: [
        {
          id: E2E_MODULE.id,
          title: E2E_MODULE.title,
          sort_order: E2E_MODULE.sort_order,
          lessons: [{ id: E2E_LESSON.id, title: E2E_LESSON.title, sort_order: 1 }],
        },
      ],
      lessonCount: 1,
    };
  }

  const supabase = getSupabaseAdminClient();
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id,title,description,published,scope,thumbnail_url,instructor,duration_hours,category")
    .eq("id", courseId)
    .eq("published", true)
    .eq("publicly_browseable", true)
    .maybeSingle();

  if (courseError) throw courseError;
  if (!course) return null;

  const { data: modules, error: modulesError } = await supabase
    .from("modules")
    .select("id,title,sort_order,lessons(id,title,sort_order)")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });

  if (modulesError) throw modulesError;

  const previewModules = ((modules ?? []) as Array<{
    id: string;
    title: string;
    sort_order: number;
    lessons: Array<{ id: string; title: string; sort_order: number }> | null;
  }>).map((module) => ({
    ...module,
    lessons: [...(module.lessons ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }));

  return {
    course: {
      id: course.id as string,
      title: course.title as string,
      description: (course.description as string | null) ?? null,
      published: true,
      scope: course.scope as "DIOCESE" | "PARISH",
      thumbnailUrl: (course.thumbnail_url as string | null) ?? null,
      instructor: (course.instructor as string | null) ?? null,
      durationHours: parseDurationHours(course.duration_hours as number | string | null),
      category: (course.category as CourseCategory | null) ?? null,
    },
    modules: previewModules,
    lessonCount: previewModules.reduce((sum, module) => sum + module.lessons.length, 0),
  };
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

export async function getCourseTree(
  courseId: string,
  parishId: string,
): Promise<{ course: VisibleCourse; modules: CourseModule[] } | null> {
  if (isE2ESmokeMode()) {
    if (courseId !== E2E_COURSE.id) return null;
    return {
      course: E2E_COURSE,
      modules: [
        {
          ...E2E_MODULE,
          lessons: [
            {
              id: E2E_LESSON.id,
              title: E2E_LESSON.title,
              sort_order: 1,
              content_type: E2E_LESSON.content_type,
              thumbnail_url: null,
              passing_score: E2E_LESSON.passing_score,
              questions: E2E_QUESTIONS.map((question) => ({ id: question.id })),
            },
          ],
        },
      ],
    };
  }

  const supabase = getSupabaseAdminClient();
  const visibleCourses = await listVisibleCourses(parishId);
  const course = visibleCourses.find((item) => item.id === courseId);

  if (!course) return null;

  // Fetch metadata separately; the visibility RPC returns only the core course fields.
  const { data: courseRow } = await supabase
    .from("courses")
    .select("thumbnail_url,instructor,duration_hours,category")
    .eq("id", courseId)
    .single();
  const metadata = courseRow as {
    thumbnail_url?: string | null;
    instructor?: string | null;
    duration_hours?: number | string | null;
    category?: CourseCategory | null;
  } | null;
  const courseWithMetadata = {
    ...course,
    thumbnailUrl: metadata?.thumbnail_url ?? null,
    instructor: metadata?.instructor ?? null,
    durationHours: parseDurationHours(metadata?.duration_hours),
    category: metadata?.category ?? null,
  };

  const { data: modules, error: modulesError } = await supabase
    .from("modules")
    .select("id,title,sort_order, lessons(id,title,sort_order,content_type,thumbnail_url,passing_score,questions(id))")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });

  if (modulesError) throw modulesError;
  return { course: courseWithMetadata, modules: ((modules ?? []) as CourseModule[]) ?? [] };
}

export interface CourseLesson {
  id: string;
  title: string;
  sort_order: number;
  content_type: "VIDEO" | "DOCUMENT";
  thumbnailUrl: string | null;
  status: "not_started" | "in_progress" | "completed";
  bestScore: number;
}

export interface CourseModuleWithProgress {
  id: string;
  title: string;
  sort_order: number;
  lessons: CourseLesson[];
}

export interface CourseTreeWithProgress {
  course: VisibleCourse;
  modules: CourseModuleWithProgress[];
}

export async function getCourseTreeWithProgress(
  courseId: string,
  parishId: string,
  clerkUserId: string,
): Promise<CourseTreeWithProgress | null> {
  if (isE2ESmokeMode()) {
    if (courseId !== E2E_COURSE.id) return null;
    return {
      course: E2E_COURSE,
      modules: [
        {
          ...E2E_MODULE,
          lessons: [
            {
              id: E2E_LESSON.id,
              title: E2E_LESSON.title,
              sort_order: 1,
              content_type: E2E_LESSON.content_type,
              status: "not_started" as const,
              bestScore: 0,
              thumbnailUrl: null,
            },
          ],
        },
      ],
    };
  }

  const tree = await getCourseTree(courseId, parishId);
  if (!tree) return null;

  const allLessonIds = tree.modules.flatMap((m) => m.lessons.map((l) => l.id));
  if (allLessonIds.length === 0) {
    return {
      course: tree.course,
      modules: tree.modules.map((m) => ({
        ...m,
        lessons: m.lessons.map((l) => ({
          id: l.id,
          title: l.title,
          sort_order: l.sort_order,
          content_type: l.content_type,
          thumbnailUrl: l.thumbnail_url,
          status: "not_started" as const,
          bestScore: 0,
        })),
      })),
    };
  }

  const supabase = getSupabaseAdminClient();

  const { data: progressData } = await supabase
    .from("video_progress")
    .select("lesson_id, completed, percent_watched")
    .eq("parish_id", parishId)
    .eq("clerk_user_id", clerkUserId)
    .in("lesson_id", allLessonIds);

  const progressMap = new Map(
    ((progressData ?? []) as Array<{
      lesson_id: string;
      completed: boolean;
      percent_watched: number;
    }>).map((p) => [p.lesson_id, p]),
  );

  const { data: quizData } = await supabase
    .from("quiz_attempts")
    .select("lesson_id, score")
    .eq("parish_id", parishId)
    .eq("clerk_user_id", clerkUserId)
    .in("lesson_id", allLessonIds);

  const bestScoreMap = new Map<string, number>();
  for (const q of (quizData ?? []) as Array<{ lesson_id: string; score: number }>) {
    const current = bestScoreMap.get(q.lesson_id) ?? 0;
    if (q.score > current) bestScoreMap.set(q.lesson_id, q.score);
  }

  return {
    course: tree.course,
    modules: tree.modules.map((m) => ({
      ...m,
      lessons: m.lessons.map((l) => {
        const progress = progressMap.get(l.id);
        const bestScore = bestScoreMap.get(l.id) ?? 0;
        let status: "not_started" | "in_progress" | "completed";
        if (
          isLessonComplete({
            contentCompleted: progress?.completed ?? false,
            bestScore,
            passingScore: l.passing_score,
            questionCount: l.questions.length,
          })
        ) {
          status = "completed";
        } else if (progress && (progress.completed || progress.percent_watched > 0)) {
          status = "in_progress";
        } else {
          status = "not_started";
        }
        return {
          id: l.id,
          title: l.title,
          sort_order: l.sort_order,
          content_type: l.content_type,
          thumbnailUrl: l.thumbnail_url,
          status,
          bestScore,
        };
      }),
    })),
  };
}
