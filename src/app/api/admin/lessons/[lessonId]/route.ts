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

const optionalDocumentUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .nullish()
  .transform((value) => (value && value.length > 0 ? value : null));

const optionalPageNumberSchema = z
  .number()
  .int()
  .min(1)
  .nullish()
  .transform((value) => value ?? null);

const updateLessonSchema = z.object({
  title: z.string().min(1),
  descriptor: optionalDescriptorSchema,
  thumbnailUrl: optionalThumbnailSchema,
  contentType: z.enum(["VIDEO", "DOCUMENT"]),
  youtubeVideoId: z
    .string()
    .trim()
    .nullish()
    .transform((value) => (value && value.length > 0 ? value : null)),
  documentUrl: optionalDocumentUrlSchema,
  documentPageStart: optionalPageNumberSchema,
  documentPageEnd: optionalPageNumberSchema,
  sortOrder: z.number().int().min(0),
  passingScore: z.number().int().min(0).max(100),
}).superRefine((value, ctx) => {
  if (value.contentType === "VIDEO" && !value.youtubeVideoId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "YouTube video ID is required for video lessons.",
      path: ["youtubeVideoId"],
    });
  }

  if (value.contentType === "DOCUMENT" && !value.documentUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Document URL is required for document lessons.",
      path: ["documentUrl"],
    });
  }

  if (
    value.documentPageStart !== null &&
    value.documentPageEnd !== null &&
    value.documentPageEnd < value.documentPageStart
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Document end page must be greater than or equal to the start page.",
      path: ["documentPageEnd"],
    });
  }
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
      content_type: payload.contentType,
      youtube_video_id: payload.contentType === "VIDEO" ? payload.youtubeVideoId : null,
      document_url: payload.contentType === "DOCUMENT" ? payload.documentUrl : null,
      document_page_start: payload.contentType === "DOCUMENT" ? payload.documentPageStart : null,
      document_page_end: payload.contentType === "DOCUMENT" ? payload.documentPageEnd : null,
      sort_order: payload.sortOrder,
      passing_score: payload.passingScore,
    })
    .eq("id", lessonId)
    .select("id,module_id,title,descriptor,thumbnail_url,content_type,youtube_video_id,document_url,document_page_start,document_page_end,sort_order,passing_score")
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
