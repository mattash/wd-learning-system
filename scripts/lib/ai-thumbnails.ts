import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  resolveAndUploadThumbnail,
} from "./r2-uploader";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";

// ─── Style matrix ─────────────────────────────────────────────────────────────

export type AiPalette = "light" | "dark" | "vivid";
export type AiStyle = "flat-illustration" | "documentary" | "editorial";
export type AiTextPlacement =
  | "bottom-center"
  | "top-center"
  | "left-vertical"
  | "right-vertical";

export interface AiThumbnailOptions {
  palette: AiPalette;
  style: AiStyle;
  textPlacement: AiTextPlacement;
  styleNotes?: string;
}

export interface AiSubject {
  courseName: string;
  courseTitle: string;
  lessonNumber: number;
  lessonTitle: string;
  subject?: string; // optional override describing what to depict
}

// ─── Palette / style / text-placement descriptions ────────────────────────────

const PALETTE_DESCRIPTIONS: Record<AiPalette, string> = {
  light:
    "Warm parchment and cream background, muted jewel-tone accents in deep teal and burgundy, soft natural lighting.",
  dark: "Deep navy and charcoal background, gold and warm cream accents, rich contrast, dramatic lighting.",
  vivid:
    "Saturated bold colors — royal blue, crimson, gold — high energy yet respectful, clean visual impact.",
};

const STYLE_DESCRIPTIONS: Record<AiStyle, string> = {
  "flat-illustration":
    "Flat iconographic illustration. Clean geometric edges. Symbolic religious imagery (Armenian art influence). No photorealism. Strong shapes, minimal shading.",
  documentary:
    "Photorealistic, rich depth-of-field, naturalistic lighting, textured surfaces, subtle grain. Warm and reverent atmosphere.",
  editorial:
    "Bold graphic editorial layout. Layered composition. Magazine-style spacing. Strong visual hierarchy. Works well with text rendering.",
};

const TEXT_PLACEMENT_DESCRIPTIONS: Record<AiTextPlacement, string> = {
  "bottom-center":
    "Course name and lesson title rendered as bold text on a semi-transparent dark bar at the bottom edge of the thumbnail, horizontally centered. No other text.",
  "top-center":
    "Course name and lesson title rendered as bold text on a semi-transparent dark bar at the top edge of the thumbnail, horizontally centered. No other text.",
  "left-vertical":
    "Course name stacked above lesson title in a vertical column on the left edge of the thumbnail, white text, semi-transparent background. No other text.",
  "right-vertical":
    "Course name stacked above lesson title in a vertical column on the right edge of the thumbnail, white text, semi-transparent background. No other text.",
};

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(params: {
  subject: AiSubject;
  palette: AiPalette;
  style: AiStyle;
  textPlacement: AiTextPlacement;
  styleNotes?: string;
}): string {
  const paletteDesc = PALETTE_DESCRIPTIONS[params.palette];
  const styleDesc = STYLE_DESCRIPTIONS[params.style];
  const textDesc = TEXT_PLACEMENT_DESCRIPTIONS[params.textPlacement];

  const subjectLine = params.subject.subject
    ? `Subject to depict: ${params.subject.subject}.`
    : `Subject: a symbolic illustration representing "${params.subject.lessonTitle}" — reverent and appropriate for religious education.`;

  const styleNotes = params.styleNotes ? ` Additional direction: ${params.styleNotes}.` : "";

  return [
    `"${params.subject.courseTitle}" — Lesson ${params.subject.lessonNumber}: "${params.subject.lessonTitle}".`,
    subjectLine,
    `Style: ${paletteDesc} ${styleDesc}${styleNotes}`,
    `Text placement: ${textDesc}`,
    "No logos, no watermarks, no photographs of real people, no celebrities.",
    "Square aspect ratio (1:1).",
  ].join(" ");
}

// ─── Image generation via OpenAI GPT Image API ─────────────────────────────────

export async function generateAiThumbnail(
  params: AiSubject,
  opts: AiThumbnailOptions,
): Promise<{ imageBuffer: Buffer; contentType: string }> {
  if (!OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env.local to enable AI thumbnail generation.",
    );
  }

  const prompt = buildPrompt({ subject: params, ...opts });

  const response = await fetch(OPENAI_IMAGES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-2",
      prompt,
      n: 1,
      size: "1024x1024",
      response_format: "png",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `OpenAI images API error ${response.status}: ${errorBody}`,
    );
  }

  const data = (await response.json()) as {
    data: Array<{ b64_json?: string; url?: string }>;
  };

  const b64 = data.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI returned no image data in response.");
  }

  const buffer = Buffer.from(b64, "base64");
  return { imageBuffer: buffer, contentType: "image/png" };
}

// ─── Resolve with AI generation fallback ──────────────────────────────────────
//
// When thumbnail_url is "ai://<subject>", generate from OpenAI then upload to R2.

export function isAiThumbnailUrl(url: string | null): boolean {
  return url === "ai://" || (url?.startsWith("ai://") ?? false);
}

export async function resolveAiThumbnail(
  params: AiSubject,
  prefix: string,
  opts: AiThumbnailOptions,
): Promise<string> {
  const { imageBuffer, contentType } = await generateAiThumbnail(params, opts);

  const ext = ".png";
  const safeBaseName = params.lessonTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const key = `${prefix}/${randomUUID()}-${safeBaseName}${ext}`;

  // Upload to R2 using the same client setup as r2-uploader
  const { PutObjectCommand, S3Client } = await import("@aws-sdk/client-s3");

  const getEnv = (n: string) => {
    const v = process.env[n];
    if (!v) throw new Error(`Missing env var: ${n}`);
    return v.trim();
  };

  const client = new S3Client({
    region: getEnv("R2_REGION") ?? "auto",
    endpoint: getEnv("R2_ENDPOINT"),
    forcePathStyle: true,
    credentials: {
      accessKeyId: getEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: getEnv("R2_SECRET_ACCESS_KEY"),
    },
  });

  await client.send(
    new PutObjectCommand({
      Bucket: getEnv("R2_BUCKET"),
      Key: key,
      Body: imageBuffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  const baseUrl = getEnv("R2_PUBLIC_BASE_URL").replace(/\/+$/, "");
  const publicUrl = `${baseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
  console.log(`  ↑ AI thumbnail generated → ${publicUrl}`);
  return publicUrl;
}