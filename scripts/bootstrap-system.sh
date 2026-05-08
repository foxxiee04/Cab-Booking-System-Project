#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Cab Booking — một lệnh: reset DB + migrate + seed + verify (điểm vào duy nhất)
#
# Tự chọn:
#   • Docker Swarm: stack tên $STACK_NAME (mặc định cab-booking) → reset-database-swarm.sh
#   • Còn lại (Docker Compose local): → reset-database.sh
#
# Yêu cầu chung:
#   • Node.js + npm/npx, tại root repo: npm install
#   • .env khớp DB / secrets
#
# Chạy:
#   chmod +x scripts/bootstrap-system.sh
#   ./scripts/bootstrap-system.sh
#   hoặc: npm run system:bootstrap
#
# Biến tùy chọn:
#   STACK_NAME     (mặc định cab-booking)
#   GATEWAY_URL    (mặc định http://127.0.0.1:3000) — bước verify
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

STACK_NAME="${STACK_NAME:-cab-booking}"
GATEWAY_URL="${GATEWAY_URL:-http://127.0.0.1:3000}"

banner() {
  echo ""
  echo "============================================"
  echo " $1"
  echo "============================================"
}

banner "CAB BOOKING — SYSTEM BOOTSTRAP"

if ! command -v docker >/dev/null 2>&1; then
  echo "[error] Cần Docker trên PATH."
  exit 1
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npx >/dev/null 2>&1; then
  echo "[error] Cần Node.js + npx (seed + Prisma generate)."
  echo "        Ví dụ Ubuntu: cài Node 20 LTS (NodeSource), rồi: cd repo && npm install"
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "[warn] Chưa có node_modules — chạy: npm install"
fi

detect_mode() {
  if docker stack ls --format '{{.Name}}' 2>/dev/null | grep -qx "${STACK_NAME}"; then
    echo "swarm"
    return
  fi
  echo "compose"
}

MODE="$(detect_mode)"
echo "[info] Chế độ: ${MODE}  (STACK_NAME=${STACK_NAME})"

if [[ "${MODE}" == "swarm" ]]; then
  bash "${SCRIPT_DIR}/reset-database-swarm.sh"
else
  if [[ ! -x "${SCRIPT_DIR}/reset-database.sh" ]]; then
    chmod +x "${SCRIPT_DIR}/reset-database.sh" 2>/dev/null || true
  fi
  bash "${SCRIPT_DIR}/reset-database.sh"
fi

banner "VERIFY"

if curl -sf "${GATEWAY_URL}/health" >/dev/null; then
  echo "[ok] Gateway: ${GATEWAY_URL}/health"
else
  echo "[warn] Không gọi được ${GATEWAY_URL}/health — kiểm tra API Gateway / port."
fi

REF="${PROJECT_DIR}/docs/seed-accounts-reference.md"
echo ""
if [[ -f "${REF}" ]]; then
  echo "--- Tài khoản demo (trích đầu file) — xem đủ tại: ${REF} ---"
  head -n 45 "${REF}" || true
else
  echo "[info] Chưa có ${REF} — thường được tạo sau bước seed."
fi

banner "SYSTEM READY"
