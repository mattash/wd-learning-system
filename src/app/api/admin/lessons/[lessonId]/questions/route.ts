import { NextResponse } from "next/server";
import { z } from "zod";

import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ lessonId: z.string().uuid() });

const createQuestionSchema = z.object({
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  correctOptionIndex: z.number().int().min(0),
  sortOrder: z.number().int().min(0).default(0),
});

export async function POST(req: Request, ctx: { params: Promise<{ lessonId: string }> }) {
  await requireDioceseAdmin();
  const { lessonId } = paramsSchema.parse(await ctx.params);
  const payload = createQuestionSchema.parse(await req.json());

  if (payload.correctOptionIndex >= payload.options.length) {
    return NextResponse.json({ error: "correctOptionIndex out of bounds" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("questions")
    .insert({
      lesson_id: lessonId,
      prompt: payload.prompt,
      options: payload.options,
      correct_option_index: payload.correctOptionIndex,
      sort_order: payload.sortOrder,
    })
    .select("id,lesson_id,prompt,options,correct_option_index,sort_order")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ question: data }, { status: 201 });
}
