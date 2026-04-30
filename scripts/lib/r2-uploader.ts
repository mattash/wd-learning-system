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

export function getR2Client(): S3Client {
  return new S3Client({
    region: getRequiredEnv("R2_REGION"),
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

export async function validateExternalUrl(
  url: string,
  timeoutMs = 5000,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    return { ok: response.ok, status: response.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("aborted")) {
      return { ok: false, error: `timed out after ${timeoutMs}ms` };
    }
    return { ok: false, error: message };
  }
}

// ─── Upload a buffer to R2 ────────────────────────────────────────────────────

export async function uploadBufferToR2(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string> {
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getRequiredEnv("R2_BUCKET"),
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return `${getPublicBaseUrl()}/${encodePath(key)}`;
}

// ─── Resolve and upload thumbnail URL ──────────────────────────────────────────

export async function resolveAndUploadThumbnail(
  thumbnailUrl: string | null,
  prefix: string,
  fallbackBaseName: string,
  options?: { strict?: boolean },
): Promise<string | null> {
  if (!thumbnailUrl) return null;

  const isExternal =
    thumbnailUrl.startsWith("https://") || thumbnailUrl.startsWith("http://");

  if (isExternal) {
    if (options?.strict) {
      const result = await validateExternalUrl(thumbnailUrl);
      if (!result.ok) {
        throw new Error(
          `External thumbnail URL is inaccessible (${result.status ?? result.error}): ${thumbnailUrl}`,
        );
      }
    }
    return thumbnailUrl;
  }

  if (thumbnailUrl.startsWith("/")) {
    const projectRoot = path.resolve(process.cwd());
    let localPath = path.join(projectRoot, "public", thumbnailUrl);
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

    const publicUrl = await uploadBufferToR2(fileBuffer, key, contentType);
    console.log(`  ↑ uploaded thumbnail → ${publicUrl}`);
    return publicUrl;
  }

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
