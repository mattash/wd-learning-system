import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient, type PostgrestError } from "@supabase/supabase-js";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

import { resolveAndUploadThumbnail } from "./lib/r2-uploader";
import {
  resolveAiThumbnail,
  isAiThumbnailUrl,
  type AiSubject,
  type AiPalette,
  type AiStyle,
  type AiTextPlacement,
} from "./lib/ai-thumbnails";

type CourseRow = {
  id: string;
  title: string;
};

type ModuleRow = {
  id: string;
  title: string;
};

type LessonRow = {
  id: string;
  title: string;
};

type QuestionRow = {
  id: string;
  prompt: string;
};

type SummaryQuestion = {
  id: string;
  prompt: string;
};

type SummaryLesson = {
  id: string;
  title: string;
  questions: SummaryQuestion[];
};

type SummaryModule = {
  id: string;
  title: string;
  lessons: SummaryLesson[];
};

type ImportSummary = {
  course: CourseRow;
  modules: SummaryModule[];
};

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yaml = require("js-yaml") as { load: (content: string) => any };

const red = (message: string) => `\u001b[31m${message}\u001b[0m`;
const green = (message: string) => `\u001b[32m${message}\u001b[0m`;

const optionalNullableStringSchema = z
  .string()
  .trim()
  .max(500)
  .nullish()
  .transform((value) => (value && value.length > 0 ? value : null));

const SAFE_URL_REGEX = /^[a-z][a-z0-9+.-]*:/i;

const optionalUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .nullish()
  .transform((value) => {
    if (!value || value.length === 0) return null;
    // Accept app-relative paths, AI generation marker, and absolute URLs
    if (
      value.startsWith("/") ||
      value.startsWith("https://") ||
      value.startsWith("http://") ||
      value.startsWith("ai://")
    ) {
      return value;
    }
    // Reject javascript:, data:, blob: and other dangerous schemes
    if (SAFE_URL_REGEX.test(value)) {
      throw new z.ZodError([{
        code: z.ZodIssueCode.custom,
        message: `Invalid URL scheme: '${value}'. Only '/', 'ai://', 'http://', and 'https://' are allowed.`,
        path: [],
      }]);
    }
    return value;
  });

const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

const questionSchema = z
  .object({
    prompt: z.string().trim().min(1),
    options: z.array(z.string().trim().min(1)).min(2, "Questions must have at least two options."),
    correct_option_index: z.number().int().min(0),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.correct_option_index >= value.options.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "correct_option_index must reference an existing option.",
        path: ["correct_option_index"],
      });
    }
  });

const lessonSchema = z
  .object({
    title: z.string().trim().min(1),
    descriptor: optionalNullableStringSchema,
    thumbnail_url: optionalUrlSchema,
    content_type: z.enum(["VIDEO", "DOCUMENT"]),
    youtube_video_id: optionalNullableStringSchema,
    document_url: optionalUrlSchema,
    document_page_start: z.number().int().min(1).nullish().transform((value) => value ?? null),
    document_page_end: z.number().int().min(1).nullish().transform((value) => value ?? null),
    passing_score: z.number().int().min(0).max(100).default(80),
    questions: z.array(questionSchema).default([]),
    // AI thumbnail generation
    ai_thumbnail: z.boolean().default(false),
    ai_subject: optionalNullableStringSchema,
    ai_text_placement: z
      .enum(["bottom-center", "top-center", "left-vertical", "right-vertical"])
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.content_type === "VIDEO" && !value.youtube_video_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "youtube_video_id is required for VIDEO lessons.",
        path: ["youtube_video_id"],
      });
    }

    if (value.content_type === "DOCUMENT" && !value.document_url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "document_url is required for DOCUMENT lessons.",
        path: ["document_url"],
      });
    }

    if (
      value.document_page_start !== null &&
      value.document_page_end !== null &&
      value.document_page_end < value.document_page_start
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "document_page_end must be greater than or equal to document_page_start.",
        path: ["document_page_end"],
      });
    }
  });

const moduleSchema = z
  .object({
    title: z.string().trim().min(1),
    descriptor: optionalNullableStringSchema,
    thumbnail_url: optionalUrlSchema,
    lessons: z.array(lessonSchema).default([]),
  })
  .strict();

