# Content Import CLI

Bulk-import course content (courses, modules, lessons, quiz questions) from a YAML or JSON file into the database.

## Quick start

```bash
npm run content:import -- scripts/example-course.yaml
npm run content:import -- scripts/my-course.json
```

## CLI reference

```bash
npm run content:import -- <path-to-file> [options]
```

### Arguments

| Argument | Description |
|---|---|
| `<path-to-file>` | Path to a `.yaml`, `.yml`, or `.json` file |

### Options

| Flag | Description |
|---|---|
| `--strict` | Validate that all external `thumbnail_url` values return HTTP 2xx before inserting. Fails fast with clear error messages. |

## Input schema (YAML example)

```yaml
course:
  title: "Course Title"
  description: "Optional course description"
  thumbnail_url: "/globe.svg"         # local file, R2 upload, or https:// URL
  published: false                   # false = draft, true = live
  scope: "DIOCESE"                   # DIOCESE or PARISH

  modules:
    - title: "Module Title"
      descriptor: "Optional module description"
      thumbnail_url: "/window.svg"

      lessons:
        - title: "Lesson Title"
          descriptor: "Optional description"
          thumbnail_url: "/next.svg"
          content_type: "VIDEO"      # VIDEO or DOCUMENT
          youtube_video_id: "dQw4w9WgXcQ"
          passing_score: 80

          questions:
            - prompt: "What is...?"
              options:
                - "Option A"
                - "Option B"
                - "Option C"
              correct_option_index: 1   # 0-based index
```

## Thumbnail handling

The importer handles `thumbnail_url` at course, module, and lesson levels differently depending on the URL type:

### Local files (recommended for development)

Files placed in the `public/` directory are uploaded to Cloudflare R2 automatically:

```yaml
course:
  thumbnail_url: "/globe.svg"   # resolved to public/globe.svg
```

The file is read, uploaded to R2 under the appropriate prefix, and the `thumbnail_url` stored in the database is replaced with the R2 CDN URL.

| Context | R2 prefix |
|---|---|
| Course thumbnails | `course-thumbnails/` |
| Module thumbnails | `module-thumbnails/` |
| Lesson thumbnails | `lesson-thumbnails/` |

The stored URL is built from `R2_PUBLIC_BASE_URL` (e.g. `https://cdn.example.com/course-thumbnails/<uuid>-basename.jpg`).

### External URLs

URLs starting with `https://` or `http://` are stored as-is and **not** uploaded to R2:

```yaml
course:
  thumbnail_url: "https://images.unsplash.com/photo-example.jpg"
```

With `--strict`, the importer first performs a `HEAD` request to verify the URL is accessible. If the URL returns a non-2xx status or times out, the import fails with a clear error message:

```
External thumbnail URL is inaccessible (404): https://example.com/bad-image.jpg
```

### Supported image formats

| Extension | Content-Type |
|---|---|
| `.jpg` / `.jpeg` | `image/jpeg` |
| `.png` | `image/png` |
| `.webp` | `image/webp` |
| `.gif` | `image/gif` |
| `.svg` | `image/svg+xml` |

All uploaded thumbnails are set with `Cache-Control: public, max-age=31536000, immutable` for permanent browser caching.

## Environment variables

The CLI requires the same Supabase + R2 variables as the app:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET=wd-learning-system
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_PUBLIC_BASE_URL=https://cdn.your-domain.com   # or R2.dev preview URL
R2_REGION=auto
```

Place these in `.env.local` at the project root — the CLI loads them via `dotenv`.

## Phase 3: AI thumbnail generation (GPT Image 2.0)

The importer can generate thumbnails via [OpenAI's GPT Image 2.0 model](https://platform.openai.com/docs/guides/image-generation) when `ai_thumbnail: true` is set at the course level. The model renders text directly into images with consistent visual styling across all lessons in a course.

### Enabling AI thumbnails

**YAML (course-level)** — applies to all lessons unless overridden:

```yaml
course:
  title: "Foundations of Faith"
  ai_thumbnail: true
  ai_palette: vivid            # light | dark | vivid (default: vivid)
  ai_style: flat-illustration  # flat-illustration | documentary | editorial (default: flat-illustration)
  ai_text_placement: bottom-center  # bottom-center | top-center | left-vertical | right-vertical (default: bottom-center)
  ai_style_notes: "Armenian Cross geometry in background"  # optional extra direction
