import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function getR2Client(): S3Client {
  return new S3Client({
    region: getRequiredEnv("R2_REGION") || "auto",
    endpoint: getRequiredEnv("R2_ENDPOINT"),
    forcePathStyle: true,
    credentials: {
      accessKeyId: getRequiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: getRequiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
}

function getPublicBaseUrl(): string {
  const base = getRequiredEnv("R2_PUBLIC_BASE_URL").replace(/\/+$/, "");
  return base;
}

function encodePath(rawPath: string): string {
  return rawPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export async function resolveAndUploadThumbnail(
  thumbnailUrl: string | null,
  prefix: string,
  fallbackBaseName: string,
): Promise<string | null> {
  if (!thumbnailUrl) return null;

  // Already an external HTTPS URL — return as-is
  if (thumbnailUrl.startsWith("https://") || thumbnailUrl.startsWith("http://")) {
    return thumbnailUrl;
  }

  // Local app path — try to resolve relative to project root
  if (thumbnailUrl.startsWith("/")) {
    const projectRoot = path.resolve(process.cwd());
    // Try public directory first (standard Next.js static assets)
    let localPath = path.join(projectRoot, "public", thumbnailUrl);
    // Also try absolute paths if provided as such
    if (!existsSync(localPath)) {
      localPath = thumbnailUrl;
    }

    if (!existsSync(localPath)) {
      throw new Error(
        `Local thumbnail not found at '${thumbnailUrl}'. ` +
        `Place files in the 'public/' directory or use an absolute path.`,
      );
    }

    const fileBuffer = await readFile(localPath);
    const contentType = detectContentType(thumbnailUrl);
    const ext = path.extname(thumbnailUrl) || "";
    const safeBaseName = fallbackBaseName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    const key = `${prefix}/${randomUUID()}-${safeBaseName}${ext}`;

    const client = getR2Client();
    await client.send(
      new PutObjectCommand({
        Bucket: getRequiredEnv("R2_BUCKET"),
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    const publicUrl = `${getPublicBaseUrl()}/${encodePath(key)}`;
    console.log(`  ↑ uploaded thumbnail → ${publicUrl}`);
    return publicUrl;
  }

  // Unknown scheme — return as-is (let validation catch it)
  return thumbnailUrl;
}

function detectContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
  };
  return mimeTypes[ext] ?? "application/octet-stream";
}