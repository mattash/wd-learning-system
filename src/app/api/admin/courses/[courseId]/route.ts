import { NextResponse } from "next/server";
import { z } from "zod";

import { requireDioceseAdmin } from "@/lib/authz";
import { COURSE_CATEGORIES } from "@/lib/course-metadata";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  courseId: z.string().uuid(),
});

const optionalThumbnailSchema = z
  .string()
  .trim()
  .max(2048)
  .nullish()
  .transform((value) => (value && value.length > 0 ? value : null));

const updateCourseSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  instructor: z.string().trim().max(160).nullable().optional(),
  durationHours: z.number().positive().nullable().optional(),
  category: z.enum(COURSE_CATEGORIES).nullable().optional(),
  thumbnailUrl: optionalThumbnailSchema,
  scope: z.enum(["DIOCESE", "PARISH"]),
  published: z.boolean(),
  publiclyBrowseable: z.boolean(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ courseId: string }> }) {
  await requireDioceseAdmin();
  let courseId: string;
  let payload: z.infer<typeof updateCourseSchema>;
  let includesDescription = false;
  let includesInstructor = false;
  let includesDurationHours = false;
  let includesCategory = false;
  let includesThumbnailUrl = false;

  try {
    const body: unknown = await req.json();
    includesDescription = typeof body === "object" && body !== null && Object.hasOwn(body, "description");
    includesInstructor = typeof body === "object" && body !== null && Object.hasOwn(body, "instructor");
    includesDurationHours = typeof body === "object" && body !== null && Object.hasOwn(body, "durationHours");
    includesCategory = typeof body === "object" && body !== null && Object.hasOwn(body, "category");
    includesThumbnailUrl = typeof body === "object" && body !== null && Object.hasOwn(body, "thumbnailUrl");
    courseId = paramsSchema.parse(await ctx.params).courseId;
    payload = updateCourseSchema.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid course request payload" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const updateValues = {
    title: payload.title,
    scope: payload.scope,
    published: payload.published,
    publicly_browseable: payload.publiclyBrowseable,
    updated_at: new Date().toISOString(),
    ...(includesDescription ? { description: payload.description ?? null } : {}),
    ...(includesInstructor ? { instructor: payload.instructor ?? null } : {}),
    ...(includesDurationHours ? { duration_hours: payload.durationHours ?? null } : {}),
    ...(includesCategory ? { category: payload.category ?? null } : {}),
    ...(includesThumbnailUrl ? { thumbnail_url: payload.thumbnailUrl } : {}),
  };

  const { data, error } = await supabase
    .from("courses")
    .update(updateValues)
    .eq("id", courseId)
    .select("id,title,description,thumbnail_url,instructor,duration_hours,category,scope,published,publicly_browseable,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ course: data });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ courseId: string }> }) {
  await requireDioceseAdmin();
  let courseId: string;

  try {
    courseId = paramsSchema.parse(await ctx.params).courseId;
  } catch {
    return NextResponse.json({ error: "Invalid course request payload" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("courses").delete().eq("id", courseId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
