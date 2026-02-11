import { NextResponse } from "next/server";
import { z } from "zod";

import { requireParishRole } from "@/lib/authz";
import { recordAdminAuditLog } from "@/lib/audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const cadenceSchema = z.enum(["weekly", "biweekly", "monthly", "custom"]);

const createCohortSchema = z.object({
  name: z.string().min(1),
  facilitatorClerkUserId: z.string().min(1).nullable().optional(),
  cadence: cadenceSchema.default("weekly"),
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

export async function GET() {
  const { parishId, role, clerkUserId } = await requireParishRole("instructor");
  const supabase = getSupabaseAdminClient();

  let query = supabase
    .from("cohorts")
    .select("id,name,facilitator_clerk_user_id,cadence,next_session_at,created_at,updated_at")
    .eq("parish_id", parishId)
    .order("created_at", { ascending: false });

  if (role === "instructor") {
    query = query.eq("facilitator_clerk_user_id", clerkUserId);
  }

  const { data, error } = await query.limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ cohorts: data ?? [] });
}

export async function POST(req: Request) {
  const { clerkUserId: actorUserId, parishId } = await requireParishRole("parish_admin");
  const payload = createCohortSchema.parse(await req.json());
  const supabase = getSupabaseAdminClient();

  if (payload.facilitatorClerkUserId) {
    const facilitatorValidation = await validateFacilitator(parishId, payload.facilitatorClerkUserId);
    if (facilitatorValidation.error) {
      return NextResponse.json({ error: facilitatorValidation.error }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from("cohorts")
    .insert({
      parish_id: parishId,
      name: payload.name,
      facilitator_clerk_user_id: payload.facilitatorClerkUserId ?? null,
      cadence: payload.cadence,
      next_session_at: payload.nextSessionAt ?? null,
    })
    .select("id,name,facilitator_clerk_user_id,cadence,next_session_at,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await recordAdminAuditLog({
    actorClerkUserId: actorUserId,
    action: "parish.cohort_created",
    resourceType: "cohort",
    resourceId: data.id as string,
    details: {
      parish_id: parishId,
      name: payload.name,
      facilitator_clerk_user_id: payload.facilitatorClerkUserId ?? null,
      cadence: payload.cadence,
      next_session_at: payload.nextSessionAt ?? null,
    },
  });

  return NextResponse.json({ cohort: data }, { status: 201 });
}
