#!/usr/bin/env bash
set -euo pipefail

need_node=0
if ! command -v node >/dev/null 2>&1; then
  need_node=1
else
  major="$(node -p 'Number(process.versions.node.split(".")[0])')"
  if [ "$major" -lt 20 ]; then
    need_node=1
  fi
fi

if [ "$need_node" -eq 1 ]; then
  if ! command -v curl >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y curl ca-certificates
  fi
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

mkdir -p .crabbox
lock_hash="$(sha256sum package-lock.json | awk '{print $1}')"

if [ ! -d node_modules ] ||
  [ ! -f .crabbox/package-lock.sha256 ] ||
  [ "$(cat .crabbox/package-lock.sha256)" != "$lock_hash" ]; then
  npm ci
  printf '%s\n' "$lock_hash" > .crabbox/package-lock.sha256
else
  echo "node_modules already matches package-lock.json"
fi
