import { NextResponse } from "next/server";
import { z } from "zod";

import { requireDioceseAdmin } from "@/lib/authz";
import { listAdminAuditLogs } from "@/lib/audit-log";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const querySchema = z
  .object({
    action: z.string().trim().max(120).optional(),
    actorUserId: z.string().trim().max(120).optional(),
    resourceType: z.string().trim().max(120).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(500).default(100),
  })
  .superRefine((value, ctx) => {
    if (value.startDate && !isValidDate(value.startDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "startDate must be a valid YYYY-MM-DD date",
        path: ["startDate"],
      });
    }

    if (value.endDate && !isValidDate(value.endDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endDate must be a valid YYYY-MM-DD date",
        path: ["endDate"],
      });
    }

    if (value.startDate && value.endDate && value.startDate > value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "startDate must be before or equal to endDate",
        path: ["startDate"],
      });
    }
  });

export async function GET(req: Request) {
  await requireDioceseAdmin();

  const url = new URL(req.url);
  const parsedQuery = querySchema.safeParse({
    action: url.searchParams.get("action") ?? undefined,
    actorUserId: url.searchParams.get("actorUserId") ?? undefined,
    resourceType: url.searchParams.get("resourceType") ?? undefined,
    startDate: url.searchParams.get("startDate") ?? undefined,
    endDate: url.searchParams.get("endDate") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json({ error: parsedQuery.error.issues[0]?.message ?? "Invalid query params" }, { status: 400 });
  }

  try {
    const logs = await listAdminAuditLogs({
      action: parsedQuery.data.action,
      actorClerkUserId: parsedQuery.data.actorUserId,
      resourceType: parsedQuery.data.resourceType,
      startDate: parsedQuery.data.startDate,
      endDate: parsedQuery.data.endDate,
      limit: parsedQuery.data.limit,
    });

    return NextResponse.json({ logs });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load audit logs" },
      { status: 400 },
    );
  }
}

function isValidDate(value: string) {
  if (!dateRegex.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return (
    utcDate.getUTCFullYear() === year &&
    utcDate.getUTCMonth() === month - 1 &&
    utcDate.getUTCDate() === day
  );
}
