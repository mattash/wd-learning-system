import { NextResponse } from "next/server";
import { z } from "zod";

import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  courseId: z.string().uuid(),
});

const updateCourseSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  scope: z.enum(["DIOCESE", "PARISH"]),
  published: z.boolean(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ courseId: string }> }) {
  await requireDioceseAdmin();
  const { courseId } = paramsSchema.parse(await ctx.params);
  const payload = updateCourseSchema.parse(await req.json());

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("courses")
    .update({
      title: payload.title,
      description: payload.description ?? null,
      scope: payload.scope,
      published: payload.published,
      updated_at: new Date().toISOString(),
    })
    .eq("id", courseId)
    .select("id,title,description,scope,published,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ course: data });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ courseId: string }> }) {
  await requireDioceseAdmin();
  const { courseId } = paramsSchema.parse(await ctx.params);

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("courses").delete().eq("id", courseId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
