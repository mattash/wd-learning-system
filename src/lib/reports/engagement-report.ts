import { z } from "zod";

import type { getSupabaseAdminClient } from "@/lib/supabase/server";

interface EngagementMetric {
  parish_id: string;
  course_id: string;
  learners_started: number;
  learners_completed: number;
}

interface ModuleRow {
  course_id: string;
  lessons?: Array<{ id: string }> | null;
}

interface EnrollmentRow {
  parish_id: string;
  course_id: string;
}

interface ProgressRow {
  parish_id: string;
  clerk_user_id: string;
  lesson_id: string;
  completed: boolean;
  updated_at: string;
}

interface LookupRow {
  id: string;
  name?: string;
  title?: string;
}

export interface EngagementReportRow {
  parish_id: string;
  course_id: string;
  parish_name: string;
  course_title: string;
  enrollment_count: number;
  learners_started: number;
  learners_completed: number;
  completion_rate: number;
}

export interface EngagementTrendRow {
  period: string;
  learners_started: number;
  learners_completed: number;
  completion_rate: number;
}

export interface EngagementFilters {
  parishId?: string;
  courseId?: string;
  startDate?: string;
  endDate?: string;
}

interface EngagementReportData {
  rows: EngagementReportRow[];
  trends: EngagementTrendRow[];
}

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdminClient>;

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const filtersSchema = z
  .object({
    parishId: z.string().min(1).optional(),
    courseId: z.string().min(1).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.startDate && !isValidDate(value.startDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "startDate must be a valid YYYY-MM-DD date",
        path: ["startDate"],
      });
    }

    if (value.endDate && !isValidDate(value.endDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endDate must be a valid YYYY-MM-DD date",
        path: ["endDate"],
      });
    }

    if (value.startDate && value.endDate && value.startDate > value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "startDate must be before or equal to endDate",
        path: ["startDate"],
      });
    }
  });

export function parseEngagementFilters(searchParams: URLSearchParams) {
  const parsed = filtersSchema.safeParse({
    parishId: searchParams.get("parishId") ?? undefined,
    courseId: searchParams.get("courseId") ?? undefined,
    startDate: searchParams.get("startDate") ?? undefined,
    endDate: searchParams.get("endDate") ?? undefined,
  });

  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid filters" };
  }

  return { ok: true as const, filters: parsed.data };
}

export function hasDateFilters(filters: EngagementFilters) {
  return Boolean(filters.startDate || filters.endDate);
}

export function getDateRangeBounds(filters: EngagementFilters) {
  if (!hasDateFilters(filters)) {
    return null;
  }

  const startAt = filters.startDate
    ? `${filters.startDate}T00:00:00.000Z`
    : "1970-01-01T00:00:00.000Z";
  const endAt = filters.endDate ? `${filters.endDate}T23:59:59.999Z` : "9999-12-31T23:59:59.999Z";

  return { startAt, endAt };
}

export async function loadEngagementReportData(
  supabase: SupabaseAdminClient,
  filters: EngagementFilters,
): Promise<{ data?: EngagementReportData; error?: string }> {
  if (!hasDateFilters(filters)) {
    return loadAllTimeReportData(supabase, filters);
  }

  return loadDateFilteredReportData(supabase, filters);
}

async function loadAllTimeReportData(
  supabase: SupabaseAdminClient,
  filters: EngagementFilters,
): Promise<{ data?: EngagementReportData; error?: string }> {
  const [
    { data: metrics, error: metricsError },
    { data: parishes, error: parishError },
    { data: courses, error: courseError },
    { data: enrollments, error: enrollmentError },
  ] = await Promise.all([
    supabase.rpc("diocese_course_metrics"),
    supabase.from("parishes").select("id,name"),
    supabase.from("courses").select("id,title"),
    supabase.from("enrollments").select("parish_id,course_id"),
  ]);

  const firstError = firstErrorMessage(metricsError, parishError, courseError, enrollmentError);
  if (firstError) {
    return { error: firstError };
  }

  const rows = buildRowsFromMetrics(
    (metrics ?? []) as EngagementMetric[],
    (enrollments ?? []) as EnrollmentRow[],
    (parishes ?? []) as LookupRow[],
    (courses ?? []) as LookupRow[],
    filters,
  );

  return {
    data: {
      rows,
      trends: [],
    },
  };
}

