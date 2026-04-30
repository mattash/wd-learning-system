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

## Phase 3: AI thumbnail generation

*Planned — not yet implemented.*

Future versions may support `ai_thumbnail: true` on courses/modules/lessons, which would:
1. Generate an image via OpenAI DALL·E or Resend's image API
2. Upload the generated image to R2
3. Store the R2 URL in `thumbnail_url`

When implemented, usage would look like:

```yaml
course:
  title: "Foundations of Faith"
  ai_thumbnail: true   # generate image automatically
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