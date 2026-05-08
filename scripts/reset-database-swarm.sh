#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Reset + migrate + seed — Docker Swarm (Primary Manager host)
#
# Dùng thay scripts/reset-database.sh khi deploy bằng:
#   docker stack deploy -c docker-stack.thesis.yml cab-booking
#
# Yêu cầu (trên Primary Manager):
# - Repo ~/cab-booking (hoặc bất kỳ), đã npm install tại root
# - Docker Swarm đã deploy stack cab-booking, postgres có map 5433:5432 (thesis stack)
# - File .env + key SSH để tới worker: SWARM_SSH_KEY hoặc ~/.ssh/swarm_key (migrate chạy trong
#   task trên worker; Manager không thấy container qua docker ps).
#
# Workflow: drop PG + Mongo trong container → migrate deploy trong từng service
# task → restart services → prisma generate auth trên host → npm run db:seed
#
# Xem chi tiết: deploy/SWARM-SETUP.md (PHASE sau Init Databases)
# ─────────────────────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

STACK_NAME="${STACK_NAME:-cab-booking}"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env (must match swarm secrets)}"
MONGO_USER="${MONGO_USER:-mongo}"
MONGO_PASSWORD="${MONGO_PASSWORD:?Set MONGO_PASSWORD in .env}"

echo "============================================"
echo " Swarm DB reset + seed (${STACK_NAME})"
echo "============================================"
echo ""

pg_cid="$(docker ps -q -f name="${STACK_NAME}_postgres" | head -1)"
if [[ -z "$pg_cid" ]]; then
  echo "❌ Không thấy task postgres (${STACK_NAME}_postgres). Deploy stack trước."
  exit 1
fi

mongo_cid="$(docker ps -q -f name="${STACK_NAME}_mongodb" | head -1)"

echo "[1/5] PostgreSQL — drop + create logical DBs..."
for db in auth_db booking_db driver_db payment_db ride_db user_db wallet_db; do
  echo "  → $db"
  docker exec "$pg_cid" psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS $db WITH (FORCE);" 2>/dev/null || true
  docker exec "$pg_cid" psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE $db;"
done

echo ""
echo "[2/5] MongoDB — drop notification_db, review_db..."
if [[ -n "$mongo_cid" ]]; then
  docker exec "$mongo_cid" mongosh --quiet \
    -u "$MONGO_USER" -p "$MONGO_PASSWORD" --authenticationDatabase admin \
    --eval "
      db.getSiblingDB('notification_db').dropDatabase();
      db.getSiblingDB('review_db').dropDatabase();
      print('MongoDB dropped');
    " || echo "  ⚠ Mongosh báo lỗi hoặc DB chưa tồn tại — bỏ qua nếu sạch"
else
  echo "  ⚠ Không có task mongodb — bỏ qua"
fi

echo ""
echo "[3/5] Prisma migrate deploy (trong container từng service)..."

resolve_swarm_ssh_key() {
  if [[ -n "${SWARM_SSH_KEY:-}" && -f "$SWARM_SSH_KEY" ]]; then
    echo "$SWARM_SSH_KEY"
    return 0
  fi
  for p in "${HOME}/.ssh/swarm_key" "${HOME}/.ssh/id_rsa"; do
    [[ -f "$p" ]] && echo "$p" && return 0
  done
  return 1
}

migrate_one() {
  local svc="$1"
  local nf="${STACK_NAME}_${svc}"
  local cid=""
  cid="$(docker ps -q -f name="$nf" | head -1)"

  if [[ -n "$cid" ]]; then
    echo "  → $svc (manager/local $cid)"
    docker exec "$cid" npx prisma migrate deploy
    return 0
  fi

  # Task thường chạy trên worker → docker daemon Manager không list được — SSH vào từng node.
  local key_path=""
  local user="${SWARM_NODES_SSH_USER:-ubuntu}"
  if ! key_path="$(resolve_swarm_ssh_key)"; then
    echo "  ❌ Không thấy $nf trên node này và không có SSH key (đặt SWARM_SSH_KEY hoặc ~/.ssh/swarm_key) để tìm container trên worker."
    exit 1
  fi

  echo "  → $nf: đang SSH swarm nodes (user=$user key=${key_path})..."
  local nid=""
  for nid in $(docker node ls -q 2>/dev/null); do
    [[ -z "$nid" ]] && continue
    local addr
    addr="$(docker node inspect "$nid" -f '{{.Status.Addr}}' 2>/dev/null)"
    [[ -z "$addr" ]] && continue
    cid=""
    cid="$(ssh -i "$key_path" -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=10 \
      "${user}@${addr}" "docker ps -q -f name=$nf" 2>/dev/null | head -1 || true)"
    if [[ -n "$cid" ]]; then
      echo "  → $svc trên $addr ($cid)"
      ssh -i "$key_path" -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=10 \
        "${user}@${addr}" "docker exec $cid npx prisma migrate deploy"
      return 0
    fi
  done

  echo "  ❌ Không thấy task $nf trên bất kỳ node nào (manager + swarm SSH)."
  exit 1
}

