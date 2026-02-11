import { NextResponse } from "next/server";
import { z } from "zod";

import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ moduleId: z.string().uuid() });

const createLessonSchema = z.object({
  title: z.string().min(1),
  youtubeVideoId: z.string().min(1),
  sortOrder: z.number().int().min(0).default(0),
  passingScore: z.number().int().min(0).max(100).default(80),
});

export async function POST(req: Request, ctx: { params: Promise<{ moduleId: string }> }) {
  await requireDioceseAdmin();
  const { moduleId } = paramsSchema.parse(await ctx.params);
  const payload = createLessonSchema.parse(await req.json());

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("lessons")
    .insert({
      module_id: moduleId,
      title: payload.title,
      youtube_video_id: payload.youtubeVideoId,
      sort_order: payload.sortOrder,
      passing_score: payload.passingScore,
    })
    .select("id,module_id,title,youtube_video_id,sort_order,passing_score")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ lesson: data }, { status: 201 });
}
