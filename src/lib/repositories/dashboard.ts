import { E2E_COURSE } from "@/lib/e2e-fixtures";
import { isE2ESmokeMode } from "@/lib/e2e-mode";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export interface DashboardCourseProgress {
  courseId: string;
  courseTitle: string;
  courseDescription: string | null;
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
  lastLessonId: string | null;
  lastLessonTitle: string | null;
  lastPositionSeconds: number;
  lastActivityAt: string | null;
}

export interface LessonActivity {
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
  score: number | null;
  completed: boolean;
  activityAt: string;
}

export interface StudentDashboardData {
  progress: DashboardCourseProgress[];
  recentActivity: LessonActivity[];
}

export async function getStudentDashboardData(
  parishId: string,
  clerkUserId: string,
): Promise<StudentDashboardData> {
  if (isE2ESmokeMode()) {
    return {
      progress: [
        {
          courseId: E2E_COURSE.id,
          courseTitle: E2E_COURSE.title,
          courseDescription: E2E_COURSE.description,
          totalLessons: 2,
          completedLessons: 0,
          progressPercent: 0,
          lastLessonId: null,
          lastLessonTitle: null,
          lastPositionSeconds: 0,
          lastActivityAt: null,
        },
      ],
      recentActivity: [],
    };
  }

  const supabase = getSupabaseAdminClient();

  // Get enrolled courses
  const { data: enrollments, error: enrollError } = await supabase
    .from("enrollments")
    .select("course_id, courses(id, title, description)")
    .eq("parish_id", parishId)
    .eq("clerk_user_id", clerkUserId);

  if (enrollError) throw enrollError;

  if (!enrollments || enrollments.length === 0) {
    return { progress: [], recentActivity: [] };
  }

  const enrolledCourses = enrollments.map((e) => ({
    courseId: (e as { course_id: string; courses: { id: string; title: string; description: string | null } }).course_id,
    title: (e as { courses: { title: string } }).courses.title,
    description: (e as { courses: { description: string | null } }).courses.description,
  }));

  // Get all lessons for all enrolled courses
  const courseIds = enrolledCourses.map((c) => c.courseId);
  const { data: modulesData, error: modError } = await supabase
    .from("modules")
    .select("id, course_id, lessons(id, title)")
    .in("course_id", courseIds)
    .order("sort_order", { ascending: true });

  if (modError) throw modError;

  // Flatten lessons per course
  const lessonsByCourse = new Map<string, Array<{ id: string; title: string }>>();
  for (const mod of (modulesData ?? []) as Array<{
    course_id: string;
    lessons: Array<{ id: string; title: string }>;
  }>) {
    if (!lessonsByCourse.has(mod.course_id)) {
      lessonsByCourse.set(mod.course_id, []);
    }
    for (const lesson of mod.lessons ?? []) {
      lessonsByCourse.get(mod.course_id)!.push(lesson);
    }
  }

  // Get all lesson IDs
  const allLessonIds = Array.from(lessonsByCourse.values()).flatMap((lessons) =>
    lessons.map((l) => l.id),
  );

  // Get video progress for all lessons
  const { data: progressData, error: progError } = await supabase
    .from("video_progress")
    .select("lesson_id, completed, last_position_seconds, updated_at, lessons(title)")
    .eq("parish_id", parishId)
    .eq("clerk_user_id", clerkUserId)
    .in("lesson_id", allLessonIds);

  if (progError) throw progError;

  // Build progress map
  const progressByLesson = new Map(
    ((progressData ?? []) as Array<{
      lesson_id: string;
      completed: boolean;
      last_position_seconds: number;
      updated_at: string;
      lessons: { title: string };
    }>).map((p) => [p.lesson_id, p]),
  );

  // Get recent quiz attempts (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: quizData, error: quizError } = await supabase
    .from("quiz_attempts")
    .select("lesson_id, score, created_at, lessons(title), modules!inner(course_id, courses!inner(title))")
    .eq("parish_id", parishId)
    .eq("clerk_user_id", clerkUserId)
    .gte("created_at", sevenDaysAgo.toISOString())
    .order("created_at", { ascending: false })
    .limit(10);

  if (quizError) throw quizError;

  // Build recent activity feed
  const recentActivity: LessonActivity[] = (
    (quizData ?? []) as Array<{
      lesson_id: string;
      score: number;
      created_at: string;
      lessons: { title: string };
      modules: { course_id: string; courses: { title: string } };
    }>
  ).map((q) => ({
    lessonId: q.lesson_id,
    lessonTitle: q.lessons.title,
    courseId: q.modules.course_id,
    courseTitle: q.modules.courses.title,
    score: q.score,
    completed: true,
    activityAt: q.created_at,
  }));

  // Also include completed video lessons in activity
  const videoActivity: LessonActivity[] = (
    (progressData ?? []) as Array<{
      lesson_id: string;
      completed: boolean;
      last_position_seconds: number;
      updated_at: string;
      lessons: { title: string };
    }>
  )
    .filter((p) => p.completed)
    .map((p) => {
      const lesson = allLessonIds.includes(p.lesson_id)
        ? Array.from(lessonsByCourse.values())
            .flat()
            .find((l) => l.id === p.lesson_id)
        : undefined;
      const courseId =
        Array.from(lessonsByCourse.entries()).find(([, lessons]) =>
          lessons.some((l) => l.id === p.lesson_id),
        )?.[0] ?? "";
      const courseTitle = enrolledCourses.find((c) => c.courseId === courseId)?.title ?? "";

      return {
        lessonId: p.lesson_id,
        lessonTitle: lesson?.title ?? p.lessons?.title ?? "Unknown lesson",
        courseId,
        courseTitle,
        score: null,
        completed: true,
        activityAt: p.updated_at,
      };
    });

  // Merge and deduplicate, sort by most recent
  const seenActivities = new Set<string>();
  const allActivities = [...recentActivity, ...videoActivity]
    .filter((a) => {
      const key = `${a.lessonId}-${a.activityAt}`;
      if (seenActivities.has(key)) return false;
      seenActivities.add(key);
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.activityAt).getTime() - new Date(a.activityAt).getTime(),
    )
    .slice(0, 15);

  // Build course progress summaries
  const progress: DashboardCourseProgress[] = enrolledCourses.map((course) => {
    const lessons = lessonsByCourse.get(course.courseId) ?? [];
    const totalLessons = lessons.length;

    let completedLessons = 0;
    let lastActivityAt: string | null = null;
    let lastLessonId: string | null = null;
    let lastLessonTitle: string | null = null;
    let lastPositionSeconds = 0;

    for (const lesson of lessons) {
      const p = progressByLesson.get(lesson.id);
      if (p) {
        if (p.completed) completedLessons++;
        if (!lastActivityAt || p.updated_at > lastActivityAt) {
          lastActivityAt = p.updated_at;
          lastLessonId = p.lesson_id;
          lastLessonTitle = lesson.title;
          lastPositionSeconds = p.last_position_seconds;
        }
      }
    }

    return {
      courseId: course.courseId,
      courseTitle: course.title,
      courseDescription: course.description,
      totalLessons,
      completedLessons,
      progressPercent:
        totalLessons > 0
          ? Math.round((completedLessons / totalLessons) * 100)
          : 0,
      lastLessonId,
      lastLessonTitle,
      lastPositionSeconds,
      lastActivityAt,
    };
  });

  return { progress, recentActivity: allActivities };
}
