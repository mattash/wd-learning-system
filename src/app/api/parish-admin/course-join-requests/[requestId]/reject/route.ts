import { NextResponse } from "next/server";
import { z } from "zod";

import { requireParishRole } from "@/lib/authz";
import { rejectJoinRequest } from "@/lib/repositories/course-join-requests";
import { notifyJoinRequestRejected } from "@/lib/parish-communications/notifications";

const paramsSchema = z.object({
  requestId: z.string().uuid(),
});

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { clerkUserId, parishId } = await requireParishRole("parish_admin");
  const { requestId } = paramsSchema.parse(await params);

  // Get request details before rejecting (need course_id for notification)
  const { getSupabaseAdminClient } = await import("@/lib/supabase/server");
  const supabase = getSupabaseAdminClient();
  const { data: requestRow } = await supabase
    .from("course_join_requests")
    .select("clerk_user_id, course_id")
    .eq("id", requestId)
    .eq("status", "PENDING")
    .single();

  try {
    await rejectJoinRequest({ requestId, actorClerkUserId: clerkUserId });

    // Send notification email (non-blocking)
    if (requestRow) {
      const req = requestRow as { clerk_user_id: string; course_id: string };
      notifyJoinRequestRejected({
        clerkUserId: req.clerk_user_id,
        parishId,
        courseId: req.course_id,
      }).catch((err) => console.error("[notifications] join request rejected email failed:", err));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}