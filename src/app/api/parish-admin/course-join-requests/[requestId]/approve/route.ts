import { NextResponse } from "next/server";
import { z } from "zod";

import { requireParishRole } from "@/lib/authz";
import { approveJoinRequest } from "@/lib/repositories/course-join-requests";
import { notifyJoinRequestApproved } from "@/lib/parish-communications/notifications";

const paramsSchema = z.object({
  requestId: z.string().uuid(),
});

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { clerkUserId, parishId } = await requireParishRole("parish_admin");

  try {
    const { requestId } = paramsSchema.parse(await params);

    // Get request details before approving (need course_id for notification)
    const { getSupabaseAdminClient } = await import("@/lib/supabase/server");
    const supabase = getSupabaseAdminClient();
    const { data: requestRow } = await supabase
      .from("course_join_requests")
      .select("clerk_user_id, course_id")
      .eq("id", requestId)
      .eq("status", "PENDING")
      .single();
    await approveJoinRequest({ requestId, actorClerkUserId: clerkUserId });

    // Send notification email (non-blocking - don't fail the request if email fails)
    if (requestRow) {
      const req = requestRow as { clerk_user_id: string; course_id: string };
      notifyJoinRequestApproved({
        clerkUserId: req.clerk_user_id,
        parishId,
        courseId: req.course_id,
      }).catch((err) => console.error("[notifications] join request approved email failed:", err));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}