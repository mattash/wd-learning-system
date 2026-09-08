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

function authorizeWorker(req: Request) {
  const expectedTokens = [
    process.env.CRON_SECRET,
    process.env.PARISH_COMMUNICATIONS_WORKER_TOKEN,
  ].filter((token): token is string => Boolean(token));

  if (expectedTokens.length === 0) {
    return NextResponse.json(
      { error: "Delivery worker authentication is not configured." },
      { status: 500 },
    );
  }

  const suppliedToken =
    req.headers.get("x-parish-worker-token") ??
    getBearerToken(req.headers.get("authorization"));
  if (!suppliedToken || !expectedTokens.includes(suppliedToken)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return null;
}

export async function GET(req: Request) {
  const authError = authorizeWorker(req);
  if (authError) return authError;

  return NextResponse.json(await processPendingParishMessageDeliveryJobs());
}

export async function POST(req: Request) {
  const authError = authorizeWorker(req);
  if (authError) return authError;

  let parsedBody: z.infer<typeof requestSchema>;
  try {
    const rawBody = await req.text();
    parsedBody = rawBody.trim() ? requestSchema.parse(JSON.parse(rawBody)) : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid delivery request payload" }, { status: 400 });
  }

  const result = await processPendingParishMessageDeliveryJobs({
    limit: parsedBody?.limit,
  });

  return NextResponse.json(result);
}
