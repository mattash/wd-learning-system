import { NextResponse } from "next/server";
import { z } from "zod";

import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ courseId: z.string().uuid() });

const createModuleSchema = z.object({
  title: z.string().min(1),
  sortOrder: z.number().int().min(0).default(0),
});

export async function POST(req: Request, ctx: { params: Promise<{ courseId: string }> }) {
  await requireDioceseAdmin();
  const { courseId } = paramsSchema.parse(await ctx.params);
  const payload = createModuleSchema.parse(await req.json());

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("modules")
    .insert({
      course_id: courseId,
      title: payload.title,
      sort_order: payload.sortOrder,
    })
    .select("id,course_id,title,sort_order")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ module: data }, { status: 201 });
}