async function loadDateFilteredReportData(
  supabase: SupabaseAdminClient,
  filters: EngagementFilters,
): Promise<{ data?: EngagementReportData; error?: string }> {
  const bounds = getDateRangeBounds(filters);
  if (!bounds) {
    return { data: { rows: [], trends: [] } };
  }

  const [
    { data: modules, error: modulesError },
    { data: parishes, error: parishError },
    { data: courses, error: courseError },
  ] = await Promise.all([
    supabase.from("modules").select("course_id, lessons(id)"),
    supabase.from("parishes").select("id,name"),
    supabase.from("courses").select("id,title"),
  ]);

  const firstLookupError = firstErrorMessage(modulesError, parishError, courseError);
  if (firstLookupError) {
    return { error: firstLookupError };
  }

  let enrollmentQuery = supabase.from("enrollments").select("parish_id,course_id,created_at");
  if (filters.parishId) {
    enrollmentQuery = enrollmentQuery.eq("parish_id", filters.parishId);
  }
  if (filters.courseId) {
    enrollmentQuery = enrollmentQuery.eq("course_id", filters.courseId);
  }
  enrollmentQuery = enrollmentQuery.gte("created_at", bounds.startAt).lte("created_at", bounds.endAt);

  const { data: enrollments, error: enrollmentError } = await enrollmentQuery;
  if (enrollmentError) {
    return { error: enrollmentError.message };
  }

  const courseIdByLessonId = new Map<string, string>();
  ((modules ?? []) as ModuleRow[]).forEach((module) => {
    if (!Array.isArray(module.lessons)) {
      return;
    }

    module.lessons.forEach((lesson) => {
      courseIdByLessonId.set(lesson.id, module.course_id);
    });
  });

  let lessonIds = Array.from(courseIdByLessonId.keys());
  if (filters.courseId) {
    lessonIds = lessonIds.filter((lessonId) => courseIdByLessonId.get(lessonId) === filters.courseId);
  }

  let progressRows: ProgressRow[] = [];
  if (lessonIds.length > 0) {
    let progressQuery = supabase
      .from("video_progress")
      .select("parish_id,clerk_user_id,lesson_id,completed,updated_at")
      .in("lesson_id", lessonIds)
      .gte("updated_at", bounds.startAt)
      .lte("updated_at", bounds.endAt);

    if (filters.parishId) {
      progressQuery = progressQuery.eq("parish_id", filters.parishId);
    }

    const { data, error } = await progressQuery;
    if (error) {
      return { error: error.message };
    }
    progressRows = (data ?? []) as ProgressRow[];
  }

  const parishRows = (parishes ?? []) as Array<{ id: string; name: string | null }>;
  const courseRows = (courses ?? []) as Array<{ id: string; title: string | null }>;
  const parishNameById = new Map<string, string>(parishRows.map((row) => [row.id, row.name ?? row.id]));
  const courseTitleById = new Map<string, string>(courseRows.map((row) => [row.id, row.title ?? row.id]));

  const enrollmentCountByKey = new Map<string, number>();
  ((enrollments ?? []) as EnrollmentRow[]).forEach((row) => {
    const key = `${row.parish_id}:${row.course_id}`;
    enrollmentCountByKey.set(key, (enrollmentCountByKey.get(key) ?? 0) + 1);
  });

  const startedByKey = new Map<string, Set<string>>();
  const completedByKey = new Map<string, Set<string>>();
  const startedByPeriod = new Map<string, Set<string>>();
  const completedByPeriod = new Map<string, Set<string>>();

  progressRows.forEach((row) => {
    const courseId = courseIdByLessonId.get(row.lesson_id);
    if (!courseId) {
      return;
    }

    if (filters.courseId && courseId !== filters.courseId) {
      return;
    }

    const scopeKey = `${row.parish_id}:${courseId}`;
    addSetValue(startedByKey, scopeKey, row.clerk_user_id);
    if (row.completed) {
      addSetValue(completedByKey, scopeKey, row.clerk_user_id);
    }

    if (typeof row.updated_at === "string" && row.updated_at.length >= 7) {
      const period = row.updated_at.slice(0, 7);
      const periodUserKey = `${row.parish_id}:${courseId}:${row.clerk_user_id}`;
      addSetValue(startedByPeriod, period, periodUserKey);
      if (row.completed) {
        addSetValue(completedByPeriod, period, periodUserKey);
      }
    }
  });

  const rowKeys = new Set<string>([
    ...enrollmentCountByKey.keys(),
    ...startedByKey.keys(),
    ...completedByKey.keys(),
  ]);

  const rows = Array.from(rowKeys)
    .map((key) => {
      const [parishId, courseId] = key.split(":");
      const learnersStarted = startedByKey.get(key)?.size ?? 0;
      const learnersCompleted = completedByKey.get(key)?.size ?? 0;
      const completionRate = learnersStarted ? Math.round((learnersCompleted / learnersStarted) * 100) : 0;

      return {
        parish_id: parishId,
        course_id: courseId,
        parish_name: parishNameById.get(parishId) ?? parishId,
        course_title: courseTitleById.get(courseId) ?? courseId,
        enrollment_count: enrollmentCountByKey.get(key) ?? 0,
        learners_started: learnersStarted,
        learners_completed: learnersCompleted,
        completion_rate: completionRate,
      };
    })
    .sort((a, b) => b.learners_started - a.learners_started || a.parish_name.localeCompare(b.parish_name));

  const periodKeys = new Set<string>([...startedByPeriod.keys(), ...completedByPeriod.keys()]);
  const trends = Array.from(periodKeys)
    .sort((a, b) => a.localeCompare(b))
    .map((period) => {
      const learnersStarted = startedByPeriod.get(period)?.size ?? 0;
      const learnersCompleted = completedByPeriod.get(period)?.size ?? 0;
      const completionRate = learnersStarted ? Math.round((learnersCompleted / learnersStarted) * 100) : 0;

      return {
        period,
        learners_started: learnersStarted,
        learners_completed: learnersCompleted,
        completion_rate: completionRate,
      };
    });

  return {
    data: {
      rows,
      trends,
    },
  };
}

