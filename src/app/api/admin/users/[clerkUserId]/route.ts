import { NextResponse } from "next/server";
import { z } from "zod";

import { requireDioceseAdmin } from "@/lib/authz";
import { recordAdminAuditLog } from "@/lib/audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  clerkUserId: z.string().min(1),
});

const updateSchema = z
  .object({
    displayName: z.preprocess(normalizeNullableString, z.string().max(120).nullable().optional()),
    email: z.preprocess(normalizeNullableString, z.string().email().nullable().optional()),
  })
  .refine((value) => value.displayName !== undefined || value.email !== undefined, {
    message: "At least one profile field is required",
  });

export async function PATCH(req: Request, ctx: { params: Promise<{ clerkUserId: string }> }) {
  const actorUserId = await requireDioceseAdmin();

  const parsedParams = paramsSchema.safeParse(await ctx.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const parsedPayload = updateSchema.safeParse(await req.json());
  if (!parsedPayload.success) {
    return NextResponse.json(
      { error: parsedPayload.error.issues[0]?.message ?? "Invalid profile update payload" },
      { status: 400 },
    );
  }

  const { clerkUserId } = parsedParams.data;
  const payload = parsedPayload.data;
  const updates: { display_name?: string | null; email?: string | null } = {};
  if (payload.displayName !== undefined) {
    updates.display_name = payload.displayName;
  }
  if (payload.email !== undefined) {
    updates.email = payload.email;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .update(updates)
    .eq("clerk_user_id", clerkUserId)
    .select("clerk_user_id,email,display_name,onboarding_completed_at,created_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });
  }

  await recordAdminAuditLog({
    actorClerkUserId: actorUserId,
    action: "user_profile.updated",
    resourceType: "user_profile",
    resourceId: clerkUserId,
    details: {
      updated_fields: Object.keys(updates),
    },
  });

  return NextResponse.json({ user: data });
}

function normalizeNullableString(value: unknown) {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
