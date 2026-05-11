# Docker Swarm — Hướng dẫn thiết lập chi tiết
## Manager (on-demand) + Spot Workers + HA Secondary Manager

**Elastic IP giữ nguyên:** `18.136.250.236`  
**Region:** ap-southeast-1 (Singapore)  
**Key pair:** `cab-key.pem`

---

## Kiến trúc mục tiêu

```
Primary Manager   (on-demand t3.medium)  ← Elastic IP 18.136.250.236
Secondary Manager (on-demand t3.small)   ← HA / Raft consensus
Worker-1          (spot t3.medium)       ← microservices
Worker-2          (spot t3.medium)       ← microservices
Worker-N          (spot t3.medium)       ← scale tùy ý
```

---

## PHASE 1 — AWS Console: Terminate instance cũ

> Truy cập: https://ap-southeast-1.console.aws.amazon.com/ec2

1. Left menu → **Instances** → **Instances**
2. Tick chọn **tất cả instances đang chạy**
3. Nút **Instance state** (góc trên phải) → **Terminate instance**
4. Popup xác nhận → nhấn **Terminate**
5. Chờ status chuyển sang `terminated` (~30 giây)

> ⚠️ Elastic IP **KHÔNG BỊ XÓA** khi terminate instance. Nó chỉ trở về trạng thái "unassociated".

---

## PHASE 2 — Tạo Security Group

> EC2 Console → Left menu → **Security Groups** → **Create security group**

**Điền các trường:**

| Trường | Giá trị |
|--------|---------|
| Security group name | `foxgo-swarm-sg` |
| Description | `FoxGo Docker Swarm cluster` |
| VPC | *(giữ default VPC)* |

**Inbound rules** — nhấn **Add rule** từng dòng:

| Type | Protocol | Port | Source | Mô tả |
|------|----------|------|--------|-------|
| SSH | TCP | 22 | 0.0.0.0/0 | SSH — phải mở toàn bộ vì GitHub Actions runners có IP động |
| Custom TCP | TCP | 2377 | `foxgo-swarm-sg` (chọn chính nó) | Swarm management |
| Custom TCP | TCP | 7946 | `foxgo-swarm-sg` | Swarm node discovery |
| Custom UDP | UDP | 7946 | `foxgo-swarm-sg` | Swarm node discovery |
| Custom UDP | UDP | 4789 | `foxgo-swarm-sg` | Overlay network VXLAN |
| Custom TCP | TCP | 3000 | 0.0.0.0/0 | API Gateway |
| Custom TCP | TCP | 3030 | 0.0.0.0/0 | Grafana dashboard |
| Custom TCP | TCP | 9090 | My IP | Prometheus (chỉ bạn) |
| Custom TCP | TCP | 9100 | `foxgo-swarm-sg` | Node Exporter (internal) |
| Custom TCP | TCP | 8081 | `foxgo-swarm-sg` | cAdvisor (internal) |
| HTTP | TCP | 80 | 0.0.0.0/0 | HTTP (cho certbot) |
| HTTPS | TCP | 443 | 0.0.0.0/0 | HTTPS |

> Với cột **Source** khi chọn `foxgo-swarm-sg`: gõ tên SG vào ô tìm kiếm, nó tự fill ID như `sg-0abc123...`

**Outbound rules:** giữ nguyên default (All traffic 0.0.0.0/0)

→ Nhấn **Create security group**

---

## PHASE 3 — Tạo Primary Manager (on-demand)

> EC2 → **Launch instance**

**Name and tags:**
```
Name: foxgo-manager
```

**Application and OS Images:**
- Nhấn **Ubuntu** (tab Quick Start)
- Chọn: **Ubuntu Server 22.04 LTS (HVM), SSD Volume Type**
- Architecture: **64-bit (x86)**

**Instance type:**
```
t3.medium   (2 vCPU, 4 GiB Memory)
```
> Đây là **on-demand** — không tick spot

**Key pair:**
```
cab-key   ← chọn key cũ đang có
```

**Network settings** → nhấn **Edit**:

| Trường | Giá trị |
|--------|---------|
| VPC | *(default)* |
| Subnet | *(default, ap-southeast-1a)* |
| Auto-assign public IP | **Enable** |
| Firewall | **Select existing security group** |
| Common security groups | `foxgo-swarm-sg` |

**Configure storage:**
```
1 volume:  30 GiB  gp3  (không tick Delete on termination = false nếu muốn giữ data)
```

**Advanced details** (scroll xuống cuối):
- **Shutdown behavior:** `Stop`
- Các trường còn lại: giữ nguyên

→ Nhấn **Launch instance**

---

## PHASE 4 — Gắn Elastic IP vào Primary Manager

1. Left menu → **Elastic IPs**
2. Thấy IP `18.136.250.236` đang `Not associated`
3. Tick chọn nó → **Actions** → **Associate Elastic IP address**
4. Điền:
   - **Resource type:** Instance
   - **Instance:** chọn `foxgo-manager` (vừa tạo)
   - **Private IP:** tự điền
5. → **Associate**

✅ Bây giờ `18.136.250.236` trỏ vào Manager mới.

---

## PHASE 5 — Tạo Secondary Manager (on-demand, cho HA)

