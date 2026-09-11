#!/usr/bin/env bash
#
# Bootstraps a real local Supabase stack and serves the app for the
# DB-backed Playwright suite (`npm run test:e2e:db`).
#
# Unlike the fixture smoke suite, this does NOT set E2E_SMOKE_MODE, so all
# repository code hits the real database schema and RPC functions.
# Only Clerk sign-in is bypassed via E2E_AUTH_BYPASS.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Bring the local stack up if it isn't already running (idempotent).
# Only the database + REST API are needed; skip Studio/storage/edge/etc.
if ! supabase status >/dev/null 2>&1; then
  supabase start --yes \
    --exclude studio,storage,edge-runtime,imgproxy,realtime,vector,analytics,inbucket,meta,functions,mailpit,pooler
fi

# Reset to the current migrations and seed both the base fixtures and the
# E2E entities that mirror src/lib/e2e-fixtures.ts.
#
# WARNING: this wipes the local Supabase database. Point it at a stack you
# don't mind resetting (it is the same `supabase start` project a dev uses
# day-to-day).
supabase db reset --yes \
  --sql-paths seed.sql \
  --sql-paths e2e-db-seed.sql

# Point the app at the local stack, reading the URL/key from `supabase status`
# so a non-default port still works. Fail loudly if parsing misses.
export NEXT_PUBLIC_SUPABASE_URL="$(supabase status -o env | sed -n 's/^API_URL="\(.*\)"$/\1/p')"
export SUPABASE_SERVICE_ROLE_KEY="$(supabase status -o env | sed -n 's/^SERVICE_ROLE_KEY="\(.*\)"$/\1/p')"
: "${NEXT_PUBLIC_SUPABASE_URL:?failed to read API_URL from supabase status}"
: "${SUPABASE_SERVICE_ROLE_KEY:?failed to read SERVICE_ROLE_KEY from supabase status}"
export E2E_AUTH_BYPASS=1
unset E2E_SMOKE_MODE
unset E2E_SMOKE_MODE_ACK

exec npm run dev -- --port 3101
