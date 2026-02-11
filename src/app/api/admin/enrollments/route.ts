import { NextResponse } from "next/server";
import { z } from "zod";

import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const createEnrollmentSchema = z.object({
  parishId: z.string().uuid(),
  clerkUserId: z.string().min(1),
  courseId: z.string().uuid(),
});

const deleteEnrollmentSchema = z.object({
  parishId: z.string().uuid(),
  clerkUserId: z.string().min(1),
  courseId: z.string().uuid(),
});

export async function GET(req: Request) {
  await requireDioceseAdmin();
  const url = new URL(req.url);
  const parishId = url.searchParams.get("parishId");
  const courseId = url.searchParams.get("courseId");

  const supabase = getSupabaseAdminClient();

  let query = supabase
    .from("enrollments")
    .select("id,parish_id,clerk_user_id,course_id,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (parishId) query = query.eq("parish_id", parishId);
  if (courseId) query = query.eq("course_id", courseId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ enrollments: data ?? [] });
}

export async function POST(req: Request) {
  await requireDioceseAdmin();
  const payload = createEnrollmentSchema.parse(await req.json());
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("enrollments")
    .upsert(
      {
        parish_id: payload.parishId,
        clerk_user_id: payload.clerkUserId,
        course_id: payload.courseId,
      },
      { onConflict: "parish_id,clerk_user_id,course_id" },
    )
    .select("id,parish_id,clerk_user_id,course_id,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ enrollment: data }, { status: 201 });
}

export async function DELETE(req: Request) {
  await requireDioceseAdmin();
  const payload = deleteEnrollmentSchema.parse(await req.json());
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase
    .from("enrollments")
    .delete()
    .eq("parish_id", payload.parishId)
    .eq("clerk_user_id", payload.clerkUserId)
    .eq("course_id", payload.courseId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