function buildRowsFromMetrics(
  metrics: EngagementMetric[],
  enrollments: EnrollmentRow[],
  parishes: LookupRow[],
  courses: LookupRow[],
  filters: EngagementFilters,
) {
  const enrollmentCountByKey = new Map<string, number>();
  enrollments.forEach((row) => {
    const key = `${row.parish_id}:${row.course_id}`;
    enrollmentCountByKey.set(key, (enrollmentCountByKey.get(key) ?? 0) + 1);
  });

  const parishNameById = new Map<string, string>(parishes.map((parish) => [parish.id, parish.name ?? parish.id]));
  const courseTitleById = new Map<string, string>(courses.map((course) => [course.id, course.title ?? course.id]));

  return metrics
    .filter((row) => (filters.parishId ? row.parish_id === filters.parishId : true))
    .filter((row) => (filters.courseId ? row.course_id === filters.courseId : true))
    .map((row) => {
      const key = `${row.parish_id}:${row.course_id}`;
      const completionRate = row.learners_started
        ? Math.round((row.learners_completed / row.learners_started) * 100)
        : 0;

      return {
        ...row,
        parish_name: parishNameById.get(row.parish_id) ?? row.parish_id,
        course_title: courseTitleById.get(row.course_id) ?? row.course_id,
        enrollment_count: enrollmentCountByKey.get(key) ?? 0,
        completion_rate: completionRate,
      };
    })
    .sort((a, b) => b.learners_started - a.learners_started);
}

function addSetValue(map: Map<string, Set<string>>, key: string, value: string) {
  if (!map.has(key)) {
    map.set(key, new Set());
  }
  map.get(key)?.add(value);
}

function firstErrorMessage(...errors: Array<{ message: string } | null | undefined>) {
  return errors.find((error) => Boolean(error?.message))?.message;
}

function isValidDate(value: string) {
  if (!dateRegex.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  return (
    utcDate.getUTCFullYear() === year &&
    utcDate.getUTCMonth() === month - 1 &&
    utcDate.getUTCDate() === day
  );
}
