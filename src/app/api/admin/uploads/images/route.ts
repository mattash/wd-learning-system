import { NextResponse } from "next/server";
import { z } from "zod";

import { requireDioceseAdmin } from "@/lib/authz";
import {
  buildImageObjectKey,
  createPresignedImageUpload,
  isAllowedImageContentType,
  type ImageUploadKind,
} from "@/lib/storage/r2";

export const runtime = "nodejs";

const DEFAULT_UPLOAD_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const requestSchema = z.object({
  kind: z.enum(["course", "module", "lesson", "misc"]).default("misc"),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(255),
  size: z.number().int().positive(),
});

function getMaxImageBytes() {
  const parsed = Number.parseInt(process.env.UPLOAD_MAX_IMAGE_BYTES ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_UPLOAD_MAX_IMAGE_BYTES;
  }
  return parsed;
}

export async function POST(req: Request) {
  await requireDioceseAdmin();

  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  const payload = parsed.data;
  const normalizedContentType = payload.contentType.toLowerCase();

  if (!isAllowedImageContentType(normalizedContentType)) {
    return NextResponse.json({ error: "Unsupported image type." }, { status: 400 });
  }

  const maxImageBytes = getMaxImageBytes();
  if (payload.size > maxImageBytes) {
    return NextResponse.json(
      { error: `Image too large. Max upload size is ${maxImageBytes} bytes.` },
      { status: 400 },
    );
  }

  try {
    const objectKey = buildImageObjectKey(payload.kind as ImageUploadKind, payload.fileName, normalizedContentType);
    const upload = await createPresignedImageUpload({
      key: objectKey,
      contentType: normalizedContentType,
    });

    return NextResponse.json(upload, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create upload URL.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
