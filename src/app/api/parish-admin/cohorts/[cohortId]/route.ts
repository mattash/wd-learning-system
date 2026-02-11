import { NextResponse } from "next/server";
import { z } from "zod";

import { requireParishRole } from "@/lib/authz";
import { recordAdminAuditLog } from "@/lib/audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  cohortId: z.string().uuid(),
});

const cadenceSchema = z.enum(["weekly", "biweekly", "monthly", "custom"]);

const updateCohortSchema = z.object({
  name: z.string().min(1),
  facilitatorClerkUserId: z.string().min(1).nullable().optional(),
  cadence: cadenceSchema,
  nextSessionAt: z.string().datetime().nullable().optional(),
});

async function validateFacilitator(parishId: string, facilitatorClerkUserId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("parish_memberships")
    .select("role")
    .eq("parish_id", parishId)
    .eq("clerk_user_id", facilitatorClerkUserId)
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!data || (data.role !== "parish_admin" && data.role !== "instructor")) {
    return { error: "Facilitator must be a parish admin or instructor in this parish." };
  }

  return { error: null as string | null };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ cohortId: string }> }) {
  const { clerkUserId: actorUserId, parishId, role } = await requireParishRole("instructor");
  const { cohortId } = paramsSchema.parse(await ctx.params);
  const payload = updateCohortSchema.parse(await req.json());
  const supabase = getSupabaseAdminClient();

  const { data: existingCohort, error: existingCohortError } = await supabase
    .from("cohorts")
    .select("id,facilitator_clerk_user_id")
    .eq("id", cohortId)
    .eq("parish_id", parishId)
    .maybeSingle();

  if (existingCohortError) {
    return NextResponse.json({ error: existingCohortError.message }, { status: 400 });
  }

  if (!existingCohort) {
    return NextResponse.json({ error: "Cohort not found." }, { status: 404 });
  }

  if (role === "instructor" && existingCohort.facilitator_clerk_user_id !== actorUserId) {
    return NextResponse.json({ error: "You can only manage cohorts assigned to you." }, { status: 403 });
  }

  if (role === "parish_admin" && payload.facilitatorClerkUserId) {
    const facilitatorValidation = await validateFacilitator(parishId, payload.facilitatorClerkUserId);
    if (facilitatorValidation.error) {
      return NextResponse.json({ error: facilitatorValidation.error }, { status: 400 });
    }
  }

  if (
    role === "instructor" &&
    payload.facilitatorClerkUserId &&
    payload.facilitatorClerkUserId !== existingCohort.facilitator_clerk_user_id
  ) {
    return NextResponse.json({ error: "Only parish admins can reassign facilitators." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("cohorts")
    .update({
      name: payload.name,
      facilitator_clerk_user_id:
        role === "parish_admin"
          ? (payload.facilitatorClerkUserId ?? null)
          : existingCohort.facilitator_clerk_user_id,
      cadence: payload.cadence,
      next_session_at: payload.nextSessionAt ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cohortId)
    .eq("parish_id", parishId)
    .select("id,name,facilitator_clerk_user_id,cadence,next_session_at,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await recordAdminAuditLog({
    actorClerkUserId: actorUserId,
    action: "parish.cohort_updated",
    resourceType: "cohort",
    resourceId: cohortId,
    details: {
      parish_id: parishId,
      name: payload.name,
      facilitator_clerk_user_id: payload.facilitatorClerkUserId ?? null,
      cadence: payload.cadence,
      next_session_at: payload.nextSessionAt ?? null,
    },
  });

  return NextResponse.json({ cohort: data });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ cohortId: string }> }) {
  const { clerkUserId: actorUserId, parishId } = await requireParishRole("parish_admin");
  const { cohortId } = paramsSchema.parse(await ctx.params);
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase.from("cohorts").delete().eq("id", cohortId).eq("parish_id", parishId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await recordAdminAuditLog({
    actorClerkUserId: actorUserId,
    action: "parish.cohort_deleted",
    resourceType: "cohort",
    resourceId: cohortId,
    details: {
      parish_id: parishId,
    },
  });

  return NextResponse.json({ ok: true });
}
