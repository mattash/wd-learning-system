import { NextResponse } from "next/server";
import { z } from "zod";

import { requireParishRole } from "@/lib/authz";
import { getParishJoinRequests } from "@/lib/repositories/course-join-requests";

export async function GET(req: Request) {
  const { clerkUserId: _actorUserId, parishId } = await requireParishRole("parish_admin");

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const validStatuses = ["PENDING", "APPROVED", "REJECTED"];
  const status = statusParam && validStatuses.includes(statusParam) ? statusParam : undefined;

  const requests = await getParishJoinRequests(parishId, status as "PENDING" | "APPROVED" | "REJECTED" | undefined);

  return NextResponse.json({ requests });
}