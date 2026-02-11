import { NextResponse } from "next/server";
import { z } from "zod";

import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const querySchema = z.object({
  parishId: z.string().uuid(),
  courseId: z.string().uuid(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function GET(req: Request) {
  await requireDioceseAdmin();
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    parishId: url.searchParams.get("parishId"),
    courseId: url.searchParams.get("courseId"),
    startDate: url.searchParams.get("startDate") ?? undefined,
    endDate: url.searchParams.get("endDate") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "parishId and courseId are required" }, { status: 400 });
  }

  const { parishId, courseId, startDate, endDate } = parsed.data;
  if (
    (startDate && !isValidDate(startDate)) ||
    (endDate && !isValidDate(endDate)) ||
    (startDate && endDate && startDate > endDate)
  ) {
    return NextResponse.json({ error: "Invalid date range. Use YYYY-MM-DD and ensure startDate <= endDate." }, { status: 400 });
  }

  const hasDateFilter = Boolean(startDate || endDate);
  const startAt = startDate ? `${startDate}T00:00:00.000Z` : "1970-01-01T00:00:00.000Z";
  const endAt = endDate ? `${endDate}T23:59:59.999Z` : "9999-12-31T23:59:59.999Z";
  const supabase = getSupabaseAdminClient();

  let enrollmentQuery = supabase
    .from("enrollments")
    .select("clerk_user_id,created_at")
    .eq("parish_id", parishId)
    .eq("course_id", courseId);
  if (hasDateFilter) {
    enrollmentQuery = enrollmentQuery.gte("created_at", startAt).lte("created_at", endAt);
  }

  const [{ data: modules, error: modulesError }, { data: enrollments, error: enrollmentsError }] = await Promise.all([
    supabase.from("modules").select("id, lessons(id)").eq("course_id", courseId),
    enrollmentQuery,
  ]);

  if (modulesError) return NextResponse.json({ error: modulesError.message }, { status: 400 });
  if (enrollmentsError) return NextResponse.json({ error: enrollmentsError.message }, { status: 400 });

  const lessonIds = ((modules ?? []) as Array<{ lessons?: Array<{ id: string }> }>).flatMap((module) =>
    Array.isArray(module.lessons) ? module.lessons.map((lesson) => lesson.id) : [],
  );

  if (lessonIds.length === 0) {
    return NextResponse.json({ learners: [] });
  }

  const userIds = (enrollments ?? []).map((enrollment) => enrollment.clerk_user_id as string);

  let progressQuery = supabase
    .from("video_progress")
    .select("clerk_user_id,lesson_id,completed")
    .eq("parish_id", parishId)
    .in("lesson_id", lessonIds)
    .in("clerk_user_id", userIds);

  if (hasDateFilter) {
    progressQuery = progressQuery.gte("updated_at", startAt).lte("updated_at", endAt);
  }

  const { data: progress, error: progressError } = await progressQuery;

  if (progressError) return NextResponse.json({ error: progressError.message }, { status: 400 });

  const completedCountByUser = new Map<string, number>();
  (progress ?? []).forEach((row) => {
    if (row.completed) {
      const userId = row.clerk_user_id as string;
      completedCountByUser.set(userId, (completedCountByUser.get(userId) ?? 0) + 1);
    }
  });

  const totalLessons = lessonIds.length;
  const learners = (enrollments ?? []).map((enrollment) => {
    const userId = enrollment.clerk_user_id as string;
    const completedLessons = completedCountByUser.get(userId) ?? 0;
    const progressPercent = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return {
      clerk_user_id: userId,
      enrolled_at: enrollment.created_at,
      completed_lessons: completedLessons,
      total_lessons: totalLessons,
      progress_percent: progressPercent,
    };
  });

  return NextResponse.json({ learners });
}

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

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
