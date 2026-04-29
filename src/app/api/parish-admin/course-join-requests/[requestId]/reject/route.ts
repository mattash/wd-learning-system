import { NextResponse } from "next/server";
import { z } from "zod";

import { requireParishRole } from "@/lib/authz";
import { rejectJoinRequest } from "@/lib/repositories/course-join-requests";

const paramsSchema = z.object({
  requestId: z.string().uuid(),
});

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { clerkUserId, parishId: _parishId } = await requireParishRole("parish_admin");
  const { requestId } = paramsSchema.parse(await params);

  try {
    await rejectJoinRequest({ requestId, actorClerkUserId: clerkUserId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}