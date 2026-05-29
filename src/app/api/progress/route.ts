import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth, requireParishRole } from "@/lib/authz";
import { isE2ESmokeMode } from "@/lib/e2e-mode";
import { isUserEnrolledForLesson } from "@/lib/repositories/lessons";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const schema = z.object({
  lessonId: z.string().uuid(),
  parishId: z.string().uuid(),
  percentWatched: z.number().int().min(0).max(100),
  lastPositionSeconds: z.number().int().min(0),
  completed: z.boolean(),
});

export async function POST(req: Request) {
  const userId = await requireAuth();
  const { parishId } = await requireParishRole("student");
  const body = schema.parse(await req.json());

  if (parishId !== body.parishId) {
    return NextResponse.json({ error: "Invalid parish context" }, { status: 403 });
  }

  const enrolled = await isUserEnrolledForLesson({ lessonId: body.lessonId, parishId, clerkUserId: userId });
  if (!enrolled) {
    return NextResponse.json({ error: "Enrollment required for this lesson" }, { status: 403 });
  }

  if (isE2ESmokeMode()) {
    return NextResponse.json({ ok: true });
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.rpc("record_video_progress", {
    p_parish_id: parishId,
    p_clerk_user_id: userId,
    p_lesson_id: body.lessonId,
    p_percent_watched: body.percentWatched,
    p_last_position_seconds: body.lastPositionSeconds,
    p_completed: body.completed,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
