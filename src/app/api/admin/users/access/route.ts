import { NextResponse } from "next/server";
import { z } from "zod";

import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const schema = z.object({
  clerkUserId: z.string().min(1),
  makeDioceseAdmin: z.boolean().default(false),
  removeDioceseAdmin: z.boolean().default(false),
  parishId: z.string().uuid().optional(),
  role: z.enum(["parish_admin", "instructor", "student"]).optional(),
  removeParishMembership: z.boolean().default(false),
});

export async function POST(req: Request) {
  await requireDioceseAdmin();
  const payload = schema.parse(await req.json());
  const supabase = getSupabaseAdminClient();

  if (payload.makeDioceseAdmin) {
    const { error } = await supabase.from("diocese_admins").upsert({
      clerk_user_id: payload.clerkUserId,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (payload.removeDioceseAdmin) {
    const { error } = await supabase.from("diocese_admins").delete().eq("clerk_user_id", payload.clerkUserId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (payload.parishId && payload.role && !payload.removeParishMembership) {
    const { error } = await supabase.from("parish_memberships").upsert(
      {
        parish_id: payload.parishId,
        clerk_user_id: payload.clerkUserId,
        role: payload.role,
      },
      { onConflict: "parish_id,clerk_user_id" },
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (payload.parishId && payload.removeParishMembership) {
    const { error } = await supabase
      .from("parish_memberships")
      .delete()
      .eq("parish_id", payload.parishId)
      .eq("clerk_user_id", payload.clerkUserId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
