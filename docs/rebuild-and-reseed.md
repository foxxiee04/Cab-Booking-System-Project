# Rebuild & Reseed

---

## Local — Docker Compose

```bash
# Full reset + seed (1 lệnh)
./scripts/reset-database.sh       # Linux/macOS
scripts\reset-database.bat         # Windows

# Hoặc chỉ seed (DB schema đã đúng)
npm run db:seed
```

Rebuild image sau khi đổi code:
```bash
docker compose down
docker compose up -d --build
# Chỉ 1 service:
docker compose up -d --build api-gateway
```

---

## Production — Docker Swarm (EC2)

Hướng dẫn triển khai đầy đủ (node, secrets, monitoring, auto-scaler): [`deploy/SWARM-SETUP.md`](../deploy/SWARM-SETUP.md).  
Phần reset/seed trên Swarm tương ứng **PHASE 15b** trong file đó.

CI/CD chỉ build/push image và `docker stack deploy`. Không chạy reset/seed trong pipeline. Sau khi CI/CD deploy xong, muốn làm sạch dữ liệu demo thì SSH vào **Primary Manager** rồi chạy lệnh reset/seed thủ công bên dưới.

### Yêu cầu trước khi reset

Phải SSH vào **Primary Manager** (IP Elastic `18.136.250.236` trong tài liệu Swarm) — đây là node thường có task **postgres** và cổng **`5433:5432`** publish ra localhost; reset/seed dựa vào điều đó. Stack **thesis** cũng cần **MongoDB `27017:27017`** publish trên Manager để bước **lịch sử + review** trong `seed-database.ts` chạy được từ `cab-bootstrap-runner` (`--network host`). Nếu stack deploy cũ chưa có map 27017: redeploy stack từ `docker-stack.thesis.yml` mới rồi mới reset/seed.

```bash
ssh -i C:\Users\sangt\.ssh\cab-key.pem ubuntu@18.136.250.236
```

### Lệnh reset + seed 1 lần (trong repo + trên server sau CI)

File tại **root repo** (CI copy lên `~/cab-booking/reset-and-seed.sh`):

```bash
bash ~/cab-booking/reset-and-seed.sh
# hoặc trong repo: bash reset-and-seed.sh   (gọi scripts/reset-database-swarm.sh)
```

Trên server, có thể giữ wrapper tay tại `~/cab-booking/reset-and-seed.sh` — nên **đồng bộ với repo** sau `git pull` hoặc dùng bản do CI deploy.

Script swarm (`scripts/reset-database-swarm.sh`) sau khi restart service sẽ:

- **Chờ** tới khi `docker stack services` không còn dạng **0/1** (và mọi dòng dạng **X/X** khớp) — tối đa mặc định **360s** (`SWARM_STACK_READY_TIMEOUT_SEC`).
- **Chờ** `/health` gateway — mặc định **180s** (`SWARM_GATEWAY_HTTP_TIMEOUT_SEC`).
- Trước seed đặt **`SEED_AUTH_PROXY_WAIT_ATTEMPTS=90`** (chờ auth sẵn sàng qua gateway, tránh seed xong mà UI/API vẫn lỗi tải lúc đầu).
- **Sau seed** kiểm tra lại replica + gateway; nếu vẫn có service chưa lên, script **thoát lỗi** để CI/người chạy biết.

Biến tùy chọn (trên Manager khi chạy script):

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `SWARM_STACK_READY_TIMEOUT_SEC` | 360 | Tối đa chờ mọi task về X/X |
| `SWARM_STACK_READY_POLL_SEC` | 5 | Chu kỳ poll |
| `SWARM_GATEWAY_HTTP_TIMEOUT_SEC` | 180 | Chờ `curl` /health |
| `SWARM_WALLET_WAIT_TIMEOUT_SEC` | 120 | Chờ gateway → wallet (sau khi fix `WALLET_SERVICE_URL`) |
| `SWARM_SERVICE_RESTART_STAGGER_SEC` | 3 | Nghỉ giữa các `service update --force` |
| `SEED_AUTH_PROXY_WAIT_ATTEMPTS` | 90 (khi qua script này) | Seed chờ auth không còn 502 |
| `SEED_MONGO_HOST` / `SEED_MONGO_PORT` | 127.0.0.1 / 27017 | Ghi đè host Mongo cho bước hist (script bootstrap-runner) |

- **`env/gateway.env`** phải có **`WALLET_SERVICE_URL=http://wallet-service:3006`**. Thiếu dòng này → các luồng ví qua gateway có thể báo **502** dù service khác vẫn hoạt động. Script `reset-database-swarm.sh` kiểm tra biến này trong container api-gateway trước khi seed.

**Toàn bộ bước trong script:**

1. Drop + recreate tất cả PostgreSQL logical DB (auth_db, booking_db, driver_db, payment_db, ride_db, user_db, wallet_db)
2. Drop MongoDB databases (notification_db, review_db)
3. `prisma db push` cho từng service: `docker exec` nếu task nằm trên Manager → nếu không thì **SSH** sang worker theo `~/.ssh/swarm_key` → nếu vẫn không được thì **`docker run --network host`** với image `foxxiee04/cab-<service>:latest` và `DATABASE_URL` tới **`127.0.0.1:5433`** (mạng overlay `backend` trong stack là **internal**, **không attachable**, nên không được `docker run --network cab-booking_backend`)
4. `docker service update --force` các service liên quan (cách nhau vài giây), rồi **chờ replica + gateway + kiểm tra `WALLET_SERVICE_URL` trong api-gateway và gọi được wallet `/health`**
5. `prisma generate` (auth-service) + `seed-database.ts`: trên host nếu có `npx`, không thì **`cab-bootstrap-runner`**
6. **Verify** lại replica + gateway

