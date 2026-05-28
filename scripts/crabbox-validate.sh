#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$ROOT_DIR/.crabbox.slug.conf"

usage() {
  cat <<'USAGE'
Usage: scripts/crabbox-validate.sh <job> [--dry-run]

Jobs:
  lint
  typecheck
  test
  coverage
  ci
  e2e
USAGE
}

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Missing $CONFIG_FILE" >&2
  exit 1
fi

# shellcheck source=/dev/null
source "$CONFIG_FILE"

: "${CRABBOX_SLUG:?CRABBOX_SLUG is required in $CONFIG_FILE}"

JOB="${1:-}"
DRY_RUN="${2:-}"

case "$JOB" in
  lint|typecheck|test|coverage|ci|e2e)
    ;;
  -h|--help|help|"")
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

if [ "$DRY_RUN" != "" ] && [ "$DRY_RUN" != "--dry-run" ]; then
  usage >&2
  exit 2
fi

cd "$ROOT_DIR"

if [ "$DRY_RUN" = "--dry-run" ]; then
  printf 'scripts/crabbox-box.sh warm\n'
  printf 'crabbox job run --id %q --stop never %q\n' "$CRABBOX_SLUG" "$JOB"
  exit 0
fi

scripts/crabbox-box.sh warm
crabbox job run --id "$CRABBOX_SLUG" --stop never "$JOB"
