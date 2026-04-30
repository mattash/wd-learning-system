import { randomUUID } from "node:crypto";

import { uploadBufferToR2 } from "./r2-uploader";

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
  // Read lazily so dotenv has loaded before this is called
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env.local to enable AI thumbnail generation.",
    );
  }

  const prompt = buildPrompt({ subject: params, ...opts });

  // Try gpt-image-2 first; fall back to gpt-image-1 if org not verified (403)
  const modelsToTry = ["gpt-image-2", "gpt-image-1"] as const;
  let lastError = "";

  for (const model of modelsToTry) {
    const response = await fetch(OPENAI_IMAGES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, prompt, n: 1, size: "1024x1024" }),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        data: Array<{ b64_json?: string; url?: string }>;
      };

      const item = data.data?.[0];
      if (!item) {
        throw new Error("OpenAI returned no image data in response.");
      }

      if (item.b64_json) {
        const buffer = Buffer.from(item.b64_json, "base64");
        console.log(`  [AI] Generated thumbnail with model: ${model}`);
        return { imageBuffer: buffer, contentType: "image/png" };
      }

      if (item.url) {
        const imageResponse = await fetch(item.url);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch generated image: ${imageResponse.status}`);
        }
        const buffer = Buffer.from(await imageResponse.arrayBuffer());
        console.log(`  [AI] Generated thumbnail with model: ${model}`);
        return { imageBuffer: buffer, contentType: "image/png" };
      }

      throw new Error("OpenAI returned no usable image data (no b64_json or url).");
    }

    const errorBody = await response.text();
    lastError = `OpenAI images API error ${response.status}: ${errorBody}`;

    // Only retry with gpt-image-1 if gpt-image-2 returned a 403 (org not verified)
    if (response.status !== 403) {
      throw new Error(lastError);
    }
    // else: try next model
  }

  throw new Error(`All image models failed. Last error: ${lastError}`);
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

  const publicUrl = await uploadBufferToR2(imageBuffer, key, contentType);
  console.log(`  ↑ AI thumbnail generated → ${publicUrl}`);
  return publicUrl;
}
