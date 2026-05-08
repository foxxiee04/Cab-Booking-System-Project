#!/usr/bin/env bash
set -euo pipefail
cd /workspace

# node_modules được mount volume riêng — chỉ chạy npm ci trong container khi lock đổi
LOCK_HASH="$(sha256sum package-lock.json 2>/dev/null | awk '{print $1}' || echo none)"
MARKER="${NPM_CI_MARKER:-/workspace/node_modules/.bootstrap-lock-hash}"
if [[ ! -f "$MARKER" ]] || [[ "$(cat "$MARKER" 2>/dev/null || true)" != "$LOCK_HASH" ]]; then
  echo "[bootstrap-runner] npm ci (trong container, không cần npm trên host)..."
  npm ci
  echo "$LOCK_HASH" > "$MARKER"
fi

exec "$@"
