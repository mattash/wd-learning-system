import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const DEFAULT_UPLOAD_EXPIRATION_SECONDS = 300;

const IMAGE_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const IMAGE_EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type ImageUploadKind = "course" | "module" | "lesson" | "misc";

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
  publicBaseUrl: string | null;
  region: string;
}

let cachedConfig: R2Config | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getConfig(): R2Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const accountId = requiredEnv("R2_ACCOUNT_ID");
  const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");
  const bucket = requiredEnv("R2_BUCKET");
  const endpoint = (process.env.R2_ENDPOINT ?? `https://${accountId}.r2.cloudflarestorage.com`).replace(/\/+$/, "");
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, "") ?? null;
  const region = process.env.R2_REGION ?? "auto";

  cachedConfig = {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint,
    publicBaseUrl,
    region,
  };

  return cachedConfig;
}

function getClient() {
  const config = getConfig();
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function sanitizePathSegment(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function encodePath(path: string) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function isAllowedImageContentType(contentType: string) {
  return IMAGE_CONTENT_TYPES.has(contentType.toLowerCase());
}

export function getImageExtension(contentType: string) {
  return IMAGE_EXTENSION_BY_CONTENT_TYPE[contentType.toLowerCase()];
}

export function buildImageObjectKey(kind: ImageUploadKind, fileName: string, contentType: string) {
  const extension = getImageExtension(contentType);
  if (!extension) {
    throw new Error(`Unsupported image content type: ${contentType}`);
  }

  const baseName = sanitizePathSegment(fileName.replace(/\.[^./]+$/, "")) || "image";
  const stamp = `${Date.now()}-${crypto.randomUUID()}`;

  return `${kind}-thumbnails/${stamp}-${baseName}.${extension}`;
}

export function getPublicObjectUrl(key: string) {
  const config = getConfig();
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl}/${encodePath(key)}`;
  }

  return `${config.endpoint}/${config.bucket}/${encodePath(key)}`;
}

export async function createPresignedImageUpload(params: {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}) {
  const config = getConfig();
  const client = getClient();
  const expiresInSeconds = params.expiresInSeconds ?? DEFAULT_UPLOAD_EXPIRATION_SECONDS;

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: params.key,
      ContentType: params.contentType,
    }),
    { expiresIn: expiresInSeconds },
  );

  return {
    uploadUrl,
    expiresInSeconds,
    objectKey: params.key,
    assetUrl: getPublicObjectUrl(params.key),
  };
}

export async function deleteObject(key: string) {
  const config = getConfig();
  const client = getClient();

  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
  );
}