> EC2 → **Launch instance**

```
Name:           foxgo-manager-2
AMI:            Ubuntu Server 22.04 LTS (HVM), SSD — x86_64
Instance type:  t3.small   (2 vCPU, 2 GiB) — on-demand, nhỏ hơn vì chỉ dùng cho Raft
Key pair:       cab-key
```

**Network settings:**
```
Auto-assign public IP:  Enable
Security group:         foxgo-swarm-sg
```

**Storage:**
```
15 GiB  gp3
```

→ **Launch instance**

> Secondary Manager chỉ tham gia Raft quorum. Không có app nào schedule lên nó (không có constraint nào match). Nếu Primary Manager fail, Secondary tự trở thành Leader.

---

## PHASE 6 — Tạo Spot Workers

> EC2 → **Launch instance**

**Worker-1:**
```
Name: foxgo-worker-1
```

**AMI:** Ubuntu Server 22.04 LTS (HVM) — x86_64 *(CÙNG AMI VỚI MANAGER)*

**Instance type:** `t3.medium`

**Key pair:** `cab-key`

**Network settings:**
```
Auto-assign public IP:  Enable
Security group:         foxgo-swarm-sg
```

**Advanced details** — scroll xuống tìm **"Purchasing option":**
- ✅ Tick **"Request Spot Instances"**
- **Maximum price:** `0.05` (USD/hr) — on-demand là ~$0.042, spot ~$0.016–0.020
- **Request type:** `Persistent` ← instance tự start lại khi có spot capacity
- **Interruption behavior:** `Stop` ← **BẮT BUỘC CHỌN STOP** (`Terminate` không hợp lệ với Persistent request)

**Storage:**
```
20 GiB  gp3
```

→ **Launch instance**

> Lặp lại bước này để tạo **foxgo-worker-2** (cùng config). Có thể tạo thêm worker bất cứ lúc nào.

**IP thực tế của cluster:**
```
foxgo-manager    Public: 18.136.250.236   (Elastic IP — cố định)
foxgo-manager-2  Public: 52.77.233.34
foxgo-worker-1   Public: 52.221.209.1
foxgo-worker-2   Public: 13.212.196.192
```
> Private IP Manager: `172.31.39.11` (đã xác nhận). Các node còn lại chạy `hostname -I` để xem.

---

## PHASE 7 — Cài Docker trên tất cả nodes

> Chạy trên **TỪNG NODE** (manager-1, manager-2, worker-1, worker-2)

**SSH từ máy local (Windows):**
```powershell
# Primary Manager
ssh -i C:\Users\sangt\.ssh\cab-key.pem ubuntu@18.136.250.236

# Secondary Manager
ssh -i C:\Users\sangt\.ssh\cab-key.pem ubuntu@52.77.233.34

# Worker 1
ssh -i C:\Users\sangt\.ssh\cab-key.pem ubuntu@52.221.209.1

# Worker 2
ssh -i C:\Users\sangt\.ssh\cab-key.pem ubuntu@13.212.196.192
```

**Trên mỗi node, chạy:**
```bash
# Cài Docker (1 lệnh)
curl -fsSL https://get.docker.com | sh

# Thêm user ubuntu vào group docker (không cần sudo)
sudo usermod -aG docker ubuntu

# Áp dụng ngay không cần logout
newgrp docker

# Kiểm tra
docker --version
# Output: Docker version 29.4.2, build ...
```

---

## PHASE 8 — Init Swarm trên Primary Manager

> SSH vào **Primary Manager** (18.136.250.236)

```bash
ssh -i C:\Users\sangt\.ssh\cab-key.pem ubuntu@18.136.250.236
```

**Private IP của Manager đã biết: `172.31.39.11`**

**Init Swarm:**
```bash
docker swarm init --advertise-addr 172.31.39.11
```

**Output sẽ như này:**
```
Swarm initialized: current node (abc123def456) is now a manager.

To add a worker to this swarm, run the following command:

    docker swarm join --token 

To add a manager to this swarm, run 'docker swarm join-token manager' and follow the instructions.
```

> ✅ Copy và lưu lệnh `docker swarm join --token ...` lại — dùng ở bước sau.

---

## PHASE 8b — Gán Node Labels cho Primary Manager

> Vẫn trên **Primary Manager** — phải làm TRƯỚC khi deploy stack

Stack file dùng constraints để quyết định service chạy trên node nào:
- `node.labels.infra == true` → postgres, mongodb, redis, rabbitmq, ai-service, monitoring
- `node.labels.nginx == true` → api-gateway (public entry point, cần IP cố định)
- `node.role == worker` → tất cả microservices còn lại

**Nếu thiếu labels, các service bị stuck ở `0/1` — KHÔNG BAO GIỜ start.**

```bash
# Lấy node ID của chính manager này
SELF_ID=$(docker info --format '{{.Swarm.NodeID}}')

# Gán labels
docker node update --label-add infra=true  "$SELF_ID"
docker node update --label-add nginx=true  "$SELF_ID"

# Xác nhận
docker node inspect "$SELF_ID" --format '{{json .Spec.Labels}}'
# Output: {"infra":"true","nginx":"true"}
```

> Secondary Manager và Workers **KHÔNG cần labels** — microservices dùng `node.role == worker` để tự spread sang tất cả workers.

