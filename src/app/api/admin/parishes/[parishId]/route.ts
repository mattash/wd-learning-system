import { NextResponse } from "next/server";
import { z } from "zod";

import { requireDioceseAdmin } from "@/lib/authz";
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
  await requireDioceseAdmin();
  const { parishId } = paramsSchema.parse(await ctx.params);
  const payload = updateParishSchema.parse(await req.json());

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("parishes")
    .update({
      name: payload.name,
      slug: payload.slug,
      allow_self_signup: payload.allowSelfSignup,
    })
    .eq("id", parishId)
    .select("id,name,slug,allow_self_signup,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ parish: data });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ parishId: string }> }) {
  await requireDioceseAdmin();
  const { parishId } = paramsSchema.parse(await ctx.params);

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("parishes").delete().eq("id", parishId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
