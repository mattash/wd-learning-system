# Repository Guidelines

## Project Structure & Module Organization
- `src/app`: Next.js App Router pages, layouts, and API routes (`src/app/api/**/route.ts`).
- `src/components`: reusable UI and feature components; shared primitives live in `src/components/ui`.
- `src/lib`: core business logic, authz guards, repositories, validation, and helpers.
- Tests are colocated in `__tests__` folders; browser smoke tests are in `e2e/*.spec.ts`.
- `supabase/migrations` stores schema changes and `supabase/seed.sql` contains seed data.
- `docs/` captures design/testing decisions; `public/` holds static assets.

## Build, Test, and Development Commands
- `npm run dev`: run the local Next.js dev server.
- `npm run build` and `npm run start`: build and run production mode.
- `npm run lint`: run ESLint (Next.js + TypeScript + design-system rules).
- `npm run typecheck`: run strict TypeScript checks (`tsc --noEmit`).
- `npm run test`: run unit/component tests with Vitest.
- `npm run test:coverage`: run tests with enforced coverage thresholds.
- `npm run test:e2e`: run Playwright smoke tests.
- `npm run db:start`, `npm run db:stop`, `npm run db:push`: manage local Supabase.

## Coding Style & Naming Conventions
- Use TypeScript-first, strict-safe code; validate route inputs with Zod.
- Follow existing formatting: 2-space indentation, double quotes, and trailing commas.
- Use PascalCase for React components and exported types; use kebab-case for utility/component file names.
- Prefer `@/` imports for modules under `src`.
- Avoid hardcoded Tailwind palette classes in feature code; use semantic tokens defined in `src/app/globals.css`.

## Testing Guidelines
- Frameworks: Vitest + Testing Library (`jsdom`) and Playwright for e2e.
- Test file names must be `*.test.ts` or `*.test.tsx`.
- Keep tests near the code they cover under `__tests__`.
- Coverage minimums (Vitest): statements 85, branches 70, functions 80, lines 85.
- GitHub branch protections enforce these minimums; do not lower thresholds to pass CI. Add or improve tests when coverage regresses.
- Before opening a PR, run: `npm run lint && npm run typecheck && npm run test:coverage && npm run test:e2e`.

## Commit & Pull Request Guidelines
- Match current commit style: short, imperative, sentence-case subjects (example: `Build scalable test and design-system foundations`).
- Keep commits focused; include related docs/migrations when behavior changes.
- PRs should include scope, affected routes/modules, and test evidence (commands run).
- Add screenshots or recordings for UI changes and link the related issue/ticket.

## Security & Configuration Tips
- Keep secrets in `.env.local` only; never commit credentials.
- Required environment values include Clerk keys and the Supabase service role key.
