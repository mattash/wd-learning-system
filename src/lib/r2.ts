import { randomUUID } from "node:crypto";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const DEFAULT_MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

let r2Client: S3Client | null = null;

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for R2 uploads.`);
  }

  return value;
}

function getForcePathStyle() {
  return process.env.R2_FORCE_PATH_STYLE === "true";
}

function getR2Client() {
  if (r2Client) {
    return r2Client;
  }

  r2Client = new S3Client({
    region: process.env.R2_REGION?.trim() || "auto",
    endpoint: getRequiredEnv("R2_ENDPOINT"),
    forcePathStyle: getForcePathStyle(),
    credentials: {
      accessKeyId: getRequiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: getRequiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });

  return r2Client;
}

function sanitizeFileBaseName(fileName: string) {
  const withoutExtension = fileName.replace(/\.pdf$/i, "");
  const normalized = withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return normalized || "document";
}

function buildObjectKey(fileName: string) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const safeBaseName = sanitizeFileBaseName(fileName);

  return `documents/${year}/${month}/${randomUUID()}-${safeBaseName}.pdf`;
}

function buildPublicUrl(key: string) {
  const baseUrl = getRequiredEnv("R2_PUBLIC_BASE_URL").replace(/\/+$/, "");
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");

  return `${baseUrl}/${encodedKey}`;
}

export function getDocumentUploadMaxBytes() {
  const rawValue = process.env.UPLOAD_MAX_DOCUMENT_BYTES?.trim();
  const parsed = Number.parseInt(rawValue ?? "", 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_DOCUMENT_BYTES;
  }

  return parsed;
}

export async function uploadDocumentToR2({
  body,
  contentType,
  fileName,
}: {
  body: Buffer;
  contentType: string;
  fileName: string;
}) {
  const bucket = getRequiredEnv("R2_BUCKET");
  const key = buildObjectKey(fileName);

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentDisposition: "inline",
    }),
  );

  return {
    key,
    url: buildPublicUrl(key),
  };
}
