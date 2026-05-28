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

const createLessonSchema = z.object({
  title: z.string().min(1),
  descriptor: optionalDescriptorSchema,
  thumbnailUrl: optionalThumbnailSchema,
  contentType: z.enum(["VIDEO", "DOCUMENT"]).default("VIDEO"),
  youtubeVideoId: z
    .string()
    .trim()
    .nullish()
    .transform((value) => (value && value.length > 0 ? value : null)),
  documentUrl: optionalDocumentUrlSchema,
  documentPageStart: optionalPageNumberSchema,
  documentPageEnd: optionalPageNumberSchema,
  sortOrder: z.number().int().min(0).default(0),
  passingScore: z.number().int().min(0).max(100).default(80),
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

export async function POST(req: Request, ctx: { params: Promise<{ moduleId: string }> }) {
  await requireDioceseAdmin();
  const parsedParams = paramsSchema.safeParse(await ctx.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid lesson request payload" }, { status: 400 });
  }
  const { moduleId } = parsedParams.data;

  let rawPayload: unknown;
  try {
    rawPayload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid lesson request payload" }, { status: 400 });
  }

  const parsedPayload = createLessonSchema.safeParse(rawPayload);
  if (!parsedPayload.success) {
    const firstIssue = parsedPayload.error.issues[0];
    return NextResponse.json({ error: firstIssue?.message ?? "Invalid lesson request payload" }, { status: 400 });
  }

  const payload = parsedPayload.data;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("lessons")
    .insert({
      module_id: moduleId,
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
    .select("id,module_id,title,descriptor,thumbnail_url,content_type,youtube_video_id,document_url,document_page_start,document_page_end,sort_order,passing_score")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ lesson: data }, { status: 201 });
}
