# Western Diocese LMS

Multi-tenant Learning Management System built with Next.js + Clerk + Supabase for parish-scoped learning and analytics.

## Stack
- Next.js (App Router) + TypeScript + Tailwind
- Clerk hosted auth
- Supabase Postgres (schema/migrations)
- React Query
- Zod validation
- Vitest + Testing Library for unit/component tests

## Multi-tenant approach
This MVP uses **server-only Supabase access** via service role key.
- Browser does **not** query Supabase directly.
- Clerk identifies user in Next.js server routes/actions.
- Tenant (`active_parish_id`) is stored in an HTTP-only cookie.
- Authorization is enforced in app-layer guards (`requireAuth`, `requireActiveParish`, `requireParishRole`, `requireDioceseAdmin`) and DB constraints.
- RLS is enabled on all tables and direct anon/authenticated access is denied; only server-side service role can access DB.

## Features
- First-login onboarding to complete profile and select a self-signup parish (`/app/onboarding`).
- Parish switching/joining for self-signup parishes (`/app/select-parish`).
- Diocese-wide + parish-scoped courses.
- Lesson pages with YouTube IFrame API player.
- Video progress tracking (every 10s while playing, pause/end/unload flush).
- Quiz attempts graded server-side.
- Best score tracking per `(parish, user, lesson)`.
- Diocese and parish analytics pages.
- Diocese membership tool (`/app/admin/memberships`) to add diocese admin + parish memberships.

## Database
- Migration: `supabase/migrations/0001_init.sql`
- Seed: `supabase/seed.sql`

Apply in Supabase SQL editor (or CLI):
1. Run migration SQL.
2. Run seed SQL.

## Environment variables
Create `.env.local`:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
# Optional; defaults to https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
R2_ENDPOINT=
# Optional; recommended for serving public thumbnails (CDN/custom domain)
R2_PUBLIC_BASE_URL=
# Optional
R2_REGION=auto
UPLOAD_MAX_IMAGE_BYTES=5242880
```

## Local development
```bash
npm install
npm run dev
```

If `npm run build` still reports a missing Clerk publishable key, ensure the key is available to the build process (for example in your shell, `.env.local`, or Vercel project env settings).

Then open http://localhost:3000.

## Bootstrap first diocese admin
1. Sign in with Clerk user.
2. In Supabase SQL editor:
```sql
insert into diocese_admins (clerk_user_id) values ('<your_clerk_user_id>')
on conflict (clerk_user_id) do nothing;
```
3. Visit `/app/admin/memberships` to assign parish memberships/roles.

## Parish self-signup controls
- `parishes.allow_self_signup` controls whether users can join a parish during onboarding and from `/app/select-parish`.
- New users create their own `student` parish membership during onboarding.
- Diocese admins can still assign elevated roles (`instructor`, `parish_admin`) from `/app/admin/memberships`.

## Testing
```bash
npm run test
npm run test:coverage
npm run test:e2e
npm run lint
npm run typecheck
```

Testing conventions:
- Place tests near the code under `__tests__`.
- Keep pure logic tests in `src/lib/__tests__`.
- Keep component tests in `src/components/**/__tests__`.
- Keep e2e smoke tests in `e2e/**`.
- Shared setup lives in `src/test/setup.ts`.
- Coverage thresholds are enforced via Vitest config and CI.

## Design system foundation
- Tokens are centralized in `src/app/globals.css`.
- Theme uses semantic variables (`background`, `foreground`, `card`, `muted`, `border`, `primary`, `destructive`) rather than hardcoded palette classes in feature code.
- Active theme is set with `data-theme` on `html` and toggled from `src/components/theme-toggle.tsx`.
- Reusable primitives start in `src/components/ui` (`Button` now supports variant + size APIs).
- ESLint guardrail prevents hardcoded Tailwind palette classes in feature code (`design-system/no-hardcoded-tailwind-palette`).

This foundation is intended for migration to shadcn/Radix primitives without replacing the token model.