> **Lưu ý UI “không thể tải” ngay sau seed:** thường do task vẫn rolling hoặc auth chưa ổn định qua gateway — script mới chờ tới khi **X/X** và `/health` OK mới seed, và kiểm tra lại sau seed. Nếu front vẫn cache trang cũ, thử hard refresh (Ctrl+F5).

> **Auto-scaler (PHASE 18 trong SWARM-SETUP):** chỉ tăng replica stateless; postgres vẫn trên Manager. Nếu sau khi bật auto-scaler mà reset báo thiếu bảng / không thấy container auth trên Manager, nguyên nhân thường là **bước 3** (migrate) không chạy đủ trên worker — dùng script repo ở trên thay vì chỉ `docker exec` local.

### Nếu script chưa có hoặc cần tạo lại

**Khuyến nghị:** từ repo đã `git pull`:

```bash
cd ~/cab-booking
chmod +x scripts/reset-database-swarm.sh
bash scripts/reset-database-swarm.sh
```

Nếu không dùng được script, có thể chạy lần lượt các bước thủ công sau trên **Primary Manager**:

```bash
cd ~/cab-booking

# Bước 1 — Drop + recreate PostgreSQL
pg_cid=$(docker ps -q -f name=cab-booking_postgres)
for db in auth_db booking_db driver_db payment_db ride_db user_db wallet_db; do
  docker exec "$pg_cid" psql -U postgres -c "DROP DATABASE IF EXISTS $db WITH (FORCE);" 2>/dev/null
  docker exec "$pg_cid" psql -U postgres -c "CREATE DATABASE $db;" && echo "✓ $db"
done

# Bước 2 — Drop MongoDB
mongo_cid=$(docker ps -q -f name=cab-booking_mongodb)
MONGO_PASS='FoxGo@Mongo2025!'
docker exec "$mongo_cid" mongosh --quiet \
  -u mongo -p "$MONGO_PASS" --authenticationDatabase admin \
  --eval "db.getSiblingDB('notification_db').dropDatabase(); db.getSiblingDB('review_db').dropDatabase(); print('OK')"

# Bước 3 — Prisma db push (tự tìm node chứa container)
for svc in auth-service driver-service wallet-service booking-service payment-service ride-service user-service; do
  NODE_IP=$(docker node inspect \
    "$(docker stack ps cab-booking -f name=cab-booking_${svc} --format '{{.Node}}' | head -1)" \
    --format '{{.Status.Addr}}' 2>/dev/null)
  ssh -i ~/.ssh/swarm_key -o StrictHostKeyChecking=no ubuntu@"$NODE_IP" \
    "cid=\$(docker ps -q -f name=cab-booking_${svc}); [ -n \"\$cid\" ] && docker exec \"\$cid\" npx prisma db push --accept-data-loss && echo '✓ ${svc}' || echo '✗ ${svc}'"
done

# Bước 4 — Flush Redis
redis_cid=$(docker ps -q -f name=cab-booking_redis)
docker exec "$redis_cid" redis-cli -a redis123 FLUSHALL 2>/dev/null && echo "✓ Redis flushed"

# Bước 5 — Restart wallet (re-seed SystemBankAccount)
docker service update --force cab-booking_wallet-service
echo "Đợi wallet (25s)..." && sleep 25

# Bước 6 — Seed qua bootstrap-runner (có prisma generate cho auth-service)
docker run --rm --network host \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$PWD:/workspace:rw" \
  -v cab-booking-bootstrap-node-modules:/workspace/node_modules \
  -v "$HOME/.ssh/swarm_key:/workspace/.secrets/swarm_key:ro" \
  --env-file "$PWD/.env" \
  -e SWARM_SSH_KEY=/workspace/.secrets/swarm_key \
  -e GATEWAY_BASE_URL=http://127.0.0.1:3000 \
  -e AUTH_INTERNAL_URL=http://127.0.0.1:3000 \
  -e POSTGRES_HOST=127.0.0.1 \
  -e POSTGRES_PORT=5433 \
  -w /workspace \
  foxxiee04/cab-bootstrap-runner:latest \
  bash -lc 'set -e; cd services/auth-service && npx prisma generate && cd /workspace && npx tsx scripts/seed-database.ts'
```

### Sau khi reset — kiểm tra nhanh

```bash
curl -s http://127.0.0.1:3000/health
cat ~/cab-booking/docs/seed-accounts-reference.md | head -30
docker stack services cab-booking | grep -E "REPLICAS|0/1"
```

### Passwords thực tế trên server (đã xác nhận)

| Service     | Password       |
|-------------|----------------|
| Redis       | `redis123`     |
| RabbitMQ    | `rabbit123`    |
| PostgreSQL  | `FoxGo@Postgres2025!` |
| MongoDB     | `FoxGo@Mongo2025!` |

> **Lưu ý:** `env/` bị `.gitignore` — không commit được. Phải sửa trực tiếp trên server bằng `sed` nếu cần thay đổi.

---

## Kiểm tra nhanh (local)

```bash
curl -s http://localhost:3000/health
npm run smoke:gateway
```

Mật khẩu seed chung: xem `docs/seed-accounts-reference.md`.
