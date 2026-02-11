# Western Diocese LMS (MVP)

Multi-tenant Learning Management System built with Next.js + Clerk + Supabase for parish-scoped learning and analytics.

## Stack
- Next.js (App Router) + TypeScript + Tailwind
- Clerk hosted auth
- Supabase Postgres (schema/migrations)
- React Query
- Zod validation
- Vitest for grading logic tests

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
npm run lint
npm run typecheck
```
