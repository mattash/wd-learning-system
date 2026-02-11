import { NextResponse } from "next/server";
import { z } from "zod";

import { requireParishRole } from "@/lib/authz";
import { recordAdminAuditLog } from "@/lib/audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const createEnrollmentSchema = z.object({
  clerkUserId: z.string().min(1),
  courseId: z.string().uuid(),
});

const deleteEnrollmentSchema = createEnrollmentSchema;

export async function GET(req: Request) {
  const { parishId, role, clerkUserId } = await requireParishRole("instructor");
  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");

  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("enrollments")
    .select("id,clerk_user_id,course_id,cohort_id,created_at")
    .eq("parish_id", parishId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (role === "instructor") {
    const { data: cohorts, error: cohortsError } = await supabase
      .from("cohorts")
      .select("id")
      .eq("parish_id", parishId)
      .eq("facilitator_clerk_user_id", clerkUserId);
    if (cohortsError) {
      return NextResponse.json({ error: cohortsError.message }, { status: 400 });
    }

    const cohortIds = ((cohorts ?? []) as Array<{ id: string }>).map((cohort) => cohort.id);
    if (cohortIds.length === 0) {
      return NextResponse.json({ enrollments: [] });
    }
    query = query.in("cohort_id", cohortIds);
  }

  if (courseId) {
    query = query.eq("course_id", courseId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ enrollments: data ?? [] });
}

export async function POST(req: Request) {
  const { clerkUserId: actorUserId, parishId } = await requireParishRole("parish_admin");
  const payload = createEnrollmentSchema.parse(await req.json());
  const supabase = getSupabaseAdminClient();

  const { data: membership, error: membershipError } = await supabase
    .from("parish_memberships")
    .select("clerk_user_id")
    .eq("parish_id", parishId)
    .eq("clerk_user_id", payload.clerkUserId)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 400 });
  }

  if (!membership) {
    return NextResponse.json({ error: "Learner must belong to this parish before enrollment." }, { status: 400 });
  }

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id,scope,published")
    .eq("id", payload.courseId)
    .maybeSingle();

  if (courseError) {
    return NextResponse.json({ error: courseError.message }, { status: 400 });
  }

  if (!course || course.published !== true) {
    return NextResponse.json({ error: "Selected course is not available for enrollment." }, { status: 400 });
  }

  if (course.scope === "PARISH") {
    const { data: adoption, error: adoptionError } = await supabase
      .from("course_parishes")
      .select("course_id")
      .eq("course_id", payload.courseId)
      .eq("parish_id", parishId)
      .maybeSingle();

    if (adoptionError) {
      return NextResponse.json({ error: adoptionError.message }, { status: 400 });
    }

    if (!adoption) {
      return NextResponse.json({ error: "Adopt this parish-scoped course before enrolling learners." }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from("enrollments")
    .upsert(
      {
        parish_id: parishId,
        clerk_user_id: payload.clerkUserId,
        course_id: payload.courseId,
      },
      { onConflict: "parish_id,clerk_user_id,course_id" },
    )
    .select("id,clerk_user_id,course_id,cohort_id,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await recordAdminAuditLog({
    actorClerkUserId: actorUserId,
    action: "parish.enrollment_saved",
    resourceType: "enrollment",
    resourceId: data.id as string,
    details: {
      parish_id: parishId,
      course_id: payload.courseId,
      clerk_user_id: payload.clerkUserId,
    },
  });

  return NextResponse.json({ enrollment: data }, { status: 201 });
}

export async function DELETE(req: Request) {
  const { clerkUserId: actorUserId, parishId } = await requireParishRole("parish_admin");
  const payload = deleteEnrollmentSchema.parse(await req.json());
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase
    .from("enrollments")
    .delete()
    .eq("parish_id", parishId)
    .eq("clerk_user_id", payload.clerkUserId)
    .eq("course_id", payload.courseId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await recordAdminAuditLog({
    actorClerkUserId: actorUserId,
    action: "parish.enrollment_removed",
    resourceType: "enrollment",
    resourceId: null,
    details: {
      parish_id: parishId,
      course_id: payload.courseId,
      clerk_user_id: payload.clerkUserId,
    },
  });

  return NextResponse.json({ ok: true });
}
