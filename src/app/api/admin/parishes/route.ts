import { NextResponse } from "next/server";
import { z } from "zod";

import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const createParishSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  allowSelfSignup: z.boolean().default(true),
});

export async function GET() {
  await requireDioceseAdmin();
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("parishes")
    .select("id,name,slug,allow_self_signup,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ parishes: data ?? [] });
}

export async function POST(req: Request) {
  await requireDioceseAdmin();
  const payload = createParishSchema.parse(await req.json());

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("parishes")
    .insert({
      name: payload.name,
      slug: payload.slug,
      allow_self_signup: payload.allowSelfSignup,
    })
    .select("id,name,slug,allow_self_signup,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ parish: data }, { status: 201 });
}