---

## PHASE 9 — Tạo Docker Secrets

> Vẫn trên **Primary Manager**

```bash
# PostgreSQL
echo "postgres" | docker secret create postgres_user -
echo "FoxGo@Postgres2025!" | docker secret create postgres_password -

# MongoDB
echo "mongo" | docker secret create mongo_user -
echo "FoxGo@Mongo2025!" | docker secret create mongo_password -

# Kiểm tra secrets đã tạo
docker secret ls
# Output:
# ID            NAME               DRIVER    CREATED
# abc123...     mongo_password               1 second ago
# def456...     mongo_user                   1 second ago
# ghi789...     postgres_password            1 second ago
# jkl012...     postgres_user                1 second ago
```

> ⚠️ Đổi password theo ý muốn — nhớ dùng đúng password này trong file `.env`

---

## PHASE 10 — Setup Project trên Primary Manager

> Vẫn trên **Primary Manager**

```bash
# Clone repo
git clone https://github.com/foxxiee04/Cab-Booking-System-Project.git ~/cab-booking
cd ~/cab-booking

# Hoặc nếu đã clone rồi:
cd ~/cab-booking && git pull origin main
```

**Tạo file .env:**
```bash
cp .env.example .env
nano .env
```

**Điền các giá trị sau vào .env** (xóa comment, giữ nguyên các dòng không cần đổi):
```bash
# Image Registry
DOCKERHUB_USERNAME=foxxiee04
IMAGE_TAG=latest

# Database (phải khớp với Docker secrets)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=FoxGo@Postgres2025!
POSTGRES_DB=cab_booking

MONGO_USER=mongo
MONGO_PASSWORD=FoxGo@Mongo2025!

# RabbitMQ
RABBITMQ_USER=rabbit
RABBITMQ_PASS=FoxGo@Rabbit2025!

# Redis
REDIS_PASSWORD=FoxGo@Redis2025!

# Security — tạo random string
JWT_SECRET=<chạy: openssl rand -hex 32>
REFRESH_TOKEN_SECRET=<chạy: openssl rand -hex 32>
INTERNAL_SERVICE_TOKEN=<chạy: openssl rand -hex 16>

# Monitoring
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=FoxGo@Grafana2025!

# LLM (nếu có key Claude)
ANTHROPIC_API_KEY=sk-ant-...
RAG_LLM_PROVIDER=claude

# App
NODE_ENV=production
CORS_ORIGIN=http://18.136.250.236:3000
# ← dùng IP tạm, cập nhật domain sau
```

**Tạo random secrets ngay trong terminal:**
```bash
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "REFRESH_TOKEN_SECRET=$(openssl rand -hex 32)"
echo "INTERNAL_SERVICE_TOKEN=$(openssl rand -hex 16)"
# Copy output và điền vào .env
```

---

## PHASE 11 — Cập nhật env/ files (service-level)

> Các file trong `env/` đã có sẵn trong repo nhưng cần cập nhật password cho production.

**gateway.env** — cập nhật các dòng sau (JWT / Rabbit / Redis / DB location + **bắt buộc có `WALLET_SERVICE_URL`** — nếu thiếu, gateway trong container fallback `http://localhost:3006` → mọi route `/api/admin/wallet/*` và phần lớn `/api/wallet/*` trả **502** trong khi `/api/voucher` vẫn OK vì đi qua payment):
```bash
nano ~/cab-booking/env/gateway.env
```
Sửa / thêm:
```
WALLET_SERVICE_URL=http://wallet-service:3006
JWT_SECRET=<giá trị JWT_SECRET ở bước trên>
RABBITMQ_URL=amqp://rabbit:FoxGo@Rabbit2025!@rabbitmq:5672
INTERNAL_SERVICE_TOKEN=<giá trị INTERNAL_SERVICE_TOKEN>
REDIS_URL=redis://:FoxGo@Redis2025!@redis:6379
LOCATION_DATABASE_URL=postgresql://postgres:FoxGo@Postgres2025!@postgres:5432/ride_db
```

**auth.env:**
```bash
nano ~/cab-booking/env/auth.env
```
Sửa:
```
DATABASE_URL=postgresql://postgres:FoxGo@Postgres2025!@postgres:5432/auth_db
JWT_SECRET=<giá trị JWT_SECRET>
REFRESH_TOKEN_SECRET=<giá trị REFRESH_TOKEN_SECRET>
RABBITMQ_URL=amqp://rabbit:FoxGo@Rabbit2025!@rabbitmq:5672
INTERNAL_SERVICE_TOKEN=<giá trị INTERNAL_SERVICE_TOKEN>
REDIS_URL=redis://:FoxGo@Redis2025!@redis:6379
OTP_SMS_MODE=mock
```

> Làm tương tự cho các file còn lại (`ride.env`, `driver.env`, `payment.env`, `wallet.env`, `user.env`, `booking.env`, `pricing.env`, `notification.env`, `review.env`) — đổi DATABASE_URL, RABBITMQ_URL, REDIS_URL, JWT_SECRET, INTERNAL_SERVICE_TOKEN cho đúng.

