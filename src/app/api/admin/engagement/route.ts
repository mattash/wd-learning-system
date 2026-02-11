import { NextResponse } from "next/server";

import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET() {
  await requireDioceseAdmin();
  const supabase = getSupabaseAdminClient();

  const [{ data: rows, error: rowsError }, { data: parishes, error: parishesError }, { data: courses, error: coursesError }] =
    await Promise.all([
      supabase.rpc("diocese_course_metrics"),
      supabase.from("parishes").select("id,name"),
      supabase.from("courses").select("id,title"),
    ]);

  if (rowsError) return NextResponse.json({ error: rowsError.message }, { status: 400 });
  if (parishesError) return NextResponse.json({ error: parishesError.message }, { status: 400 });
  if (coursesError) return NextResponse.json({ error: coursesError.message }, { status: 400 });

  const parishNameById = new Map((parishes ?? []).map((parish) => [parish.id as string, parish.name as string]));
  const courseTitleById = new Map((courses ?? []).map((course) => [course.id as string, course.title as string]));

  const engagement = ((rows ?? []) as Array<{
    parish_id: string;
    course_id: string;
    learners_started: number;
    learners_completed: number;
  }>).map((row) => ({
    ...row,
    parish_name: parishNameById.get(row.parish_id) ?? row.parish_id,
    course_title: courseTitleById.get(row.course_id) ?? row.course_id,
  }));

  return NextResponse.json({ engagement });
}
