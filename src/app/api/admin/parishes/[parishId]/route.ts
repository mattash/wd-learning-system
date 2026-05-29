import { NextResponse } from "next/server";
import { z } from "zod";

import { requireDioceseAdmin } from "@/lib/authz";
import { recordAdminAuditLog } from "@/lib/audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  parishId: z.string().uuid(),
});

const updateParishSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  allowSelfSignup: z.boolean(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ parishId: string }> }) {
  const actorUserId = await requireDioceseAdmin();
  const parsedParams = paramsSchema.safeParse(await ctx.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid parish request payload" }, { status: 400 });
  }
  const { parishId } = parsedParams.data;

  let rawPayload: unknown;
  try {
    rawPayload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid parish request payload" }, { status: 400 });
  }

  const parsedPayload = updateParishSchema.safeParse(rawPayload);
  if (!parsedPayload.success) {
    return NextResponse.json({ error: "Invalid parish request payload" }, { status: 400 });
  }

  const payload = parsedPayload.data;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("parishes")
    .update({
      name: payload.name,
      slug: payload.slug,
      allow_self_signup: payload.allowSelfSignup,
    })
    .eq("id", parishId)
    .select("id,name,slug,allow_self_signup,archived_at,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  try {
    await recordAdminAuditLog({
      actorClerkUserId: actorUserId,
      action: "parish.updated",
      resourceType: "parish",
      resourceId: parishId,
      details: {
        parish_name: payload.name,
        parish_slug: payload.slug,
        allow_self_signup: payload.allowSelfSignup,
      },
    });
  } catch (error) {
    console.error("[audit-log] parish update audit log failed:", error);
  }

  return NextResponse.json({ parish: data });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ parishId: string }> }) {
  const actorUserId = await requireDioceseAdmin();
  const parsedParams = paramsSchema.safeParse(await ctx.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid parish request payload" }, { status: 400 });
  }
  const { parishId } = parsedParams.data;

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("parishes").delete().eq("id", parishId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  try {
    await recordAdminAuditLog({
      actorClerkUserId: actorUserId,
      action: "parish.deleted",
      resourceType: "parish",
      resourceId: parishId,
      details: {},
    });
  } catch (error) {
    console.error("[audit-log] parish delete audit log failed:", error);
  }

  return NextResponse.json({ ok: true });
}