**Pattern DATABASE_URL cho từng service:**
```
auth_db     → postgresql://postgres:FoxGo@Postgres2025!@postgres:5432/auth_db
user_db     → postgresql://postgres:FoxGo@Postgres2025!@postgres:5432/user_db
ride_db     → postgresql://postgres:FoxGo@Postgres2025!@postgres:5432/ride_db
driver_db   → postgresql://postgres:FoxGo@Postgres2025!@postgres:5432/driver_db
payment_db  → postgresql://postgres:FoxGo@Postgres2025!@postgres:5432/payment_db
wallet_db   → postgresql://postgres:FoxGo@Postgres2025!@postgres:5432/wallet_db
booking_db  → postgresql://postgres:FoxGo@Postgres2025!@postgres:5432/booking_db
```

---

## PHASE 12 — Join Secondary Manager vào Swarm

**Trên Primary Manager — lấy manager join token:**
```bash
docker swarm join-token manager
# Output:
# To add a manager to this swarm, run the following command:
#     docker swarm join --token SWMTKN-1-aaa...bbb 172.31.19.xx:2377
```

**SSH vào Secondary Manager:**
```bash
# Từ máy local
ssh -i C:\Users\sangt\.ssh\cab-key.pem ubuntu@52.77.233.34

# Chạy lệnh join (copy từ output trên — token lấy ở bước trên)
docker swarm join --token SWMTKN-1-aaa...bbb <MANAGER_PRIVATE_IP>:2377
# Output: This node joined a swarm as a manager.
```

**Về Primary Manager — kiểm tra:**
```bash
docker node ls
# ID              HOSTNAME           STATUS    AVAILABILITY   MANAGER STATUS
# abc123 *        foxgo-manager      Ready     Active         Leader
# def456          foxgo-manager-2    Ready     Active         Reachable
```

> `Leader` = Primary Manager đang active. `Reachable` = Secondary Manager sẵn sàng failover.

---

## PHASE 13 — Join Spot Workers vào Swarm

**Trên Primary Manager — lấy worker join token:**
```bash
docker swarm join-token worker
# Output:
#     docker swarm join --token SWMTKN-1-zzz...yyy 172.31.19.xx:2377
```

**SSH vào Worker-1:**
```bash
ssh -i C:\Users\sangt\.ssh\cab-key.pem ubuntu@52.221.209.1

docker swarm join --token SWMTKN-1-zzz...yyy <MANAGER_PRIVATE_IP>:2377
# Output: This node joined a swarm as a worker.
```

**SSH vào Worker-2:**
```bash
ssh -i C:\Users\sangt\.ssh\cab-key.pem ubuntu@13.212.196.192

docker swarm join --token SWMTKN-1-zzz...yyy <MANAGER_PRIVATE_IP>:2377
# Output: This node joined a swarm as a worker.
```

**Về Primary Manager — kiểm tra tất cả nodes:**
```bash
docker node ls
# ID              HOSTNAME           STATUS    AVAILABILITY   MANAGER STATUS
# abc123 *        foxgo-manager      Ready     Active         Leader
# def456          foxgo-manager-2    Ready     Active         Reachable
# ghi789          foxgo-worker-1     Ready     Active
# jkl012          foxgo-worker-2     Ready     Active
```

---

## PHASE 14 — Deploy Stack

> Trên **Primary Manager**

```bash
cd ~/cab-booking

# Set biến môi trường (hoặc source .env)
export DOCKERHUB_USERNAME=foxxiee04
export IMAGE_TAG=latest

# Login Docker Hub (để pull private images nếu có)
docker login -u foxxiee04
# Nhập Docker Hub password / access token

# Deploy
docker stack deploy \
  --with-registry-auth \
  --compose-file docker-stack.thesis.yml \
  cab-booking
```

**Output:**
```
Creating network cab-booking_frontend
Creating network cab-booking_backend
Creating service cab-booking_postgres
Creating service cab-booking_mongodb
Creating service cab-booking_redis
Creating service cab-booking_rabbitmq
Creating service cab-booking_api-gateway
Creating service cab-booking_auth-service
...
Creating service cab-booking_prometheus
Creating service cab-booking_grafana
```

**Chờ ~60 giây rồi kiểm tra:**
```bash
docker stack services cab-booking
# NAME                              MODE        REPLICAS   IMAGE
# cab-booking_api-gateway           replicated  1/1        foxxiee04/cab-api-gateway:latest
# cab-booking_auth-service          replicated  1/1        foxxiee04/cab-auth-service:latest
# cab-booking_postgres              replicated  1/1        postgres:16-alpine
# ...

# Kiểm tra phân bổ service trên từng node
docker stack ps cab-booking --filter "desired-state=running"
# NAME                           NODE              CURRENT STATE
# cab-booking_postgres.1         foxgo-manager     Running 1 min ago
# cab-booking_auth-service.1     foxgo-worker-1    Running 1 min ago
# cab-booking_ride-service.1     foxgo-worker-2    Running 1 min ago
# cab-booking_node-exporter.xxx  foxgo-manager     Running 1 min ago   ← global
# cab-booking_node-exporter.yyy  foxgo-worker-1    Running 1 min ago   ← global
# cab-booking_node-exporter.zzz  foxgo-worker-2    Running 1 min ago   ← global
```

---

