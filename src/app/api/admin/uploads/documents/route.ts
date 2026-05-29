import { Buffer } from "node:buffer";

import { NextResponse } from "next/server";

import { requireDioceseAdmin } from "@/lib/authz";
import { getDocumentUploadMaxBytes, uploadDocumentToR2 } from "@/lib/r2";

export const runtime = "nodejs";

const MULTIPART_OVERHEAD_ALLOWANCE_BYTES = 1024 * 1024;

type UploadFile = FormDataEntryValue & {
  arrayBuffer: () => Promise<ArrayBuffer>;
  name: string;
  size: number;
  type: string;
};

function isUploadFile(value: FormDataEntryValue | null): value is UploadFile {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "name" in value &&
    "size" in value &&
    "type" in value
  );
}

function isPdfFile(file: UploadFile) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function hasPdfHeader(body: Buffer) {
  return body.subarray(0, 5).equals(Buffer.from("%PDF-"));
}

function getRequestContentLength(req: Request) {
  const rawValue = req.headers.get("content-length");
  if (!rawValue) {
    return null;
  }

  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function uploadLimitError(maxBytes: number) {
  const maxMegabytes = Math.max(1, Math.ceil(maxBytes / (1024 * 1024)));
  return NextResponse.json(
    { error: `PDF exceeds the ${maxMegabytes} MB upload limit.` },
    { status: 400 },
  );
}

export async function POST(req: Request) {
  await requireDioceseAdmin();

  const maxBytes = getDocumentUploadMaxBytes();
  const contentLength = getRequestContentLength(req);
  if (contentLength === null) {
    return NextResponse.json({ error: "Content-Length header is required." }, { status: 411 });
  }
  if (contentLength > maxBytes + MULTIPART_OVERHEAD_ALLOWANCE_BYTES) {
    return uploadLimitError(maxBytes);
  }

  const formData = await req.formData();
  const entry = formData.get("file");

  if (!isUploadFile(entry)) {
    return NextResponse.json({ error: "PDF file is required." }, { status: 400 });
  }

  if (!isPdfFile(entry)) {
    return NextResponse.json({ error: "Only PDF uploads are supported." }, { status: 400 });
  }

  if (entry.size === 0) {
    return NextResponse.json({ error: "Uploaded PDF is empty." }, { status: 400 });
  }

  if (entry.size > maxBytes) {
    return uploadLimitError(maxBytes);
  }

  try {
    const body = Buffer.from(await entry.arrayBuffer());

    if (!hasPdfHeader(body)) {
      return NextResponse.json({ error: "Only PDF uploads are supported." }, { status: 400 });
    }

    const uploaded = await uploadDocumentToR2({
      body,
      contentType: "application/pdf",
      fileName: entry.name,
    });

    return NextResponse.json(uploaded, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
