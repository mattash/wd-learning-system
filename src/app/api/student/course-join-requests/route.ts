import { NextResponse } from "next/server";
import { z } from "zod";

import { requireParishRole } from "@/lib/authz";
import { createJoinRequest, getStudentPendingRequests } from "@/lib/repositories/course-join-requests";

const createSchema = z.object({
  courseId: z.string().uuid(),
});

export async function GET() {
  const { clerkUserId, parishId } = await requireParishRole("student");

  const requests = await getStudentPendingRequests({ parishId, clerkUserId });

  return NextResponse.json({ requests });
}

export async function POST(req: Request) {
  const { clerkUserId, parishId } = await requireParishRole("student");
  const payload = createSchema.parse(await req.json());

  try {
    const request = await createJoinRequest({
      parishId,
      clerkUserId,
      courseId: payload.courseId,
    });

    return NextResponse.json({ request }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}