## PHASE 15 — Init Databases

> Vẫn trên **Primary Manager**

```bash
# Tạo tất cả PostgreSQL databases
docker exec $(docker ps -q -f name=cab-booking_postgres) \
  psql -U postgres -c "
    CREATE DATABASE auth_db;
    CREATE DATABASE user_db;
    CREATE DATABASE ride_db;
    CREATE DATABASE driver_db;
    CREATE DATABASE payment_db;
    CREATE DATABASE wallet_db;
    CREATE DATABASE booking_db;
  " 2>/dev/null || echo "Databases may already exist"

# Chạy Prisma migrations (từng service)
# auth-service
docker exec $(docker ps -q -f name=cab-booking_auth-service) \
  npx prisma migrate deploy

# ride-service
docker exec $(docker ps -q -f name=cab-booking_ride-service) \
  npx prisma migrate deploy

# Làm tương tự cho: driver, payment, wallet, user, booking
```

---

## PHASE 15b — Đưa dữ liệu demo (reset + seed) trên Primary Manager

> Dùng khi bạn muốn dữ liệu giống môi trường local (tương đương `scripts/reset-database.*` + `npm run db:seed`), nhưng stack đang chạy bằng **Docker Swarm** (`docker-stack.thesis.yml`, tên stack `cab-booking`).

**Tóm tắt lệnh (đồng bộ với `docs/rebuild-and-reseed.md`):**
- Trên server thường dùng: `bash ~/cab-booking/reset-and-seed.sh` (file root repo; CI/CD scp lên cùng `scripts/`).
- **Nguồn trong repo:** `bash scripts/reset-database-swarm.sh` (drop DB → `prisma db push` qua exec / SSH / `docker run --network host` + `127.0.0.1:5433` → restart service (stagger) → **chờ replica X/X + /health** → seed qua host `npx` hoặc **`cab-bootstrap-runner`** → **verify** lại).

> **Sau PHASE 18 (auto-scaler):** replica của gateway/auth/… có thể >1 trên worker; **postgres vẫn trên Primary Manager**. Reset/seed **luôn** chạy trên Manager. Lỗi kiểu `users` không tồn tại (P2021) thường do `prisma db push` chưa chạy cho **auth_db** / **user_db** vì task service nằm trên worker — script `reset-database-swarm.sh` mới xử lý SSH + fallback image, **không** dùng `docker run --network <stack>_backend` (overlay `backend` trong `docker-stack.thesis.yml` là **`internal: true`**, không attachable → Docker từ chối gắn mạng đó cho container one-off).

### Điều kiện

- PHASE 14 đã deploy xong; `curl http://127.0.0.1:3000/health` trên Manager trả OK.
- Trong **`docker-stack.thesis.yml`**, service **postgres** phải publish **`5433:5432`** (đã có trong repo) để máy Manager gọi Prisma INSERT bootstrap admin khi seed. **MongoDB** phải publish **`27017:27017`** (đã có trong repo) để `seed-database.ts` phần lịch sử + **review_db** kết nối được từ host (`bootstrap-runner --network host`). Nếu stack cũ thiếu map này: deploy lại stack (PHASE 14).
- **`REDIS_PASSWORD`** trong `.env` khớp với giá trị dùng khi deploy (biến `${REDIS_PASSWORD}` trong stack) — seed dùng khi xóa key rate-limit OTP qua `docker exec` vào Redis.
- **`POSTGRES_USER` / `POSTGRES_PASSWORD` / `MONGO_USER` / `MONGO_PASSWORD`** trong **`.env`** khớp Docker secrets và `env/*.env` (PHASE 9–11).

**(Gợi ý bảo mật)** Trong AWS Security Group, không mở **5433** ra `0.0.0.0/0` trừ khi cần; tốt nhất chỉ IP của bạn hoặc giữ không public và chỉ làm seed qua SSH trên Manager.

- Migrate Prisma **trên swarm**: task microservice có thể chạy trên **worker** — không xuất hiện trong `docker ps` trên Manager. **`reset-database-swarm.sh`** **SSH** tới từng node (`ubuntu@<private IP>`) và `docker exec` đúng task; nếu không SSH được, fallback **`docker run --rm --network host`** với `DATABASE_URL=...@127.0.0.1:5433/...` (postgres đã publish trên Manager). Cần key **`SWARM_SSH_KEY`** hoặc **`~/.ssh/swarm_key`** (deploy CI đã tạo ở `~/.ssh/swarm_key` trên Manager; nếu thiếu, copy PEM deploy và `chmod 600`). **`SWARM_NODES_SSH_USER`** mặc định `ubuntu`.

### Bootstrap **không cần npm trên EC2** (Docker — khuyến nghị)

CI/CD build image **`cab-bootstrap-runner`** (Dockerfile.bootstrap). Container có Node + Docker CLI + entrypoint tự **`npm ci`** vào volume `node_modules` (không đụng host).

**Pull + chạy một lần** (xong container tự xóa):

