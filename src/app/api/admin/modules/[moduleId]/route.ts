import { NextResponse } from "next/server";
import { z } from "zod";

import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ moduleId: z.string().uuid() });

const optionalDescriptorSchema = z
  .string()
  .trim()
  .max(500)
  .nullish()
  .transform((value) => (value && value.length > 0 ? value : null));

const optionalThumbnailSchema = z
  .string()
  .trim()
  .max(2048)
  .nullish()
  .transform((value) => (value && value.length > 0 ? value : null));

const updateModuleSchema = z.object({
  title: z.string().min(1),
  descriptor: optionalDescriptorSchema,
  thumbnailUrl: optionalThumbnailSchema,
  sortOrder: z.number().int().min(0),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ moduleId: string }> }) {
  await requireDioceseAdmin();
  const { moduleId } = paramsSchema.parse(await ctx.params);
  const payload = updateModuleSchema.parse(await req.json());

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("modules")
    .update({
      title: payload.title,
      descriptor: payload.descriptor,
      thumbnail_url: payload.thumbnailUrl,
      sort_order: payload.sortOrder,
    })
    .eq("id", moduleId)
    .select("id,course_id,title,descriptor,thumbnail_url,sort_order")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ module: data });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ moduleId: string }> }) {
  await requireDioceseAdmin();
  const { moduleId } = paramsSchema.parse(await ctx.params);

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("modules").delete().eq("id", moduleId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
