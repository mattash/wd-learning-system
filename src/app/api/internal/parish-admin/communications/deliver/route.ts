import { NextResponse } from "next/server";
import { z } from "zod";

import { processPendingParishMessageDeliveryJobs } from "@/lib/parish-communications/delivery-jobs";

const requestSchema = z
  .object({
    limit: z.number().int().min(1).max(50).optional(),
  })
  .optional();

function getBearerToken(value: string | null) {
  if (!value) return null;
  const [scheme, token] = value.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

export async function POST(req: Request) {
  const expectedToken = process.env.PARISH_COMMUNICATIONS_WORKER_TOKEN;
  if (!expectedToken) {
    return NextResponse.json(
      { error: "PARISH_COMMUNICATIONS_WORKER_TOKEN is not configured." },
      { status: 500 },
    );
  }

  const suppliedToken = req.headers.get("x-parish-worker-token") ?? getBearerToken(req.headers.get("authorization"));
  if (suppliedToken !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let parsedBody: z.infer<typeof requestSchema>;
  try {
    const raw = await req.json();
    parsedBody = requestSchema.parse(raw);
  } catch {
    parsedBody = undefined;
  }

  const result = await processPendingParishMessageDeliveryJobs({
    limit: parsedBody?.limit,
  });

  return NextResponse.json(result);
}
