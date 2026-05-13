#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Reset + migrate + seed — Docker Swarm (Primary Manager host)
#
# Dùng thay scripts/reset-database.sh khi deploy bằng:
#   docker stack deploy -c docker-stack.thesis.yml cab-booking
#
# Yêu cầu (trên Primary Manager — node có Postgres publish 5433:5432):
# - Repo ~/cab-booking (hoặc bất kỳ); seed dùng cab-bootstrap-runner nếu host không có npx
# - Docker Swarm đã deploy stack cab-booking (thesis stack)
# - File .env + key SSH để tới worker: SWARM_SSH_KEY hoặc ~/.ssh/swarm_key (migrate chạy trong
#   task trên worker; Manager không thấy container qua docker ps).
#
# Workflow: drop PG + Mongo trong container → prisma db push từng service (exec / SSH / docker run)
# → restart services → prisma generate auth + seed (host npx hoặc bootstrap-runner image)
#
# Xem chi tiết: deploy/SWARM-SETUP.md (PHASE sau Init Databases)
# ─────────────────────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

STACK_NAME="${STACK_NAME:-cab-booking}"

if [[ -f .env ]]; then
  # shellcheck source=scripts/load-dotenv.sh
  source "$SCRIPT_DIR/load-dotenv.sh"
  load_dotenv .env
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

