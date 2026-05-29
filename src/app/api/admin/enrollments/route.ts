import { NextResponse } from "next/server";
import { z } from "zod";

import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { notifyEnrollmentConfirmed } from "@/lib/parish-communications/notifications";

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

async function parseJsonBody<T>(req: Request, schema: z.ZodSchema<T>) {
  try {
    return schema.safeParse(await req.json());
  } catch {
    return { success: false } as const;
  }
}

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
  const parsedPayload = await parseJsonBody(req, createEnrollmentSchema);

  if (!parsedPayload.success) {
    return NextResponse.json({ error: "Invalid enrollment request payload" }, { status: 400 });
  }

  const payload = parsedPayload.data;
  const supabase = getSupabaseAdminClient();

  const existingEnrollmentQuery = await supabase
    .from("enrollments")
    .select("id")
    .eq("parish_id", payload.parishId)
    .eq("clerk_user_id", payload.clerkUserId)
    .eq("course_id", payload.courseId)
    .maybeSingle();

  if (existingEnrollmentQuery.error) {
    return NextResponse.json({ error: existingEnrollmentQuery.error.message }, { status: 400 });
  }

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

  if (!existingEnrollmentQuery.data) {
    // Send enrollment confirmation email (non-blocking)
    notifyEnrollmentConfirmed({
      clerkUserId: payload.clerkUserId,
      parishId: payload.parishId,
      courseId: payload.courseId,
    }).catch((err) => console.error("[notifications] diocese enrollment confirmed email failed:", err));
  }

  return NextResponse.json({ enrollment: data }, { status: 201 });
}

export async function DELETE(req: Request) {
  await requireDioceseAdmin();
  const parsedPayload = await parseJsonBody(req, deleteEnrollmentSchema);

  if (!parsedPayload.success) {
    return NextResponse.json({ error: "Invalid enrollment request payload" }, { status: 400 });
  }

  const payload = parsedPayload.data;
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