```bash
cd ~/cab-booking
export DOCKERHUB_USERNAME=foxxiee04   # đúng username Hub của bạn

docker pull "${DOCKERHUB_USERNAME}/cab-bootstrap-runner:latest"

docker run --rm --network host \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$PWD:/workspace:rw" \
  -v cab-booking-bootstrap-node-modules:/workspace/node_modules \
  -v "$HOME/.ssh/swarm_key:/workspace/.secrets/swarm_key:ro" \
  -e SWARM_SSH_KEY=/workspace/.secrets/swarm_key \
  -w /workspace \
  "${DOCKERHUB_USERNAME}/cab-bootstrap-runner:latest"
```

(Image mặc định chạy `bash scripts/bootstrap-system.sh` ⇢ reset → migrate → seed → verify.)

**Lưu ý:** Trên Manager cần **`git pull`** để có `docker/bootstrap-entrypoint.sh`, `Dockerfile.bootstrap`, và `scripts/bootstrap-system.sh` mới nhất (CI không đồng bộ folder `scripts/`).

**Giữ container nền rồi `docker exec` (giống “backend tool”):**

```bash
docker run -d --name cab-bootstrap-shell --restart unless-stopped --network host \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$PWD:/workspace:rw" \
  -v cab-booking-bootstrap-node-modules:/workspace/node_modules \
  -v "$HOME/.ssh/swarm_key:/workspace/.secrets/swarm_key:ro" \
  -e SWARM_SSH_KEY=/workspace/.secrets/swarm_key \
  -w /workspace \
  "${DOCKERHUB_USERNAME}/cab-bootstrap-runner:latest" \
  sleep infinity

docker exec -it cab-bootstrap-shell bash scripts/bootstrap-system.sh
```

**Docker Compose local** (cùng repo): `npm run docker:bootstrap` hoặc `docker compose --profile tools up -d bootstrap-shell` rồi `docker exec -it cab-bootstrap-shell bash scripts/bootstrap-system.sh`.

---

### Cách cũ — npm trực tiếp trên Manager

```bash
cd ~/cab-booking
npm install
chmod +x scripts/bootstrap-system.sh
./scripts/bootstrap-system.sh
```

Script sẽ: drop/tạo lại các DB PostgreSQL + drop Mongo notification/review (trong container), chạy `npx prisma migrate deploy` trong từng service task có Prisma, `docker service update --force` để các service (đặc biệt wallet) bootstrap lại, rồi chạy `scripts/seed-database.ts` qua Gateway `http://127.0.0.1:3000`.

Sau khi xong, xem `docs/seed-accounts-reference.md` trên repo (script seed tự ghi).

---

## PHASE 16 — Setup Nginx + SSL ⏭️ BỎ QUA — làm sau khi có domain

> Sẽ cấu hình sau khi tạo domain mới. Hiện tại API Gateway hoạt động trực tiếp qua `http://18.136.250.236:3000`.

---

## PHASE 17 — Verify Monitoring

**1. Kiểm tra Prometheus scrape tất cả nodes:**
```
Mở browser: http://18.136.250.236:9090/targets
```

Phải thấy:
```
node-exporter (3 targets):
  http://172.31.xx.xx:9100  → UP   (manager)
  http://172.31.xx.xx:9100  → UP   (worker-1)
  http://172.31.xx.xx:9100  → UP   (worker-2)

cadvisor (3 targets):
  http://172.31.xx.xx:8081  → UP
  http://172.31.xx.xx:8081  → UP
  http://172.31.xx.xx:8081  → UP
```

**2. Mở Grafana:**
```
URL:      http://18.136.250.236:3030
Username: admin
Password: admin123   ← deployment đầu chưa source .env nên dùng default
```

Vào **Dashboards** → chọn **"System Overview"** → thấy metrics từ cả 3 nodes.

**3. Test API Gateway:**
```bash
curl http://18.136.250.236:3000/health
# {"status":"ok","uptime":...}
```

---

## PHASE 18 — Auto-Scaler (Prometheus → docker service scale)

Auto-scaler chạy như 1 Swarm service trên Manager, query CPU từ Prometheus mỗi 30s, tự scale các stateless services.

> **Reset DB / seed sau khi bật auto-scaler:** việc scale replica **không** đổi chỗ postgres hay cách publish `5433`. Vẫn SSH vào **Primary Manager** và dùng `scripts/reset-database-swarm.sh` (hoặc `~/cab-booking/reset-and-seed.sh`) như **PHASE 15b** — tránh script cũ chỉ `docker exec` trên Manager cho `auth-service` / `user-service` khi task đang chạy trên worker.

> CI/CD đã build + push image `foxxiee04/cab-autoscaler:latest` và stack file đã khai báo service `autoscaler`. Sau khi deploy stack, auto-scaler chạy tự động.

**Xem logs auto-scaler:**
```bash
docker service logs cab-booking_autoscaler -f
# Output mẫu:
# [17:05:00] Cluster CPU: 12%
# [17:05:00]   = api-gateway: 1 replicas
# [17:05:00]   = auth-service: 1 replicas
# [17:05:30] Cluster CPU: 78%          ← traffic tăng
# [17:05:30]   ↑ SCALE UP api-gateway: 1 → 2 replicas  (CPU 78% > 65%)
# [17:05:30]   ↑ SCALE UP auth-service: 1 → 2 replicas
```

