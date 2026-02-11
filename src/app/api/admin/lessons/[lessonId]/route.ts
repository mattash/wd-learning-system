import { NextResponse } from "next/server";
import { z } from "zod";

import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ lessonId: z.string().uuid() });

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

const updateLessonSchema = z.object({
  title: z.string().min(1),
  descriptor: optionalDescriptorSchema,
  thumbnailUrl: optionalThumbnailSchema,
  youtubeVideoId: z.string().min(1),
  sortOrder: z.number().int().min(0),
  passingScore: z.number().int().min(0).max(100),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ lessonId: string }> }) {
  await requireDioceseAdmin();
  const { lessonId } = paramsSchema.parse(await ctx.params);
  const payload = updateLessonSchema.parse(await req.json());

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("lessons")
    .update({
      title: payload.title,
      descriptor: payload.descriptor,
      thumbnail_url: payload.thumbnailUrl,
      youtube_video_id: payload.youtubeVideoId,
      sort_order: payload.sortOrder,
      passing_score: payload.passingScore,
    })
    .eq("id", lessonId)
    .select("id,module_id,title,descriptor,thumbnail_url,youtube_video_id,sort_order,passing_score")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ lesson: data });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ lessonId: string }> }) {
  await requireDioceseAdmin();
  const { lessonId } = paramsSchema.parse(await ctx.params);

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("lessons").delete().eq("id", lessonId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
