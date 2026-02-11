# Testing Foundation

## Objectives
- Keep test structure scalable as features expand.
- Make critical user workflows safe to refactor.
- Keep fast feedback in local and CI runs.

## Current layers
- Unit: pure logic and helpers in `src/lib/__tests__`.
- Component: UI behavior in `src/components/**/__tests__`.
- E2E smoke: browser flow checks in `e2e/**` (Playwright).
- Shared setup: `src/test/setup.ts`.

## Conventions
- Name tests `*.test.ts` or `*.test.tsx`.
- Prefer behavior assertions over implementation details.
- For UI tests, assert user-visible output and interactions.
- Reset side effects in shared setup (DOM cleanup, localStorage).

## Quality gates
- Required checks on every change:
  - `npm run test`
  - `npm run test:coverage`
  - `npm run test:e2e`
  - `npm run lint`
  - `npm run typecheck`

Coverage gates:
- Coverage is enforced in `vitest.config.ts` with minimum thresholds for statements, branches, functions, and lines.
- CI runs `npm run test:coverage` in the test job.

E2E mode:
- Playwright smoke tests run against a deterministic server mode (`E2E_SMOKE_MODE=1`) to avoid external auth/database dependencies in CI.

## Next phase
- Expand API route integration tests to include validation failures and auth/authorization edge cases.
- Add more e2e smoke scenarios (parish switching, admin membership workflow, progress persistence checks).
- Add PR annotations for failed test artifacts and traces for faster triage.