**Tuỳ chỉnh ngưỡng** (không cần redeploy — sửa env rồi `docker service update`):
```bash
docker service update \
  --env-add SCALE_UP_CPU_PCT=70 \
  --env-add SCALE_DOWN_CPU_PCT=25 \
  --env-add MAX_REPLICAS=3 \
  cab-booking_autoscaler
```

**Scale thủ công** (override auto-scaler):
```bash
docker service scale cab-booking_api-gateway=2
```

---

## PHASE 19 — Kiểm tra disk tất cả nodes

Mỗi node Spot chỉ có 19-20GB. Khi disk đầy → service crash với trạng thái `0/1`.

**Kiểm tra tất cả nodes:**
```bash
for node_id in $(docker node ls -q); do
  name=$(docker node inspect $node_id --format '{{.Description.Hostname}}')
  ip=$(docker node inspect $node_id --format '{{.Status.Addr}}')
  echo -n "=== $name ($ip) === "
  ssh -i ~/.ssh/swarm_key -o StrictHostKeyChecking=no ubuntu@$ip \
    "df -h / | tail -1" 2>/dev/null
done
```

**Ngưỡng an toàn:** dưới 80%. Nếu node nào vượt 85% → dọn ngay:
```bash
ssh -i ~/.ssh/swarm_key ubuntu@<NODE_IP> "docker system prune -af && df -h /"
```

> Docker Swarm **không tự di chuyển service** khi disk đầy — chỉ reschedule khi container crash. Phòng ngừa bằng cách prune định kỳ.

---

## PHASE 20 — Chứng minh auto-scaling hoạt động (demo/báo cáo)

### Bước 1 — Tạo traffic tăng đột biến

```bash
# Từ máy local hoặc trên Manager — gửi 200 requests song song
for i in $(seq 1 200); do
  curl -s http://18.136.250.236:3000/health &
done
wait

# Hoặc vòng lặp liên tục trong 2 phút
end=$((SECONDS + 120))
while [ $SECONDS -lt $end ]; do
  for i in $(seq 1 20); do
    curl -s http://18.136.250.236:3000/health >/dev/null &
  done
  sleep 1
done
```

### Bước 2 — Quan sát auto-scaler

```bash
# Terminal 1: xem auto-scaler log
docker service logs cab-booking_autoscaler -f

# Terminal 2: xem replicas thay đổi real-time
watch -n 5 "docker stack services cab-booking | grep -E 'api-gateway|auth-service|ride-service'"
```

### Bước 3 — Xem metric trên Grafana

```
http://18.136.250.236:3030
Dashboard: System Overview
Panel: CPU Usage, Network In/Out
```

### Bước 4 — Screenshot cho báo cáo

Cần chụp 3 màn hình:

| Màn hình | Nội dung |
|----------|----------|
| **Before** | `docker stack services` → tất cả `1/1` |
| **During** | Grafana CPU spike + auto-scaler log đang scale UP |
| **After** | `docker stack services` → các service `2/2` hoặc `3/3` |

### Bước 5 — Scale down về bình thường

Auto-scaler tự scale down khi CPU về dưới 20%. Hoặc thủ công:
```bash
docker service scale \
  cab-booking_api-gateway=1 \
  cab-booking_auth-service=1 \
  cab-booking_ride-service=1
```

---

## PHASE 21 — Cập nhật GitHub Secrets

> GitHub → repo → Settings → Secrets and variables → Actions

**Bắt buộc cập nhật (key mới đã được tạo lại):**
- `DEPLOY_SSH_KEY` → paste nội dung file `cab-key.pem` mới
  ```powershell
  # Lấy nội dung key trên Windows
  Get-Content C:\Users\sangt\.ssh\cab-key.pem
  ```

**Không cần đổi:**
- `DEPLOY_HOST` vẫn là `18.136.250.236` ✅
- `DEPLOY_USER` vẫn là `ubuntu` ✅

**Đổi nếu cần:**
- `REACT_APP_API_URL` = `http://18.136.250.236:3000` ← dùng IP tạm, cập nhật domain sau
- `REACT_APP_SOCKET_URL` = `http://18.136.250.236:3000`

CI/CD pipeline sẽ tự chạy `docker stack deploy` lên Manager mới — hoàn toàn tự động.

---

## Sau khi xong — Kiểm tra nhanh

```bash
# Trên Primary Manager
docker node ls                          # 4 nodes: 2 manager + 2 worker
docker stack services cab-booking       # tất cả 1/1 REPLICAS
docker stack ps cab-booking --filter "desired-state=running"  # phân bổ đúng node
curl localhost:3000/health              # API Gateway OK
```

---

## Thêm Spot Worker mới (scale out)

Khi muốn thêm worker:

1. **AWS Console** → Launch Instance → spot t3.medium (giống bước 6)
2. **SSH vào worker mới:**
   ```bash
   ssh -i C:\Users\sangt\.ssh\cab-key.pem ubuntu@<NEW_WORKER_PUBLIC_IP>
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker ubuntu && newgrp docker
   docker swarm join --token SWMTKN-1-zzz...yyy <MANAGER_PRIVATE_IP>:2377
   ```
3. **Swarm tự động** spread services sang worker mới (hoặc rebalance thủ công):
   ```bash
   # Trên Manager — force rebalance
   docker service update --force cab-booking_auth-service
   ```
