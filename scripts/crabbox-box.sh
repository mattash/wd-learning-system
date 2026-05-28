#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$ROOT_DIR/.crabbox.slug.conf"
LOCK_DIR="$ROOT_DIR/.crabbox/warmup.lock"

usage() {
  cat <<'USAGE'
Usage: scripts/crabbox-box.sh <command>

Commands:
  warm     Ensure the repo's reusable Crabbox lease is ready
  status   Show the reusable Crabbox lease status
  stop     Release the reusable Crabbox lease
  slug     Print the reusable Crabbox lease slug
USAGE
}

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Missing $CONFIG_FILE" >&2
  exit 1
fi

# shellcheck source=/dev/null
source "$CONFIG_FILE"

: "${CRABBOX_SLUG:?CRABBOX_SLUG is required in $CONFIG_FILE}"
: "${CRABBOX_IDLE_TIMEOUT:=45m}"
: "${CRABBOX_TTL:=4h}"
: "${CRABBOX_CLASS:=standard}"

ensure_crabbox() {
  if ! command -v crabbox >/dev/null 2>&1; then
    echo "crabbox CLI is not installed or not on PATH" >&2
    exit 1
  fi
}

lease_ready() {
  crabbox status --id "$CRABBOX_SLUG" --wait --wait-timeout 10s >/dev/null 2>&1
}

with_warmup_lock() {
  mkdir -p "$ROOT_DIR/.crabbox"

  local waited=0
  until mkdir "$LOCK_DIR" 2>/dev/null; do
    if [ "$waited" -ge 300 ]; then
      echo "Timed out waiting for Crabbox warmup lock: $LOCK_DIR" >&2
      exit 1
    fi
    sleep 2
    waited=$((waited + 2))
  done

  trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT
}

warm() {
  ensure_crabbox

  if lease_ready; then
    echo "Crabbox lease is ready: $CRABBOX_SLUG"
    return
  fi

  with_warmup_lock

  if lease_ready; then
    echo "Crabbox lease is ready: $CRABBOX_SLUG"
    return
  fi

  crabbox warmup \
    --slug "$CRABBOX_SLUG" \
    --idle-timeout "$CRABBOX_IDLE_TIMEOUT" \
    --ttl "$CRABBOX_TTL" \
    --class "$CRABBOX_CLASS"
}

case "${1:-}" in
  warm)
    warm
    ;;
  status)
    ensure_crabbox
    crabbox status --id "$CRABBOX_SLUG"
    ;;
  stop)
    ensure_crabbox
    crabbox stop "$CRABBOX_SLUG"
    ;;
  slug)
    printf '%s\n' "$CRABBOX_SLUG"
    ;;
  -h|--help|help|"")
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
