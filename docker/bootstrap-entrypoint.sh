#!/usr/bin/env bash
set -euo pipefail
cd /workspace

# Bootstrap seed cần bcryptjs + tsx nằm trong devDependencies của root.
# .env Swarm thường có NODE_ENV=production → npm ci mặc định bỏ dev → Cannot find module 'bcryptjs'.
# --include=dev luôn bật devDependencies cho volume node_modules của runner này.

# node_modules được mount volume riêng — npm ci trong container khi lock hoặc package.json đổi
LOCK_HASH="$(
  (sha256sum package.json package-lock.json 2>/dev/null || true) | sha256sum | awk '{print $1}'
)"
# Bump suffix nếu đổi cách cài (ép volume cũ chạy npm ci lại)
INSTALL_SIG="${LOCK_HASH}_npm_ci_include_dev_v1"
MARKER="${NPM_CI_MARKER:-/workspace/node_modules/.bootstrap-lock-hash}"
if [[ ! -f "$MARKER" ]] || [[ "$(cat "$MARKER" 2>/dev/null || true)" != "$INSTALL_SIG" ]]; then
  echo "[bootstrap-runner] npm ci --include=dev (seed/bootstrap cần bcryptjs, tsx, …)..."
  npm ci --include=dev
  echo "$INSTALL_SIG" > "$MARKER"
fi

exec "$@"
