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

### Yêu cầu trước khi reset

Phải SSH vào **Primary Manager** (18.136.250.236):

```bash
ssh -i C:\Users\sangt\.ssh\cab-key.pem ubuntu@18.136.250.236
```

### Lệnh reset + seed 1 lần (script có sẵn trên server)

```bash
bash ~/cab-booking/reset-and-seed.sh
```

Script này tự động làm:
1. Drop + recreate tất cả PostgreSQL databases (auth_db, booking_db, driver_db, payment_db, ride_db, user_db, wallet_db)
2. Drop MongoDB databases (notification_db, review_db)
3. Chạy `prisma db push` trong từng service container (SSH tới worker nodes)
4. Flush Redis (xóa rate-limit keys)
5. Restart wallet-service (re-seed SystemBankAccount)
6. Chạy `seed-database.ts` qua bootstrap-runner container

### Nếu script chưa có hoặc cần tạo lại

Chạy lần lượt các bước sau trên **Primary Manager**:

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

# Bước 6 — Seed qua bootstrap-runner
docker run --rm --network host \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$PWD:/workspace:rw" \
  -v cab-booking-bootstrap-node-modules:/workspace/node_modules \
  -v "$HOME/.ssh/swarm_key:/workspace/.secrets/swarm_key:ro" \
  --env-file "$PWD/.env" \
  -e SWARM_SSH_KEY=/workspace/.secrets/swarm_key \
  -e GATEWAY_BASE_URL=http://127.0.0.1:3000 \
  -e POSTGRES_HOST=127.0.0.1 \
  -e POSTGRES_PORT=5433 \
  -w /workspace \
  foxxiee04/cab-bootstrap-runner:latest \
  npx tsx scripts/seed-database.ts
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
