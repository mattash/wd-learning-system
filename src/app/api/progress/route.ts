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
  const { error } = await supabase.from("video_progress").upsert(
    {
      parish_id: parishId,
      clerk_user_id: userId,
      lesson_id: body.lessonId,
      percent_watched: body.percentWatched,
      last_position_seconds: body.lastPositionSeconds,
      completed: body.completed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "parish_id,clerk_user_id,lesson_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