for svc in auth-service booking-service driver-service payment-service ride-service user-service wallet-service; do
  migrate_one "$svc"
done

echo ""
echo "[4/5] Restart các service (wallet re-seed SystemBankAccount)..."

restart_svc() {
  local svc="$1"
  if docker service ls --format '{{.Name}}' | grep -qx "${STACK_NAME}_${svc}"; then
    docker service update --force "${STACK_NAME}_${svc}" >/dev/null
    echo "  ✓ forced ${STACK_NAME}_${svc}"
  else
    echo "  ⚠ không thấy service ${STACK_NAME}_${svc}"
  fi
}

restart_svc wallet-service
restart_svc auth-service
restart_svc user-service
restart_svc driver-service
restart_svc ride-service
restart_svc payment-service
restart_svc booking-service
restart_svc notification-service
restart_svc review-service
restart_svc pricing-service
restart_svc api-gateway

echo ""
echo "  Chờ rolling update + Prisma db push trên các worker..."
echo "  (payment-service có thể dùng start-first → traffic tạm tới replica cũ sau DROP DB → 500 tới schema sẵn sàng)"
BOOTSTRAP_SETTLE_SECS="${BOOTSTRAP_SETTLE_SECS:-180}"
BOOTSTRAP_SETTLE_INTERVAL="${BOOTSTRAP_SETTLE_INTERVAL:-3}"
elapsed=0
voucher_route_ok=0
while [[ "$elapsed" -lt "$BOOTSTRAP_SETTLE_SECS" ]]; do
  # Public route chạy findMany vouchers — bàn vouchers phải tồn tại (khác với /health chỉ báo gateway sống)
  resp="$(curl -sf "http://127.0.0.1:3000/api/voucher/public" 2>/dev/null || true)"
  case "$resp" in
    *'"success":true'*|*'"success": true'*) voucher_route_ok=1; break ;;
  esac
  sleep "$BOOTSTRAP_SETTLE_INTERVAL"
  elapsed=$((elapsed + BOOTSTRAP_SETTLE_INTERVAL))
done

if [[ "$voucher_route_ok" -eq 1 ]]; then
  echo "  ✓ GET /api/voucher/public đã OK sau ~${elapsed}s (gateway → payment có schema vouchers)"
else
  echo "  ⚠ Trong ${BOOTSTRAP_SETTLE_SECS}s chưa thấy /api/voucher/public success — tiếp tục seed; có thể tăng BOOTSTRAP_SETTLE_SECS hoặc chạy lại seed"
fi

echo ""
echo "[5/5] Prisma generate (auth-service, trên Manager) + seed qua Gateway..."

if ! curl -sf "http://127.0.0.1:3000/health" >/dev/null; then
  echo "❌ Gateway http://127.0.0.1:3000/health không phản hồi — kiểm tra stack trước khi seed."
  exit 1
fi

if ! timeout 2 bash -c 'exec 3<>/dev/tcp/127.0.0.1/5433' 2>/dev/null; then
  echo "❌ Không kết nối được Postgres tại 127.0.0.1:5433."
  echo "   Redeploy stack với docker-stack.thesis.yml (postgres publish 5433:5432) rồi chạy lại."
  exit 1
fi

(
  cd "$PROJECT_DIR/services/auth-service"
  npx prisma generate
)

export GATEWAY_BASE_URL="${GATEWAY_BASE_URL:-http://127.0.0.1:3000}"
export AUTH_INTERNAL_URL="${AUTH_INTERNAL_URL:-$GATEWAY_BASE_URL}"
export POSTGRES_HOST="${POSTGRES_HOST:-127.0.0.1}"
export POSTGRES_PORT="${POSTGRES_PORT:-5433}"
export REDIS_PASSWORD

cd "$PROJECT_DIR"
npx tsx scripts/seed-database.ts

echo ""
echo "============================================"
echo " Swarm DB reset + seed hoàn tất."
echo "============================================"