4. **Prometheus tự phát hiện** node mới qua Docker socket — không cần sửa config.

---

## Xử lý khi Spot Worker bị terminate

Docker Swarm tự xử lý:
1. Phát hiện node `Down` trong ~10 giây
2. Reschedule tất cả tasks sang workers còn lại trong ~30 giây
3. Khi Spot instance mới spin up (persistent request), nó tự join lại Swarm
4. Swarm lại schedule tasks sang node mới

> Stateful services (Postgres, MongoDB, Redis, RabbitMQ) an toàn vì **chỉ chạy trên Manager on-demand**.

---

## Tại sao Elastic IP chỉ gắn vào Primary Manager?

**Elastic IP = địa chỉ IP cố định, không đổi khi stop/start instance.**

Chỉ cần gắn vào Primary Manager vì:

1. **DNS trỏ vào đây**: `foxgo.online`, `api.foxgo.online`, `driver.foxgo.online`, `admin.foxgo.online` đều trỏ vào `18.136.250.236`. Nếu IP thay đổi, toàn bộ domain hỏng.

2. **API Gateway chạy trên Manager**: Đây là điểm vào duy nhất từ internet (port 3000). Workers không cần IP public cố định vì chúng chỉ nhận traffic từ Manager qua overlay network nội bộ — không ai kết nối thẳng vào worker.

3. **Secondary Manager**: chỉ làm nhiệm vụ Raft consensus (bầu leader nội bộ), không cần IP public cố định. Nếu Primary Manager fail, Secondary trở thành Leader nhưng sẽ cần reassociate Elastic IP thủ công — chấp nhận được với thesis setup.

4. **Workers (spot)**: IP public thay đổi mỗi lần stop/start là bình thường. Swarm giao tiếp qua private IP trong VPC (172.31.x.x), không qua public IP.

> **Chi phí Elastic IP**: Miễn phí khi gắn với instance đang chạy. Tính $0.005/giờ khi instance bị stop hoặc IP chưa gắn vào đâu.

---

## Chi phí ước tính (ap-southeast-1, Singapore)

### Giá theo giờ khi đang chạy

| Node | Loại | Giá/giờ |
|------|------|---------|
| foxgo-manager (t3.medium) | on-demand | $0.0528 |
| foxgo-manager-2 (t3.small) | on-demand | $0.0264 |
| foxgo-worker-1 (t3.medium) | spot | ~$0.0160 |
| foxgo-worker-2 (t3.medium) | spot | ~$0.0160 |
| **Tổng khi chạy** | | **~$0.111/giờ** |

### Chi phí EBS (tính cả khi stop — luôn mất tiền)

| Node | Dung lượng | Chi phí/tháng |
|------|-----------|--------------|
| foxgo-manager | 30 GB gp3 | $2.40 |
| foxgo-manager-2 | 15 GB gp3 | $1.20 |
| foxgo-worker-1 | 20 GB gp3 | $1.60 |
| foxgo-worker-2 | 20 GB gp3 | $1.60 |
| **Tổng EBS** | | **$6.80/tháng** |

> gp3 tính $0.08/GB/month tại Singapore

### Elastic IP khi instance stopped

Khi stop Manager → Elastic IP tạm "unassociated" → tính $0.005/giờ

---

### Kịch bản chi phí thực tế

#### Kịch bản 1 — Chạy 24/7 (không tắt)
| Hạng mục | Tính | Chi phí/tháng |
|----------|------|--------------|
| Compute (720h) | $0.111 × 720 | $79.92 |
| EBS | | $6.80 |
| Elastic IP | free (instance running) | $0 |
| **Tổng** | | **~$87/tháng** |

#### Kịch bản 2 — Bật 3h/ngày để test, 30 ngày (90 giờ chạy)
| Hạng mục | Tính | Chi phí/tháng |
|----------|------|--------------|
| Compute (90h) | $0.111 × 90 | $9.99 |
| EBS | | $6.80 |
| Elastic IP khi stop (630h) | $0.005 × 630 | $3.15 |
| **Tổng** | | **~$20/tháng** |

#### Kịch bản 3 — Chỉ bật khi demo/bảo vệ (~5 lần × 3h = 15 giờ)
| Hạng mục | Tính | Chi phí/tháng |
|----------|------|--------------|
| Compute (15h) | $0.111 × 15 | $1.67 |
| EBS | | $6.80 |
| Elastic IP khi stop (705h) | $0.005 × 705 | $3.53 |
| **Tổng** | | **~$12/tháng** |

### Cách stop/start để tiết kiệm

**Stop tất cả (khi không dùng):**
```bash
# Từ AWS CLI hoặc Console
# EC2 → chọn tất cả instances → Instance state → Stop
```

**Start lại khi cần:**
```
EC2 → chọn tất cả → Instance state → Start
```

> ⚠️ Khi Start lại: Worker Public IP sẽ đổi (không có Elastic IP). Nhưng **không cần làm gì thêm** — Swarm dùng Private IP nội bộ để giao tiếp, Swarm tự reconnect. Chỉ Manager giữ IP cố định nhờ Elastic IP.

> ⚠️ Khi start lại Manager: Elastic IP tự gắn lại → `18.136.250.236` hoạt động ngay → DNS vẫn đúng.