const contentImportSchema = z
  .object({
    course: z
      .object({
        title: z.string().trim().min(1),
        description: optionalNullableStringSchema,
        thumbnail_url: optionalUrlSchema,
        published: z.boolean().default(false),
        scope: z.enum(["DIOCESE", "PARISH"]),
        modules: z.array(moduleSchema).default([]),
        // AI thumbnail generation
        ai_thumbnail: z.boolean().default(false),
        ai_palette: z.enum(["light", "dark", "vivid"]).optional(),
        ai_style: z
          .enum(["flat-illustration", "documentary", "editorial"])
          .optional(),
        ai_text_placement: z
          .enum(["bottom-center", "top-center", "left-vertical", "right-vertical"])
          .optional(),
        ai_style_notes: optionalNullableStringSchema,
      })
      .strict(),
  })
  .strict();

type ContentImport = z.infer<typeof contentImportSchema>;

function getProjectRoot() {
  const scriptFilePath = fileURLToPath(import.meta.url);
  return path.resolve(scriptFilePath, "..", "..");
}

function formatZodIssues(error: z.ZodError) {
  return error.issues
    .map((issue) => {
      const location = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `- ${location}: ${issue.message}`;
    })
    .join("\n");
}

function parseInput(filePath: string, content: string): unknown {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".json") {
    return JSON.parse(content) as unknown;
  }

  if (extension === ".yaml" || extension === ".yml") {
    return yaml.load(content);
  }

  throw new Error("Input file must be JSON, YAML, or YML.");
}

async function insertSingle<T>(
  query: PromiseLike<{ data: T | null; error: PostgrestError | null }>,
  label: string,
) {
  const { data, error } = await query;

  if (error) {
    const extra = error.code ? ` [${error.code}]` : "";
    const hint = error.hint ? ` HINT: ${error.hint}` : "";
    throw new Error(`${label} insert failed${extra}: ${error.message}${hint}`);
  }

  if (!data) {
    throw new Error(`${label} insert failed: Supabase returned no row.`);
  }

  return data;
}

