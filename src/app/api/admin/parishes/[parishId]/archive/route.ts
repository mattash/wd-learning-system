import { NextResponse } from "next/server";
import { z } from "zod";

import { requireDioceseAdmin } from "@/lib/authz";
import { recordAdminAuditLog } from "@/lib/audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  parishId: z.string().uuid(),
});

const bodySchema = z.object({
  archive: z.boolean(),
});

export async function POST(req: Request, ctx: { params: Promise<{ parishId: string }> }) {
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

  const parsedPayload = bodySchema.safeParse(rawPayload);
  if (!parsedPayload.success) {
    return NextResponse.json({ error: "Invalid parish request payload" }, { status: 400 });
  }

  const payload = parsedPayload.data;

  const archivedAt = payload.archive ? new Date().toISOString() : null;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("parishes")
    .update({ archived_at: archivedAt })
    .eq("id", parishId)
    .select("id,name,slug,allow_self_signup,archived_at,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  try {
    await recordAdminAuditLog({
      actorClerkUserId: actorUserId,
      action: payload.archive ? "parish.archived" : "parish.restored",
      resourceType: "parish",
      resourceId: parishId,
      details: {
        archived_at: archivedAt,
      },
    });
  } catch (error) {
    console.error("[audit-log] parish archive audit log failed:", error);
  }

  return NextResponse.json({ parish: data });
}
