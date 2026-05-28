#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$ROOT_DIR/.crabbox.slug.conf"
LOCK_DIR="$ROOT_DIR/.crabbox/warmup.lock"
STATE_FILE="$ROOT_DIR/.crabbox/active-lease.env"

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

load_active_lease() {
  if [ -f "$STATE_FILE" ]; then
    # shellcheck source=/dev/null
    source "$STATE_FILE"
  fi
}

lease_refs() {
  load_active_lease

  if [ "${CRABBOX_ACTIVE_LEASE_ID:-}" != "" ]; then
    printf '%s\n' "$CRABBOX_ACTIVE_LEASE_ID"
  fi

  if [ "${CRABBOX_ACTIVE_SLUG:-}" != "" ]; then
    printf '%s\n' "$CRABBOX_ACTIVE_SLUG"
  fi

  printf '%s\n' "$CRABBOX_SLUG"
}

active_lease_ref() {
  local ref

  while IFS= read -r ref; do
    if [ "$ref" = "" ]; then
      continue
    fi

    if crabbox status --id "$ref" --wait --wait-timeout 10s >/dev/null 2>&1; then
      printf '%s\n' "$ref"
      return 0
    fi
  done < <(lease_refs)

  return 1
}

write_active_lease() {
  local output="$1"
  local lease_id
  local slug

  lease_id="$(printf '%s\n' "$output" | sed -n 's/.*leased \(cbx_[^ ]*\).*/\1/p' | tail -n 1)"
  slug="$(printf '%s\n' "$output" | sed -n 's/.*slug=\([^ ]*\).*/\1/p' | tail -n 1)"

  if [ "$lease_id" = "" ]; then
    return
  fi

  mkdir -p "$ROOT_DIR/.crabbox"
  {
    printf 'CRABBOX_ACTIVE_LEASE_ID=%q\n' "$lease_id"
    if [ "$slug" != "" ]; then
      printf 'CRABBOX_ACTIVE_SLUG=%q\n' "$slug"
    fi
  } > "$STATE_FILE"
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

  local ref
  if ref="$(active_lease_ref)"; then
    echo "Crabbox lease is ready: $ref"
    return
  fi

  with_warmup_lock

  if ref="$(active_lease_ref)"; then
    echo "Crabbox lease is ready: $ref"
    return
  fi

  local output
  output="$(crabbox warmup \
    --slug "$CRABBOX_SLUG" \
    --idle-timeout "$CRABBOX_IDLE_TIMEOUT" \
    --ttl "$CRABBOX_TTL" \
    --class "$CRABBOX_CLASS" 2>&1)"
  printf '%s\n' "$output"
  write_active_lease "$output"
}

case "${1:-}" in
  warm)
    warm
    ;;
  status)
    ensure_crabbox
    if ref="$(active_lease_ref)"; then
      crabbox status --id "$ref"
    else
      crabbox status --id "$CRABBOX_SLUG"
    fi
    ;;
  stop)
    ensure_crabbox
    if ref="$(active_lease_ref)"; then
      crabbox stop "$ref"
      rm -f "$STATE_FILE"
    else
      crabbox stop "$CRABBOX_SLUG"
    fi
    ;;
  slug)
    if ref="$(active_lease_ref)"; then
      printf '%s\n' "$ref"
    else
      printf '%s\n' "$CRABBOX_SLUG"
    fi
    ;;
  -h|--help|help|"")
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
