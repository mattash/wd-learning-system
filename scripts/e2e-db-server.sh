#!/usr/bin/env bash
#
# Bootstraps a real local Supabase stack and serves the app for the
# DB-backed Playwright suite (`npm run test:e2e:db`).
#
# Unlike the fixture smoke suite, this does NOT set E2E_SMOKE_MODE, so all
# repository code hits the real database, RLS policies, and RPC functions.
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
supabase db reset --yes \
  --sql-paths seed.sql \
  --sql-paths e2e-db-seed.sql

# Point the app at the local stack. `supabase status -o env` emits
# SERVICE_ROLE_KEY and the API URL; the REST endpoint is the default kong
# port when running locally.
export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-http://127.0.0.1:54321}"
export SUPABASE_SERVICE_ROLE_KEY="$(supabase status -o env | sed -n 's/^SERVICE_ROLE_KEY="\(.*\)"$/\1/p')"
export E2E_AUTH_BYPASS=1
unset E2E_SMOKE_MODE
unset E2E_SMOKE_MODE_ACK

exec npm run dev -- --port 3101
