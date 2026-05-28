import { NextResponse } from "next/server";
import { z } from "zod";

import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const schema = z.object({
  clerkUserId: z.string().min(1),
  parishId: z.string().uuid().optional(),
  role: z.enum(["parish_admin", "instructor", "student"]).optional(),
  makeDioceseAdmin: z.boolean().default(false),
});

export async function POST(req: Request) {
  await requireDioceseAdmin();
  let payload: z.infer<typeof schema>;

  try {
    payload = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid admin membership request payload" }, { status: 400 });
  }

  const hasParishMembershipChange = Boolean(payload.parishId && payload.role);
  const hasPartialParishMembershipChange = Boolean(payload.parishId || payload.role) && !hasParishMembershipChange;

  if (hasPartialParishMembershipChange || (!payload.makeDioceseAdmin && !hasParishMembershipChange)) {
    return NextResponse.json({ error: "Invalid admin membership request payload" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  let removeDioceseAdminOnMembershipFailure = false;

  if (payload.makeDioceseAdmin && hasParishMembershipChange) {
    const { data, error } = await supabase
      .from("diocese_admins")
      .select("clerk_user_id")
      .eq("clerk_user_id", payload.clerkUserId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    removeDioceseAdminOnMembershipFailure = !data;
  }

  if (payload.makeDioceseAdmin) {
    const { error } = await supabase.from("diocese_admins").upsert({
      clerk_user_id: payload.clerkUserId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (hasParishMembershipChange) {
    const { error } = await supabase.from("parish_memberships").upsert(
      {
        parish_id: payload.parishId,
        clerk_user_id: payload.clerkUserId,
        role: payload.role,
      },
      { onConflict: "parish_id,clerk_user_id" },
    );

    if (error) {
      if (removeDioceseAdminOnMembershipFailure) {
        await supabase.from("diocese_admins").delete().eq("clerk_user_id", payload.clerkUserId);
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
