#!/usr/bin/env bash
#
# Fails if any file under supabase/migrations was deleted, renamed, or
# content-modified relative to the base branch. Applied migrations are
# append-only: rewrites break remote schema_migrations tracking and can
# silently un-apply or double-apply work (see issue #75).
#
# The only allowed change is ADDING a new migration file.
#
# Deliberate, reviewed history repairs can override this once:
#   ALLOW_MIGRATION_REWRITE=1 npm run check:migrations
# ...and must explain the repair in the PR description.
#
# Usage: scripts/check-migrations.sh [base-ref]   (default: origin/main)
set -euo pipefail

BASE="${1:-origin/main}"

if ! git rev-parse --verify --quiet "$BASE" >/dev/null; then
  echo "check:migrations: base ref '$BASE' not found — fetch it first" >&2
  exit 1
fi

# Diff base -> working tree (not base -> HEAD) so uncommitted local edits
# are caught too, matching how CI sees committed rewrites.
CHANGES=$(git diff --name-status "$BASE" -- supabase/migrations/)

if [ -z "$CHANGES" ]; then
  echo "check:migrations: no migration changes — OK"
  exit 0
fi

# Anything that is not a pure addition (M/R/D/C/T or R100-style rename scores)
# is a history rewrite.
BAD=$(printf '%s\n' "$CHANGES" | awk '$1 !~ /^A/ {print}')

if [ -n "$BAD" ] && [ "${ALLOW_MIGRATION_REWRITE:-0}" != "1" ]; then
  {
    echo "check:migrations: migration history rewrite detected:"
    echo
    printf '%s\n' "$BAD"
    echo
    echo "Applied migrations are append-only. Renaming, renumbering, or"
    echo "editing an applied migration breaks remote schema_migrations"
    echo "tracking (issue #75). To change schema, add a NEW migration file."
    echo
    echo "If this is a deliberate, reviewed history repair, re-run with"
    echo "ALLOW_MIGRATION_REWRITE=1 and explain it in the PR description."
  } >&2
  exit 1
fi

echo "check:migrations: additions only — OK"