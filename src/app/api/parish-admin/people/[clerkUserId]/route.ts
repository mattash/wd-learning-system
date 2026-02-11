import { NextResponse } from "next/server";
import { z } from "zod";

import { requireParishRole } from "@/lib/authz";
import { recordAdminAuditLog } from "@/lib/audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  clerkUserId: z.string().min(1),
});

const updateRoleSchema = z.object({
  role: z.enum(["parish_admin", "instructor", "student"]),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ clerkUserId: string }> }) {
  const { clerkUserId: actorUserId, parishId } = await requireParishRole("parish_admin");
  const { clerkUserId } = paramsSchema.parse(await ctx.params);
  const payload = updateRoleSchema.parse(await req.json());

  if (clerkUserId === actorUserId) {
    return NextResponse.json({ error: "You cannot change your own parish role." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("parish_memberships")
    .update({ role: payload.role })
    .eq("parish_id", parishId)
    .eq("clerk_user_id", clerkUserId)
    .select("parish_id,clerk_user_id,role")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ error: "Membership not found." }, { status: 404 });
  }

  await recordAdminAuditLog({
    actorClerkUserId: actorUserId,
    action: "parish.member_role_updated",
    resourceType: "parish_membership",
    resourceId: clerkUserId,
    details: {
      parish_id: parishId,
      role: payload.role,
    },
  });

  return NextResponse.json({ membership: data });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ clerkUserId: string }> }) {
  const { clerkUserId: actorUserId, parishId } = await requireParishRole("parish_admin");
  const { clerkUserId } = paramsSchema.parse(await ctx.params);

  if (clerkUserId === actorUserId) {
    return NextResponse.json({ error: "You cannot remove your own parish membership." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("parish_memberships")
    .delete()
    .eq("parish_id", parishId)
    .eq("clerk_user_id", clerkUserId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await recordAdminAuditLog({
    actorClerkUserId: actorUserId,
    action: "parish.member_removed",
    resourceType: "parish_membership",
    resourceId: clerkUserId,
    details: {
      parish_id: parishId,
    },
  });

  return NextResponse.json({ ok: true });
}
