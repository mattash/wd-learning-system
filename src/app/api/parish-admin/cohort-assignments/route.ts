import { NextResponse } from "next/server";
import { z } from "zod";

import { requireParishRole } from "@/lib/authz";
import { recordAdminAuditLog } from "@/lib/audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const updateAssignmentSchema = z.object({
  enrollmentId: z.string().uuid(),
  cohortId: z.string().uuid().nullable(),
});

export async function PATCH(req: Request) {
  const { clerkUserId: actorUserId, parishId } = await requireParishRole("parish_admin");
  const payload = updateAssignmentSchema.parse(await req.json());
  const supabase = getSupabaseAdminClient();

  if (payload.cohortId) {
    const { data: cohort, error: cohortError } = await supabase
      .from("cohorts")
      .select("id")
      .eq("id", payload.cohortId)
      .eq("parish_id", parishId)
      .maybeSingle();

    if (cohortError) {
      return NextResponse.json({ error: cohortError.message }, { status: 400 });
    }

    if (!cohort) {
      return NextResponse.json({ error: "Cohort does not belong to this parish." }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from("enrollments")
    .update({ cohort_id: payload.cohortId })
    .eq("id", payload.enrollmentId)
    .eq("parish_id", parishId)
    .select("id,clerk_user_id,course_id,cohort_id,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await recordAdminAuditLog({
    actorClerkUserId: actorUserId,
    action: "parish.enrollment_cohort_updated",
    resourceType: "enrollment",
    resourceId: payload.enrollmentId,
    details: {
      parish_id: parishId,
      cohort_id: payload.cohortId,
    },
  });

  return NextResponse.json({ enrollment: data });
}