async function importContent(
  content: ContentImport,
  options?: { strict?: boolean; aiPalette?: AiPalette; aiStyle?: AiStyle; aiTextPlacement?: AiTextPlacement },
): Promise<ImportSummary> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const courseInput = content.course;
  console.log(`Creating course: ${courseInput.title}`);

  // Build AI thumbnail options from YAML fields (course-level) with CLI flags as fallback
  const aiOpts = {
    palette: (courseInput.ai_palette ?? options?.aiPalette) ?? "vivid",
    style: (courseInput.ai_style ?? options?.aiStyle) ?? "flat-illustration",
    textPlacement:
      (courseInput.ai_text_placement ?? options?.aiTextPlacement) ?? "bottom-center",
    styleNotes: courseInput.ai_style_notes ?? undefined,
  };

  async function resolveThumbnail(
    thumbnailUrl: string | null,
    prefix: string,
    fallbackBaseName: string,
    aiSubject?: AiSubject,
    lessonTextPlacement?: AiTextPlacement,
  ): Promise<string | null> {
    if (isAiThumbnailUrl(thumbnailUrl) || (aiSubject && !thumbnailUrl)) {
      if (!aiSubject) {
        throw new Error(
          `thumbnail_url: "ai://" requires ai_thumbnail: true at the course or lesson level.`,
        );
      }
      return resolveAiThumbnail(aiSubject, prefix, {
        ...aiOpts,
        textPlacement: lessonTextPlacement ?? aiOpts.textPlacement,
      });
    }
    return resolveAndUploadThumbnail(thumbnailUrl, prefix, fallbackBaseName, options);
  }

  // Generate course-level AI subject (used for all lesson thumbnails in this course)
  const courseAiSubject: AiSubject | undefined = courseInput.ai_thumbnail
    ? {
        courseTitle: courseInput.title,
        lessonNumber: 0,
        lessonTitle: "Course Overview",
      }
    : undefined;

  const courseThumbnailUrl = await resolveThumbnail(
    courseInput.thumbnail_url,
    "course-thumbnails",
    courseInput.title,
    courseAiSubject,
  );

  const course = await insertSingle<CourseRow>(
    supabase
      .from("courses")
      .insert({
        title: courseInput.title,
        description: courseInput.description,
        thumbnail_url: courseThumbnailUrl,
        published: courseInput.published,
        scope: courseInput.scope,
      })
      .select("id,title")
      .single(),
    "Course",
  );

  const summary: ImportSummary = {
    course,
    modules: [],
  };

  for (const [moduleIndex, moduleInput] of courseInput.modules.entries()) {
    console.log(`Creating module ${moduleIndex + 1}/${courseInput.modules.length}: ${moduleInput.title}`);

    const moduleThumbnailUrl = await resolveThumbnail(
      moduleInput.thumbnail_url,
      "module-thumbnails",
      moduleInput.title,
    );

    const moduleRow = await insertSingle<ModuleRow>(
      supabase
        .from("modules")
        .insert({
          course_id: course.id,
          title: moduleInput.title,
          descriptor: moduleInput.descriptor,
          thumbnail_url: moduleThumbnailUrl,
          sort_order: moduleIndex,
        })
        .select("id,title")
        .single(),
      "Module",
    );

    const moduleSummary: SummaryModule = {
      ...moduleRow,
      lessons: [],
    };

    for (const [lessonIndex, lessonInput] of moduleInput.lessons.entries()) {
      console.log(`  Creating lesson ${lessonIndex + 1}/${moduleInput.lessons.length}: ${lessonInput.title}`);

      // Build lesson-level AI subject (carries course style + per-lesson overrides)
      const lessonAiSubject: AiSubject | undefined =
        courseInput.ai_thumbnail ||
        lessonInput.ai_thumbnail ||
        isAiThumbnailUrl(lessonInput.thumbnail_url)
          ? {
              courseTitle: courseInput.title,
              lessonNumber: lessonIndex + 1,
              lessonTitle: lessonInput.title,
              subject: lessonInput.ai_subject ?? undefined,
            }
          : undefined;

      const lessonThumbnailUrl = await resolveThumbnail(
        lessonInput.thumbnail_url,
        "lesson-thumbnails",
        lessonInput.title,
        lessonAiSubject,
        lessonInput.ai_text_placement ?? undefined,
      );

      const lesson = await insertSingle<LessonRow>(
        supabase
          .from("lessons")
          .insert({
            module_id: moduleRow.id,
            title: lessonInput.title,
            descriptor: lessonInput.descriptor,
            thumbnail_url: lessonThumbnailUrl,
            content_type: lessonInput.content_type,
            youtube_video_id: lessonInput.content_type === "VIDEO" ? lessonInput.youtube_video_id : null,
            document_url: lessonInput.content_type === "DOCUMENT" ? lessonInput.document_url : null,
            document_page_start: lessonInput.content_type === "DOCUMENT" ? lessonInput.document_page_start : null,
            document_page_end: lessonInput.content_type === "DOCUMENT" ? lessonInput.document_page_end : null,
            sort_order: lessonIndex,
            passing_score: lessonInput.passing_score,
          })
          .select("id,title")
          .single(),
        "Lesson",
      );

      // Validate YouTube ID format if present
      if (lessonInput.youtube_video_id && !YOUTUBE_ID_REGEX.test(lessonInput.youtube_video_id)) {
        throw new Error(
          `Invalid YouTube video ID '${lessonInput.youtube_video_id}' for lesson '${lessonInput.title}'. ` +
          "YouTube IDs are 11 characters (e.g. dQw4w9WgXcQ).",
        );
      }

      const lessonSummary: SummaryLesson = {
        ...lesson,
        questions: [],
      };

      for (const [questionIndex, questionInput] of lessonInput.questions.entries()) {
        console.log(`    Creating question ${questionIndex + 1}/${lessonInput.questions.length}`);

        const question = await insertSingle<QuestionRow>(
          supabase
            .from("questions")
            .insert({
              lesson_id: lesson.id,
              prompt: questionInput.prompt,
              options: questionInput.options,
              correct_option_index: questionInput.correct_option_index,
              sort_order: questionIndex,
            })
            .select("id,prompt")
            .single(),
          "Question",
        );

        lessonSummary.questions.push(question);
      }

      moduleSummary.lessons.push(lessonSummary);
    }

    summary.modules.push(moduleSummary);
  }

  return summary;
}

function printSummary(summary: ImportSummary) {
  console.log("");
  console.log(green("Content import complete."));
  console.log(`Course ID: ${summary.course.id}`);
  console.log(`Course title: ${summary.course.title}`);
  console.log("");

  console.table(
    summary.modules.map((module) => ({
      Module: module.title,
      "Module ID": module.id,
      "Lesson IDs": module.lessons.map((lesson) => lesson.id).join("\n"),
      "Question IDs": module.lessons
        .flatMap((lesson) => lesson.questions.map((question) => question.id))
        .join("\n"),
    })),
  );
}

