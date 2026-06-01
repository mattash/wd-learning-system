import { E2E_COURSE, E2E_LESSON } from "@/lib/e2e-fixtures";
import { isE2ESmokeMode } from "@/lib/e2e-mode";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export interface DashboardCourseProgress {
  courseId: string;
  courseTitle: string;
  courseDescription: string | null;
  thumbnailUrl: string | null;
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
  lastLessonId: string | null;
  lastLessonTitle: string | null;
  resumeLessonId: string | null;
  resumeLessonTitle: string | null;
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
          thumbnailUrl: "/globe.svg",
          totalLessons: 2,
          completedLessons: 0,
          progressPercent: 0,
          lastLessonId: null,
          lastLessonTitle: null,
          resumeLessonId: E2E_LESSON.id,
          resumeLessonTitle: E2E_LESSON.title,
          lastPositionSeconds: 0,
          lastActivityAt: null,
        },
      ],
      recentActivity: [],
    };
  }

  const supabase = getSupabaseAdminClient();

  // Get visible courses the learner is enrolled in (respects publish/parish visibility)
  const { data: visibleCourses, error: visibleCoursesError } = await supabase.rpc(
    "get_visible_courses",
    { p_parish_id: parishId },
  );

  if (visibleCoursesError) throw visibleCoursesError;

  const visibleCourseIds = new Set(
    ((visibleCourses ?? []) as Array<{ id: string }>).map((c) => c.id),
  );

  // Get enrolled courses, filtered to visible
  const { data: enrollments, error: enrollError } = await supabase
    .from("enrollments")
    .select("course_id, courses(id, title, description, thumbnail_url)")
    .eq("parish_id", parishId)
    .eq("clerk_user_id", clerkUserId);

  if (enrollError) throw enrollError;

  const enrolledCourses = (
    (enrollments ?? []) as Array<{
      course_id: string;
      courses: { id: string; title: string; description: string | null; thumbnail_url: string | null };
    }>
  )
    .filter((e) => visibleCourseIds.has(e.course_id))
    .map((e) => ({
      courseId: e.course_id,
      title: e.courses.title,
      description: e.courses.description,
      thumbnailUrl: e.courses.thumbnail_url,
    }));

  if (enrolledCourses.length === 0) {
    return { progress: [], recentActivity: [] };
  }

  // Get all lessons for all enrolled courses
  const courseIds = enrolledCourses.map((c) => c.courseId);
  const { data: modulesData, error: modError } = await supabase
    .from("modules")
    .select("id, course_id, lessons(id, title, sort_order)")
    .in("course_id", courseIds)
    .order("sort_order", { ascending: true });

  if (modError) throw modError;

  // Flatten lessons per course in curriculum order
  const lessonsByCourse = new Map<string, Array<{ id: string; title: string }>>();
  for (const mod of (modulesData ?? []) as Array<{
    course_id: string;
    lessons: Array<{ id: string; title: string; sort_order: number }>;
  }>) {
    if (!lessonsByCourse.has(mod.course_id)) {
      lessonsByCourse.set(mod.course_id, []);
    }
    const sortedLessons = [...(mod.lessons ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    for (const lesson of sortedLessons) {
      lessonsByCourse.get(mod.course_id)!.push({ id: lesson.id, title: lesson.title });
    }
  }

  // Build progress for each enrolled course
  const progress: DashboardCourseProgress[] = enrolledCourses.map((course) => {
    const lessons = lessonsByCourse.get(course.courseId) ?? [];
    return {
      courseId: course.courseId,
      courseTitle: course.title,
      courseDescription: course.description,
      thumbnailUrl: course.thumbnailUrl,
      totalLessons: lessons.length,
      completedLessons: 0,
      progressPercent: 0,
      lastLessonId: null,
      lastLessonTitle: null,
      resumeLessonId: null,
      resumeLessonTitle: null,
      lastPositionSeconds: 0,
      lastActivityAt: null,
    };
  });

  // Get all lesson IDs — if empty, skip progress/activity queries
  const allLessonIds = Array.from(lessonsByCourse.values()).flatMap((lessons) =>
    lessons.map((l) => l.id),
  );

  if (allLessonIds.length === 0) {
    return { progress, recentActivity: [] };
  }

  // Get video progress for all lessons
  const { data: progressData, error: progError } = await supabase
    .from("video_progress")
    .select("lesson_id, completed, last_position_seconds, updated_at")
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
    }>).map((p) => [p.lesson_id, p]),
  );

  // Populate course progress from video_progress data
  for (const course of progress) {
    const lessons = lessonsByCourse.get(course.courseId) ?? [];

    for (const lesson of lessons) {
      const p = progressByLesson.get(lesson.id);
      if (p) {
        if (p.completed) course.completedLessons++;
        if (!course.lastActivityAt || p.updated_at > course.lastActivityAt) {
          course.lastActivityAt = p.updated_at;
          course.lastLessonId = p.lesson_id;
          course.lastLessonTitle = lesson.title;
          course.lastPositionSeconds = p.last_position_seconds;
        }
      }
    }

    for (const lesson of lessons) {
      const p = progressByLesson.get(lesson.id);
      if (!p?.completed) {
        course.resumeLessonId = lesson.id;
        course.resumeLessonTitle = lesson.title;
        break;
      }
    }

    course.progressPercent =
      course.totalLessons > 0
        ? Math.round((course.completedLessons / course.totalLessons) * 100)
        : 0;
  }

  // Recent activity (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = sevenDaysAgo.toISOString();

  // Get recent quiz attempts (constrained to enrolled course lessons)
  const { data: quizData, error: quizError } = await supabase
    .from("quiz_attempts")
    .select("lesson_id, score, created_at, lessons!inner(title, modules!inner(course_id, courses!inner(title)))")
    .eq("parish_id", parishId)
    .eq("clerk_user_id", clerkUserId)
    .in("lesson_id", allLessonIds)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(15);

  if (quizError) throw quizError;

  // Build recent activity feed from quiz attempts
  const recentActivity: LessonActivity[] = (
    (quizData ?? []) as Array<{
      lesson_id: string;
      score: number;
      created_at: string;
      lessons: { title: string; modules: { course_id: string; courses: { title: string } } };
    }>
  ).map((q) => ({
    lessonId: q.lesson_id,
    lessonTitle: q.lessons.title,
    courseId: q.lessons.modules.course_id,
    courseTitle: q.lessons.modules.courses.title,
    score: q.score,
    completed: true,
    activityAt: q.created_at,
  }));

  // Also include recent video completions (same time cutoff)
  const videoActivity: LessonActivity[] = (
    (progressData ?? []) as Array<{
      lesson_id: string;
      completed: boolean;
      last_position_seconds: number;
      updated_at: string;
    }>
  )
    .filter(
      (p) =>
        p.completed &&
        new Date(p.updated_at) >= new Date(cutoff),
    )
    .map((p) => {
      const lesson = Array.from(lessonsByCourse.values())
        .flat()
        .find((l) => l.id === p.lesson_id);
      const courseId =
        Array.from(lessonsByCourse.entries()).find(([, lessons]) =>
          lessons.some((l) => l.id === p.lesson_id),
        )?.[0] ?? "";
      const courseTitle = enrolledCourses.find((c) => c.courseId === courseId)?.title ?? "";

      return {
        lessonId: p.lesson_id,
        lessonTitle: lesson?.title ?? "Unknown lesson",
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

  return { progress, recentActivity: allActivities };
}