# Chờ mọi service trong stack có số task chạy = desired (ví dụ 1/1, 2/2 — không chấp nhận 0/1).
wait_for_stack_replicas_ready() {
  local max_sec="${SWARM_STACK_READY_TIMEOUT_SEC:-360}"
  local interval="${SWARM_STACK_READY_POLL_SEC:-5}"
  local elapsed=0
  local banner="${1:-${STACK_NAME}}"

  while [[ "$elapsed" -lt "$max_sec" ]]; do
    local bad_lines=()
    local svc_count=0
    local line=""
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      svc_count=$((svc_count + 1))
      local name="${line%% *}"
      local rep_raw="${line#* }"
      [[ -z "$rep_raw" ]] && continue
      local rep_word="${rep_raw%% *}"
      local cur="${rep_word%/*}"
      local des="${rep_word#*/}"
      if [[ "$cur" != "$des" ]] || [[ "${cur:-0}" == "0" ]]; then
        bad_lines+=("$name ($rep_word)")
      fi
    done < <(docker stack services "${STACK_NAME}" --format '{{.Name}} {{.Replicas}}' 2>/dev/null)

    if [[ "$svc_count" -eq 0 ]]; then
      echo "  ⚠ [$banner] Chưa đọc được service nào (stack ${STACK_NAME}?) — thử lại… (${elapsed}s)"
      sleep "$interval"
      elapsed=$((elapsed + interval))
      continue
    fi

    if [[ ${#bad_lines[@]} -eq 0 ]]; then
      echo "  ✓ [$banner] Mọi service: replica đã khớp (${elapsed}s)"
      return 0
    fi

    if [[ $elapsed -eq 0 ]] || [[ $((elapsed % 30)) -eq 0 ]]; then
      echo "  … [$banner] Chờ task (${elapsed}s / ${max_sec}s) — chưa đủ:"
      printf '    %s\n' "${bad_lines[@]}"
    fi
    sleep "$interval"
    elapsed=$((elapsed + interval))
  done

  echo "❌ [$banner] Sau ${max_sec}s vẫn có service chưa đạt đủ replica."
  printf '  %s\n' "${bad_lines[@]}"
  docker stack services "${STACK_NAME}" || true
  return 1
}

wait_for_gateway_http() {
  local max_sec="${SWARM_GATEWAY_HTTP_TIMEOUT_SEC:-180}"
  local interval=3
  local elapsed=0
  local url="${GATEWAY_HEALTH_URL:-http://127.0.0.1:3000/health}"

  while [[ "$elapsed" -lt "$max_sec" ]]; do
    if curl -sf "$url" >/dev/null 2>&1; then
      echo "  ✓ Gateway OK: $url (${elapsed}s)"
      return 0
    fi
    if [[ $elapsed -eq 0 ]] || [[ $((elapsed % 30)) -eq 0 ]]; then
      echo "  … Chờ gateway ($url) — ${elapsed}s / ${max_sec}s"
    fi
    sleep "$interval"
    elapsed=$((elapsed + interval))
  done
  echo "❌ Gateway không phản hồi sau ${max_sec}s: $url"
  return 1
}

# Seed/top-up flows call wallet-service through the gateway proxy.
# Nếu thiếu biến này, gateway fallback http://localhost:3006 trong container → 502 "Service temporarily unavailable".
wait_for_wallet_proxy_ready() {
  local max_sec="${SWARM_WALLET_WAIT_TIMEOUT_SEC:-120}"
  local interval=4
  local elapsed=0
  local gw_cid=""
  gw_cid="$(docker ps -q -f name="${STACK_NAME}_api-gateway" | head -1)"

  if [[ -z "$gw_cid" ]]; then
    echo "  ⚠ Không thấy task ${STACK_NAME}_api-gateway trên node này — bỏ qua probe wallet (chạy reset trên Manager có gateway)."
    return 0
  fi

  local wurl
  wurl="$(docker exec "$gw_cid" node -p "process.env.WALLET_SERVICE_URL || ''" 2>/dev/null | tr -d '\r\n' || true)"
  if [[ -z "$wurl" ]] || [[ "$wurl" == *localhost* ]] || [[ "$wurl" == *127.0.0.1* ]]; then
    echo "❌ Trong container api-gateway, WALLET_SERVICE_URL không hợp lệ cho Docker Swarm."
    echo "   Hiện tại: '${wurl:-<trống — fallback localhost trong code gateway>}'"
    echo "   Sửa ~/cab-booking/env/gateway.env (hoặc repo env/gateway.env):"
    echo "     WALLET_SERVICE_URL=http://wallet-service:3006"
    echo "   Rồi: docker stack deploy ... hoặc docker service update --force ${STACK_NAME}_api-gateway"
    return 1
  fi

  while [[ "$elapsed" -lt "$max_sec" ]]; do
    if docker exec "$gw_cid" node -e 'const b=(process.env.WALLET_SERVICE_URL||"").replace(/\/+$/,"");fetch(b+"/health").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1));' 2>/dev/null; then
      echo "  ✓ Gateway → wallet $wurl/health OK (${elapsed}s)"
      return 0
    fi
    if [[ $elapsed -eq 0 ]] || [[ $((elapsed % 20)) -eq 0 ]]; then
      echo "  … Chờ gateway → wallet ($wurl) — ${elapsed}s / ${max_sec}s"
    fi
    sleep "$interval"
    elapsed=$((elapsed + interval))
  done
  echo "❌ Sau ${max_sec}s vẫn không gọi được wallet từ api-gateway. Xem: docker service logs ${STACK_NAME}_wallet-service"
  return 1
}

migrate_one() {
  local svc="$1"
  local db="$2"
  local nf="${STACK_NAME}_${svc}"
  local cid=""
  cid="$(docker ps -q -f name="$nf" | head -1)"

  if [[ -n "$cid" ]]; then
    echo "  → $svc (manager/local $cid)"
    docker exec "$cid" npx prisma db push --accept-data-loss
    return 0
  fi

  # Task chạy trên worker → thử SSH vào từng node nếu có key.
  local key_path=""
  local user="${SWARM_NODES_SSH_USER:-ubuntu}"
  if key_path="$(resolve_swarm_ssh_key 2>/dev/null)"; then
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
          "${user}@${addr}" "docker exec $cid npx prisma db push --accept-data-loss"
        return 0
      fi
    done
  fi

  # Fallback: docker run với image từ registry (không cần container đang chạy).
  # Overlay `backend` trong stack thesis là internal + không attachable → không gắn được từ
  # docker run bên ngoài. Postgres đã publish 5433:5432 trên Manager → dùng --network host.
  local img="${DOCKERHUB_USERNAME:-foxxiee04}/cab-${svc}:${IMAGE_TAG:-latest}"
  echo "  → $svc: fallback docker run --network host ($img → $db @127.0.0.1:5433)"
  docker run --rm --network host \
    -e DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5433/${db}" \
    "$img" npx prisma db push --accept-data-loss
}

migrate_one "auth-service"     "auth_db"
migrate_one "booking-service"  "booking_db"
migrate_one "driver-service"   "driver_db"
migrate_one "payment-service"  "payment_db"
migrate_one "ride-service"     "ride_db"
migrate_one "user-service"     "user_db"
migrate_one "wallet-service"   "wallet_db"

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

STAGGER="${SWARM_SERVICE_RESTART_STAGGER_SEC:-3}"
restart_svc wallet-service
sleep "$STAGGER"
restart_svc auth-service
sleep "$STAGGER"
restart_svc user-service
sleep "$STAGGER"
restart_svc driver-service
sleep "$STAGGER"
restart_svc ride-service
sleep "$STAGGER"
restart_svc payment-service
sleep "$STAGGER"
restart_svc booking-service
sleep "$STAGGER"
restart_svc notification-service
sleep "$STAGGER"
restart_svc review-service
sleep "$STAGGER"
restart_svc pricing-service
sleep "$STAGGER"
restart_svc api-gateway

echo ""
echo "  Chờ mọi task trong stack về trạng thái bình thường (không 0/1)..."
wait_for_stack_replicas_ready "sau restart" || exit 1

echo ""
echo "  Chờ API Gateway phản hồi /health..."
export GATEWAY_BASE_URL="${GATEWAY_BASE_URL:-http://127.0.0.1:3000}"
wait_for_gateway_http || exit 1

echo ""
echo "  Kiểm tra WALLET_SERVICE_URL trong api-gateway + gọi wallet /health..."
wait_for_wallet_proxy_ready || exit 1

echo ""
echo "[5/5] Prisma generate (auth-service) + seed qua Gateway..."

if ! timeout 2 bash -c 'exec 3<>/dev/tcp/127.0.0.1/5433' 2>/dev/null; then
  echo "❌ Không kết nối được Postgres tại 127.0.0.1:5433."
  echo "   Redeploy stack với docker-stack.thesis.yml (postgres publish 5433:5432) rồi chạy lại."
  exit 1
fi

export AUTH_INTERNAL_URL="${AUTH_INTERNAL_URL:-$GATEWAY_BASE_URL}"
export POSTGRES_HOST="${POSTGRES_HOST:-127.0.0.1}"
export POSTGRES_PORT="${POSTGRES_PORT:-5433}"
export REDIS_PASSWORD

# Sau rolling restart + auto-scaler, auth qua gateway có thể cần >25s — tăng mặc định khi chạy từ script này.
export SEED_AUTH_PROXY_WAIT_ATTEMPTS="${SEED_AUTH_PROXY_WAIT_ATTEMPTS:-90}"

run_seed_on_host() {
  (
    cd "$PROJECT_DIR/services/auth-service"
    npx prisma generate
  )
  cd "$PROJECT_DIR"
  npx tsx scripts/seed-database.ts
}

run_seed_bootstrap_runner() {
  local br="${DOCKERHUB_USERNAME:-foxxiee04}/cab-bootstrap-runner:${IMAGE_TAG:-latest}"
  echo "  → Seed qua $br (Node trong image, không cần npx trên máy chủ)..."
  local -a dr=(
    run --rm --network host
    -v /var/run/docker.sock:/var/run/docker.sock
    -v "$PROJECT_DIR:/workspace:rw"
    -v cab-booking-bootstrap-node-modules:/workspace/node_modules
    --env-file "$PROJECT_DIR/.env"
    -e "GATEWAY_BASE_URL=$GATEWAY_BASE_URL"
    -e "AUTH_INTERNAL_URL=$AUTH_INTERNAL_URL"
    -e "POSTGRES_HOST=$POSTGRES_HOST"
    -e "POSTGRES_PORT=$POSTGRES_PORT"
    # Hist + reviews: seed kết nối Mongo từ host stack (must publish 27017, docker-stack.thesis.yml).
    # Ghi đè MONGO_HOST trong .env (thường là `mongodb`) vì --network host không resolve tên service Swarm.
    -e "MONGO_HOST=${SEED_MONGO_HOST:-127.0.0.1}"
    -e "MONGO_PORT=${SEED_MONGO_PORT:-27017}"
    -w /workspace
  )
  if [[ -n "${REDIS_PASSWORD:-}" ]]; then
    dr+=( -e "REDIS_PASSWORD=$REDIS_PASSWORD" )
  fi
  dr+=( -e "SEED_AUTH_PROXY_WAIT_ATTEMPTS=$SEED_AUTH_PROXY_WAIT_ATTEMPTS" )
  if [[ -f "${HOME}/.ssh/swarm_key" ]]; then
    dr+=( -v "$HOME/.ssh/swarm_key:/workspace/.secrets/swarm_key:ro" -e SWARM_SSH_KEY=/workspace/.secrets/swarm_key )
  fi
  docker "${dr[@]}" "$br" \
    bash -lc 'set -e; cd services/auth-service && npx prisma generate && cd /workspace && npx tsx scripts/seed-database.ts'
}

cd "$PROJECT_DIR"
if [[ "${USE_BOOTSTRAP_RUNNER_FOR_SEED:-}" == "1" ]] || ! command -v npx >/dev/null 2>&1; then
  run_seed_bootstrap_runner
else
  run_seed_on_host
fi

echo ""
echo "[verify] Kiểm tra lại replica + gateway sau seed..."
wait_for_stack_replicas_ready "sau seed" || exit 1
wait_for_gateway_http || exit 1

echo ""
echo "============================================"
echo " Swarm DB reset + seed hoàn tất."
echo "============================================"