async function main() {
  const filePathArg = process.argv[2];
  const strict = process.argv.includes("--strict");
  const dryRun = process.argv.includes("--dry-run");

  const parseAiFlag = (name: string, validValues: string[]): string | undefined => {
    const idx = process.argv.indexOf(`--ai-${name}`);
    if (idx < 0) return undefined;
    const value = process.argv[idx + 1];
    if (!validValues.includes(value)) {
      throw new Error(
        `Invalid --ai-${name}: '${value}'. Must be one of: ${validValues.join(", ")}`,
      );
    }
    return value;
  };
  const aiPalette = parseAiFlag("palette", ["light", "dark", "vivid"]) as AiPalette | undefined;
  const aiStyle = parseAiFlag("style", ["flat-illustration", "documentary", "editorial"]) as AiStyle | undefined;
  const aiTextPlacement = parseAiFlag("text-placement", ["bottom-center", "top-center", "left-vertical", "right-vertical"]) as AiTextPlacement | undefined;

  if (!filePathArg) {
    throw new Error(
      "Usage: npm run content:import -- <path> [--strict] [--dry-run] [--ai-palette <light|dark|vivid>] [--ai-style <flat-illustration|documentary|editorial>] [--ai-text-placement <bottom-center|top-center|left-vertical|right-vertical>]",
    );
  }

  const projectRoot = getProjectRoot();
  loadDotenv({ path: path.join(projectRoot, ".env.local") });

  const inputPath = path.resolve(process.cwd(), filePathArg);
  let rawContent: string;
  try {
    rawContent = await readFile(inputPath, "utf8");
  } catch (err) {
    console.error(red(`Could not read file "${inputPath}": ${(err as Error).message}`));
    process.exit(1);
  }

  const parsedContent = parseInput(inputPath, rawContent);
  const content = contentImportSchema.parse(parsedContent);

  if (dryRun) {
    console.log(green("\n=== DRY RUN — no database writes or uploads will occur ===\n"));
    const courseAiNote = content.course.ai_thumbnail || isAiThumbnailUrl(content.course.thumbnail_url)
      ? " [AI thumbnail]"
      : "";
    console.log(`Course:        ${content.course.title}${courseAiNote}`);
    console.log(`Scope:         ${content.course.scope}`);
    console.log(`Published:     ${content.course.published}`);
    console.log(`AI thumbnails: ${content.course.ai_thumbnail || isAiThumbnailUrl(content.course.thumbnail_url) ? "enabled" : "disabled"}`);
    if (content.course.ai_thumbnail) {
      console.log(
        `AI style:      ${content.course.ai_palette ?? aiPalette ?? "vivid"} / ${content.course.ai_style ?? aiStyle ?? "flat-illustration"} / ${content.course.ai_text_placement ?? aiTextPlacement ?? "bottom-center"}`,
      );
    }
    console.log("");
    let totalLessons = 0;
    let totalQuestions = 0;
    for (const [mi, mod] of content.course.modules.entries()) {
      console.log(`  [Module ${mi + 1}] ${mod.title}`);
      for (const [li, lesson] of mod.lessons.entries()) {
        totalLessons++;
        totalQuestions += lesson.questions.length;
        const aiNote =
          lesson.ai_thumbnail || isAiThumbnailUrl(lesson.thumbnail_url)
            ? " [AI thumbnail]"
            : "";
        console.log(`    Lesson ${li + 1}: ${lesson.title}${aiNote}`);
      }
    }
    console.log("");
    console.log(`Total: ${content.course.modules.length} modules, ${totalLessons} lessons, ${totalQuestions} questions`);
    console.log(green("\n=== DRY RUN complete — no changes made ===\n"));
    return;
  }

  const options = { strict, aiPalette, aiStyle, aiTextPlacement };
  let summary: ImportSummary | undefined;
  try {
    summary = await importContent(content, options);
    printSummary(summary);
  } catch (err) {
    // Best-effort cleanup: delete the partially-created course so retry is clean
    if (summary?.course?.id) {
      console.error(red(`\nImport failed — cleaning up course ${summary.course.id}...`));
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        await supabase.from("courses").delete().eq("id", summary.course.id);
        console.error(red("Cleanup done. Delete manually if cascade missed any rows."));
      } catch {
        // best-effort — don't mask the original error
      }
    }
    throw err;
  }
}

main().catch((error: unknown) => {
  if (error instanceof z.ZodError) {
    console.error(red("Input validation failed:"));
    console.error(formatZodIssues(error));
  } else if (error instanceof SyntaxError) {
    console.error(red(`Failed to parse JSON: ${error.message}`));
  } else if (error instanceof Error) {
    console.error(red(error.message));
  } else {
    console.error(red("Unknown content import failure."));
  }

  process.exit(1);
});
