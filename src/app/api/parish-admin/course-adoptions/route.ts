import { NextResponse } from "next/server";
import { z } from "zod";

import { requireParishRole } from "@/lib/authz";
import { recordAdminAuditLog } from "@/lib/audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const courseAdoptionSchema = z.object({
  courseId: z.string().uuid(),
});

export async function POST(req: Request) {
  const { clerkUserId, parishId } = await requireParishRole("parish_admin");
  let rawPayload: unknown;

  try {
    rawPayload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid course adoption request payload" }, { status: 400 });
  }

  const parsedPayload = courseAdoptionSchema.safeParse(rawPayload);
  if (!parsedPayload.success) {
    return NextResponse.json({ error: "Invalid course adoption request payload" }, { status: 400 });
  }

  const payload = parsedPayload.data;
  const supabase = getSupabaseAdminClient();

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id,scope,published")
    .eq("id", payload.courseId)
    .maybeSingle();

  if (courseError) {
    return NextResponse.json({ error: courseError.message }, { status: 400 });
  }

  if (!course || course.scope !== "PARISH" || course.published !== true) {
    return NextResponse.json(
      { error: "Only published parish-scoped courses can be adopted." },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("course_parishes").upsert(
    {
      parish_id: parishId,
      course_id: payload.courseId,
    },
    { onConflict: "course_id,parish_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await recordAdminAuditLog({
    actorClerkUserId: clerkUserId,
    action: "parish.course_adopted",
    resourceType: "course_parish",
    resourceId: payload.courseId,
    details: { parish_id: parishId },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: Request) {
  const { clerkUserId, parishId } = await requireParishRole("parish_admin");
  let rawPayload: unknown;

  try {
    rawPayload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid course adoption request payload" }, { status: 400 });
  }

  const parsedPayload = courseAdoptionSchema.safeParse(rawPayload);
  if (!parsedPayload.success) {
    return NextResponse.json({ error: "Invalid course adoption request payload" }, { status: 400 });
  }

  const payload = parsedPayload.data;
  const supabase = getSupabaseAdminClient();

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id,scope")
    .eq("id", payload.courseId)
    .maybeSingle();

  if (courseError) {
    return NextResponse.json({ error: courseError.message }, { status: 400 });
  }

  if (!course || course.scope !== "PARISH") {
    return NextResponse.json({ error: "Only parish-scoped adoptions can be removed." }, { status: 400 });
  }

  const { data: result, error: rpcError } = await supabase.rpc("remove_course_adoption", {
    p_parish_id: parishId,
    p_course_id: payload.courseId,
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 400 });
  }

  const rpcResult = result as { error?: string; ok?: boolean; code?: string } | null;

  if (rpcResult?.error) {
    const status = rpcResult.code === "ENROLLMENTS_EXIST" ? 409 : 400;
    return NextResponse.json({ error: rpcResult.error }, { status });
  }

  await recordAdminAuditLog({
    actorClerkUserId: clerkUserId,
    action: "parish.course_adoption_removed",
    resourceType: "course_parish",
    resourceId: payload.courseId,
    details: { parish_id: parishId },
  });

  return NextResponse.json({ ok: true });
}