```

**YAML (lesson-level)** — overrides for a specific lesson:

```yaml
lessons:
  - title: "The Holy Trinity"
    ai_thumbnail: true
    ai_subject: "triquetra knot illuminated by golden light"
    ai_text_placement: top-center
```

**CLI flags** — set defaults for all AI thumbnails in the import:

```bash
npm run content:import -- scripts/course.yaml \
  --ai-palette dark \
  --ai-style editorial \
  --ai-text-placement bottom-center
```

CLI flags are overridden by YAML course-level values, which are overridden by lesson-level values.

**Environment variable:**

```bash
OPENAI_API_KEY=sk-proj-...   # add to .env.local
```

### Style matrix

| Palette | Description |
|---|---|
| `light` | Warm cream/parchment background, muted jewel-tone accents in deep teal and burgundy, soft natural lighting |
| `dark` | Deep navy/charcoal background, gold and cream accents, dramatic contrast |
| `vivid` | Saturated bold colors — royal blue, crimson, gold — high energy yet respectful |

| Artistic style | Description |
|---|---|
| `flat-illustration` | Iconographic, clean geometric edges, Armenian religious art influence, symbolic imagery, strong shapes |
| `documentary` | Photorealistic, rich depth, naturalistic lighting, textured surfaces, warm and reverent |
| `editorial` | Bold graphic layout, layered composition, magazine-style spacing, strong hierarchy |

| Text placement | Effect |
|---|---|
| `bottom-center` | Course name and lesson title on a semi-transparent dark bar along the bottom edge, horizontally centered |
| `top-center` | Same at top edge |
| `left-vertical` | Course name stacked above lesson title on the left edge, white text on semi-transparent background |
| `right-vertical` | Same on the right edge |

### How it works

1. At import start, the course-level `ai_palette` + `ai_style` + `ai_text_placement` is resolved once and used as the consistent style for all AI-generated thumbnails in that course.
2. For each lesson with `thumbnail_url: "ai://"` or `ai_thumbnail: true`, the importer calls the OpenAI GPT Image 2.0 API with a prompt built from:
   - Course title, lesson number, and lesson title
   - Palette description (colors, lighting)
   - Artistic style description
   - Text placement instruction (instructs the model to render text in the specified location)
   - Optional `ai_subject` override describing what to depict
   - Optional `ai_style_notes` for extra direction
3. The generated image (PNG) is uploaded to Cloudflare R2 under the appropriate prefix (`course-thumbnails/`, `lesson-thumbnails/`).
4. The R2 CDN URL is stored as `thumbnail_url` in the database.

### Example prompt (GPT Image 2.0)

```
"Foundations of Faith" — Lesson 2: The Holy Trinity.
Subject to depict: triquetra knot illuminated by golden light.
Style: Saturated bold colors — royal blue, crimson, gold — high energy yet respectful, clean visual impact. Flat iconographic illustration. Clean geometric edges. Symbolic religious imagery (Armenian art influence). No photorealism. Strong shapes, minimal shading.
Text placement: Course name and lesson title rendered as bold text on a semi-transparent dark bar at the bottom edge of the thumbnail, horizontally centered. No other text.
No logos, no watermarks, no photographs of real people.
Square aspect ratio (1:1).
```

## Troubleshooting

**"Local thumbnail not found at '/globe.svg'"**
Place the file in `public/globe.svg` before importing. The importer resolves paths relative to the project root's `public/` directory.

**Import fails with 403 on R2 upload**
Check that `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` have write permission on the bucket.

**Partial import — course exists but is incomplete**
The importer attempts best-effort cleanup of a partially-created course on failure. If cascade didn't catch all child rows, delete the course record manually in the Supabase SQL editor:

```sql
delete from courses where id = '<course-id>';
```