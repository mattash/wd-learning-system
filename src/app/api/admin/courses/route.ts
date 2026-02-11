import { NextResponse } from "next/server";
import { z } from "zod";

import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const createCourseSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  scope: z.enum(["DIOCESE", "PARISH"]),
  published: z.boolean().default(false),
});

export async function GET() {
  await requireDioceseAdmin();
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id,title,description,scope,published,created_at,updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ courses: data ?? [] });
}

export async function POST(req: Request) {
  await requireDioceseAdmin();
  const payload = createCourseSchema.parse(await req.json());

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("courses")
    .insert({
      title: payload.title,
      description: payload.description ?? null,
      scope: payload.scope,
      published: payload.published,
    })
    .select("id,title,description,scope,published,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ course: data }, { status: 201 });
}
