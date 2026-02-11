import { NextResponse } from "next/server";
import { z } from "zod";

import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ questionId: z.string().uuid() });

const updateQuestionSchema = z.object({
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  correctOptionIndex: z.number().int().min(0),
  sortOrder: z.number().int().min(0),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ questionId: string }> }) {
  await requireDioceseAdmin();
  const { questionId } = paramsSchema.parse(await ctx.params);
  const payload = updateQuestionSchema.parse(await req.json());

  if (payload.correctOptionIndex >= payload.options.length) {
    return NextResponse.json({ error: "correctOptionIndex out of bounds" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("questions")
    .update({
      prompt: payload.prompt,
      options: payload.options,
      correct_option_index: payload.correctOptionIndex,
      sort_order: payload.sortOrder,
    })
    .eq("id", questionId)
    .select("id,lesson_id,prompt,options,correct_option_index,sort_order")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ question: data });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ questionId: string }> }) {
  await requireDioceseAdmin();
  const { questionId } = paramsSchema.parse(await ctx.params);

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("questions").delete().eq("id", questionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
