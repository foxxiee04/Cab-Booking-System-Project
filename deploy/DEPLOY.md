# Hướng dẫn Deploy — Docker Swarm trên AWS EC2 (Tạo mới từ đầu)

> **Tình huống**: Đã xóa tất cả instances cũ. Hướng dẫn này tạo lại hoàn toàn từ đầu.
>
> **Cấu hình khuyến nghị cho thesis**: 2 node — 1 Manager (t3.large) + 1 Worker (t3.medium)
> - Đủ RAM cho toàn bộ 11 services + monitoring
> - Chi phí ~$18/tháng nếu test 3h/ngày
>
> **Key file**: `C:\Users\sangt\.ssh\cab-key.pem`
>
> **IP thực tế**:
> - Manager public: `18.136.250.236` | private: `172.31.19.49`
> - Worker-1 public: `13.229.108.196` | private: `172.31.40.233`

---

## Tổng quan kiến trúc (2-node)

```
Internet  →  <ELASTIC_IP>:3000  (API Gateway)
             <ELASTIC_IP>:4000  (Customer App - Nginx)
             <ELASTIC_IP>:4001  (Driver App - Nginx)
             <ELASTIC_IP>:4002  (Admin Dashboard - Nginx)
                   │
            ┌──────┴───────────────────────────────────────┐
            │  MANAGER  (t3.large, 8GB RAM)                 │
            │  Name: cab-manager                            │
            │  Public:  18.136.250.236                        │
            │  Private: 172.31.19.49                        │
            │                                               │
            │  Infra:  PostgreSQL, MongoDB, Redis, RabbitMQ │
            │  App:    api-gateway (:3000)                  │
            │  Web:    Nginx (:4000, :4001, :4002)          │
            │  Mon:    Prometheus, Grafana, Loki            │
            └──────────────┬────────────────────────────────┘
                           │  Docker Swarm overlay network (TLS)
                           │
               ┌───────────┴────────────────────────────┐
               │  WORKER-1 (t3.medium, 4GB RAM)          │
               │  Name: cab-worker-1                     │
               │  label: worker=1                        │
               │                                         │
               │  auth / ride / driver / payment         │
               │  wallet / user / booking / pricing      │
               │  notification / review / ai-service     │
               └─────────────────────────────────────────┘

  Monitoring agents (mode: global — chạy trên cả 2 node):
    promtail, cadvisor, node-exporter
```

> Manager private IP: `172.31.19.49` — đã dùng ở Bước 8.

---

## CHECKLIST

- [ ] **B1** Tạo Key Pair
- [ ] **B2** Kiểm tra / Cấp phát Elastic IP
- [ ] **B3** Tạo Security Group `cab-swarm-sg`
- [ ] **B4** Launch Manager (t3.large)
- [ ] **B5** Gán Elastic IP cho Manager
- [ ] **B6** Launch Worker-1 (t3.medium)
- [ ] **B7** Cài Docker trên cả 2 node
- [ ] **B8** Khởi tạo Swarm + Join Worker
- [ ] **B9** Tạo Docker secrets
- [ ] **B10** Tạo file .env trên Manager
- [ ] **B11** Cập nhật env service (máy local) + Upload
- [ ] **B12** Cập nhật stack cho 1 worker + Cấu hình Nginx
- [ ] **B13** Docker Hub token
- [ ] **B14** GitHub Secrets
- [ ] **B15** Deploy stack + Verify

---

## BƯỚC 1 — Tạo Key Pair

```
AWS Console → EC2 → Network & Security → Key Pairs
→ Create key pair
```

Điền chính xác:

| Field | Giá trị |
|-------|---------|
| Name | `cab-key` |
| Key pair type | RSA |
| Private key file format | `.pem` |
| Tags | *(để trống)* |

→ **Create key pair**

File `cab-key.pem` tự tải về máy (thường vào `Downloads`).

**Di chuyển key về đúng chỗ — PowerShell:**
```powershell
# Tạo thư mục .ssh nếu chưa có
New-Item -ItemType Directory -Force -Path "C:\Users\sangt\.ssh"

# Di chuyển file key
Move-Item "$env:USERPROFILE\Downloads\cab-key.pem" "C:\Users\sangt\.ssh\cab-key.pem"

# Kiểm tra
Test-Path "C:\Users\sangt\.ssh\cab-key.pem"
# Phải ra: True
```

**Fix permission** — PowerShell **chạy với quyền Admin** (chuột phải → Run as administrator):
```powershell
$keyPath = "C:\Users\sangt\.ssh\cab-key.pem"
icacls $keyPath /inheritance:r
icacls $keyPath /grant:r "sangt:R"
```

> Thay `sangt` bằng Windows username thực nếu khác (kiểm tra bằng `$env:USERNAME`).

---

## BƯỚC 2 — Kiểm tra / Cấp phát Elastic IP

```
AWS Console → EC2 → Network & Security → Elastic IPs
```

**IP hiện tại**: Manager đang dùng public IP trực tiếp `47.129.52.192` (không có Elastic IP riêng — OK cho thesis).

> Nếu muốn Elastic IP cố định: Allocate → Associate với instance `cab-manager`.

> ⚠️ Elastic IP bị tính $0.005/giờ khi **chưa gán** cho running instance. Gán ngay ở Bước 5.

---

## BƯỚC 3 — Tạo Security Group

```
AWS Console → EC2 → Network & Security → Security Groups
→ Create security group
```

**Basic details:**

| Field | Giá trị |
|-------|---------|
| Security group name | `cab-swarm-sg` |
| Description | `Cab Booking Docker Swarm` |
| VPC | *(chọn default VPC — thường là cái duy nhất trong danh sách)* |

**Inbound rules** — nhấn "Add rule" từng dòng một:

| # | Type | Protocol | Port range | Source | Description |
|---|------|----------|------------|--------|-------------|
| 1 | SSH | TCP | 22 | My IP | SSH từ máy cá nhân |
| 2 | Custom TCP | TCP | 2377 | Anywhere IPv4 | Docker Swarm management |
| 3 | Custom TCP | TCP | 7946 | Anywhere IPv4 | Swarm node discovery TCP |
| 4 | Custom UDP | UDP | 7946 | Anywhere IPv4 | Swarm node discovery UDP |
| 5 | Custom UDP | UDP | 4789 | Anywhere IPv4 | Overlay VXLAN |
| 6 | Custom TCP | TCP | 3000 | Anywhere IPv4 | API Gateway |
| 7 | Custom TCP | TCP | 4000 | Anywhere IPv4 | Customer App |
| 8 | Custom TCP | TCP | 4001 | Anywhere IPv4 | Driver App |
| 9 | Custom TCP | TCP | 4002 | Anywhere IPv4 | Admin Dashboard |
| 10 | Custom TCP | TCP | 9090 | My IP | Prometheus |
| 11 | Custom TCP | TCP | 3030 | My IP | Grafana |
| 12 | Custom TCP | TCP | 15672 | My IP | RabbitMQ UI |

**Outbound rules**: giữ nguyên mặc định (All traffic, Anywhere IPv4).

→ **Create security group**

---

## BƯỚC 4 — Launch Manager (t3.large)

```
AWS Console → EC2 → Instances → Launch instances
```

### Name and tags
| Field | Giá trị |
|-------|---------|
| Name | `cab-manager` |

### Application and OS Images
```
→ Quick Start → Ubuntu
→ AMI: Ubuntu Server 24.04 LTS (HVM), SSD Volume Type
  Chú ý: chọn bản 64-bit (x86), không phải ARM
```

### Instance type
```
→ t3.large   (2 vCPU / 8 GiB)
```

### Key pair (login)
```
→ Select existing key pair: cab-key
```

### Network settings → nhấn Edit
| Field | Giá trị |
|-------|---------|
| VPC | *(default VPC)* |
| Subnet | `ap-southeast-1a` |
| Auto-assign public IP | **Enable** |
| Firewall | **Select existing security group** |
| Security groups | `cab-swarm-sg` |

### Configure storage
| Field | Giá trị |
|-------|---------|
| Size (GiB) | `30` |
| Volume type | `gp3` |
| IOPS | 3000 |
| Throughput | 125 |
| Delete on termination | Yes |

### Launch
→ **Launch instance**

**Sau khi instance `Running`, ghi lại:**
```
EC2 → cab-manager → Details tab:
  Public IPv4 address  = 18.136.250.236
  Private IPv4 address = 172.31.19.49
```

---

## BƯỚC 5 — Gán Elastic IP cho Manager

```
AWS Console → EC2 → Network & Security → Elastic IPs
→ Chọn dòng Elastic IP (18.136.113.224)
→ Actions → Associate Elastic IP address
```

| Field | Giá trị |
|-------|---------|
| Resource type | Instance |
| Instance | `cab-manager` ← chọn từ dropdown |
| Private IP address | *(để trống — tự điền)* |

→ **Associate**

**Xác nhận**: EC2 → cab-manager → Public IPv4 address = `18.136.250.236`

---

## BƯỚC 6 — Launch Worker-1 (t3.medium)

```
AWS Console → EC2 → Instances → Launch instances
```

### Name and tags
| Field | Giá trị |
|-------|---------|
| Name | `cab-worker-1` |

### Application and OS Images
```
→ Ubuntu Server 24.04 LTS (HVM), SSD Volume Type, 64-bit (x86)
  (giống hệt Manager)
```

### Instance type
```
→ t3.medium   (2 vCPU / 4 GiB)
```

### Key pair
```
→ Select existing key pair: cab-key   ← cùng key với Manager
```

### Network settings → Edit
| Field | Giá trị |
|-------|---------|
| VPC | *(default VPC)* |
| Subnet | `ap-southeast-1a` ← **PHẢI CÙNG AZ với Manager** |
| Auto-assign public IP | **Enable** |
| Firewall | **Select existing security group** |
| Security groups | `cab-swarm-sg` |

### Configure storage
| Field | Giá trị |
|-------|---------|
| Size (GiB) | `20` |
| Volume type | `gp3` |

→ **Launch instance**

**Ghi lại:**
```
EC2 → cab-worker-1 → Details tab:
  Public IPv4 address  = 13.229.108.196
  Private IPv4 address = 172.31.40.233
```

---

## BƯỚC 7 — Cài Docker trên cả 2 node

### 7.1 SSH + cài trên Manager

Mở **PowerShell** trên máy local:
```powershell
ssh -i "C:\Users\sangt\.ssh\cab-key.pem" ubuntu@18.136.250.236
```

Lần đầu kết nối:
```
The authenticity of host '18.136.113.224' can't be established.
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
```

Trên Manager chạy:
```bash
# Cài Docker Engine
curl -fsSL https://get.docker.com | sh

# Thêm ubuntu vào group docker
sudo usermod -aG docker ubuntu

# Áp dụng ngay không cần logout
newgrp docker

# Cài Nginx và rsync (dùng cho frontend)
sudo apt-get update -y
sudo apt-get install -y nginx rsync

# Tạo cấu trúc thư mục
mkdir -p ~/cab-booking/env
mkdir -p ~/cab-booking/monitoring/prometheus
mkdir -p ~/cab-booking/monitoring/loki
mkdir -p ~/cab-booking/monitoring/promtail
mkdir -p ~/customer-build ~/driver-build ~/admin-build

# Cho phép CI/CD reload nginx không cần sudo password
echo "ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl reload nginx" | sudo tee /etc/sudoers.d/nginx-reload

# Kiểm tra
docker --version
# Docker version 27.x.x, build ...

nginx -v
# nginx version: nginx/1.x.x
```

### 7.2 SSH + cài trên Worker-1

Mở **tab PowerShell mới** (giữ tab Manager vẫn mở):
```powershell
ssh -i "C:\Users\sangt\.ssh\cab-key.pem" ubuntu@13.229.108.196
```

Trên Worker-1 chạy:
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu
newgrp docker

# Kiểm tra
docker --version
```

---

## BƯỚC 8 — Khởi tạo Docker Swarm

### 8.1 Init Swarm trên Manager

**SSH vào Manager**, chạy:
```bash
docker swarm init --advertise-addr 172.31.19.49
```

Output mẫu:
```
Swarm initialized: current node (xxxxxxxxxxx) is now a manager.

To add a worker to this swarm, run the following command:

    docker swarm join --token SWMTKN-1-xxxxxxxxxxxxxxxxxx-xxxxxxxxxxxxxxxxxx 172.31.19.49:2377

To add a manager to this swarm, run 'docker swarm join-token manager' and follow the instructions.
```

> **SAO CHÉP TOÀN BỘ LỆNH** `docker swarm join --token ...` — sẽ dùng ở 8.2.

### 8.2 Join Worker-1 vào Swarm

**SSH vào Worker-1**, paste lệnh vừa copy:
```bash
docker swarm join --token SWMTKN-1-xxxxxxxxxxxxxxxxxx-xxxxxxxxxxxxxxxxxx 172.31.19.49:2377
# Output: This node joined a swarm as a worker.
```

### 8.3 Xác nhận cluster

**Trên Manager**:
```bash
docker node ls
```

Kết quả mong muốn:
```
ID                            HOSTNAME            STATUS    AVAILABILITY   MANAGER STATUS   ENGINE VERSION
xxxxxxxxxxxxxxxxxxx *         ip-172-31-XX-XX     Ready     Active         Leader           27.x.x
yyyyyyyyyyyyyyyyyyy           ip-172-31-AA-BB     Ready     Active                          27.x.x
```

### 8.4 Gắn label cho Worker-1

```bash
# Lấy HOSTNAME của worker từ cột HOSTNAME ở trên (dạng ip-172-31-AA-BB)
docker node update --label-add worker=1 <hostname-worker-1>

# Ví dụ:
# docker node update --label-add worker=1 ip-172-31-15-45

# Xác nhận
docker node inspect --format '{{ .Spec.Labels }}' <hostname-worker-1>
# Output: map[worker:1]
```

---

## BƯỚC 9 — Tạo Docker Secrets

**SSH vào Manager**:
```bash
echo "postgres"         | docker secret create postgres_user -
echo "CabBooking2026!"  | docker secret create postgres_password -
echo "mongo"            | docker secret create mongo_user -
echo "CabMongo2026!"    | docker secret create mongo_password -

# Xác nhận — phải thấy đúng 4 dòng
docker secret ls
```

---

## BƯỚC 10 — Tạo file .env chính trên Manager

**SSH vào Manager**:
```bash
cat > ~/cab-booking/.env << 'EOF'
DOCKERHUB_USERNAME=YOUR_DOCKERHUB_USERNAME
IMAGE_TAG=latest

RABBITMQ_USER=rabbit
RABBITMQ_PASS=CabRabbit2026!
REDIS_PASSWORD=CabRedis2026!

GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin123
EOF
```

> Thay `YOUR_DOCKERHUB_USERNAME` bằng Docker Hub username thực (sẽ tạo ở Bước 13).
> Sửa trực tiếp: `nano ~/cab-booking/.env`

---

## BƯỚC 11 — Cập nhật file env service (máy local) + Upload

Mở VS Code, **sửa từng file** trong thư mục `env/`. Nội dung mẫu đầy đủ cho từng service:

---

**`env/gateway.env`**
```env
NODE_ENV=production
PORT=3000
JWT_SECRET=CabJwtSecret2026SuperLong32Chars!
INTERNAL_SERVICE_TOKEN=CabInternalToken2026!
REDIS_URL=redis://:CabRedis2026!@redis:6379
RABBITMQ_URL=amqp://rabbit:CabRabbit2026!@rabbitmq:5672
LOCATION_DATABASE_URL=postgresql://postgres:CabBooking2026!@postgres:5432/ride_db
AUTH_SERVICE_URL=http://auth-service:3001
RIDE_SERVICE_URL=http://ride-service:3002
DRIVER_SERVICE_URL=http://driver-service:3003
PAYMENT_SERVICE_URL=http://payment-service:3004
BOOKING_SERVICE_URL=http://booking-service:3008
USER_SERVICE_URL=http://user-service:3007
WALLET_SERVICE_URL=http://wallet-service:3006
NOTIFICATION_SERVICE_URL=http://notification-service:3005
PRICING_SERVICE_URL=http://pricing-service:3009
REVIEW_SERVICE_URL=http://review-service:3010
```

---

**`env/auth.env`**
```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://postgres:CabBooking2026!@postgres:5432/auth_db
JWT_SECRET=CabJwtSecret2026SuperLong32Chars!
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=CabRefreshSecret2026SuperLong32!
REFRESH_TOKEN_EXPIRES_IN=7d
RABBITMQ_URL=amqp://rabbit:CabRabbit2026!@rabbitmq:5672
INTERNAL_SERVICE_TOKEN=CabInternalToken2026!
REDIS_URL=redis://:CabRedis2026!@redis:6379
OTP_SMS_MODE=mock
```

---

**`env/ride.env`**
```env
NODE_ENV=production
PORT=3002
DATABASE_URL=postgresql://postgres:CabBooking2026!@postgres:5432/ride_db
JWT_SECRET=CabJwtSecret2026SuperLong32Chars!
INTERNAL_SERVICE_TOKEN=CabInternalToken2026!
REDIS_URL=redis://:CabRedis2026!@redis:6379
RABBITMQ_URL=amqp://rabbit:CabRabbit2026!@rabbitmq:5672
```

---

**`env/driver.env`**
```env
NODE_ENV=production
PORT=3003
DATABASE_URL=postgresql://postgres:CabBooking2026!@postgres:5432/driver_db
JWT_SECRET=CabJwtSecret2026SuperLong32Chars!
INTERNAL_SERVICE_TOKEN=CabInternalToken2026!
REDIS_URL=redis://:CabRedis2026!@redis:6379
RABBITMQ_URL=amqp://rabbit:CabRabbit2026!@rabbitmq:5672
```

---

**`env/payment.env`**
```env
NODE_ENV=production
PORT=3004
DATABASE_URL=postgresql://postgres:CabBooking2026!@postgres:5432/payment_db
JWT_SECRET=CabJwtSecret2026SuperLong32Chars!
INTERNAL_SERVICE_TOKEN=CabInternalToken2026!
RABBITMQ_URL=amqp://rabbit:CabRabbit2026!@rabbitmq:5672
MOMO_NOTIFY_URL=http://18.136.250.236:3000/api/payments/ipn/momo
MOMO_RETURN_URL=http://18.136.250.236:3000/api/payments/momo/return
VNPAY_NOTIFY_URL=http://18.136.250.236:3000/api/payments/ipn/vnpay
VNPAY_RETURN_URL=http://18.136.250.236:3000/api/payments/vnpay/return
```

---

**`env/notification.env`**
```env
NODE_ENV=production
PORT=3005
MONGODB_URI=mongodb://mongo:CabMongo2026!@mongodb:27017/notification_db?authSource=admin
REDIS_URL=redis://:CabRedis2026!@redis:6379
RABBITMQ_URL=amqp://rabbit:CabRabbit2026!@rabbitmq:5672
```

---

**`env/wallet.env`**
```env
NODE_ENV=production
PORT=3006
DATABASE_URL=postgresql://postgres:CabBooking2026!@postgres:5432/wallet_db
JWT_SECRET=CabJwtSecret2026SuperLong32Chars!
INTERNAL_SERVICE_TOKEN=CabInternalToken2026!
RABBITMQ_URL=amqp://rabbit:CabRabbit2026!@rabbitmq:5672
```

---

**`env/user.env`**
```env
NODE_ENV=production
PORT=3007
DATABASE_URL=postgresql://postgres:CabBooking2026!@postgres:5432/user_db
JWT_SECRET=CabJwtSecret2026SuperLong32Chars!
INTERNAL_SERVICE_TOKEN=CabInternalToken2026!
```

---

**`env/booking.env`**
```env
NODE_ENV=production
PORT=3008
DATABASE_URL=postgresql://postgres:CabBooking2026!@postgres:5432/booking_db
RABBITMQ_URL=amqp://rabbit:CabRabbit2026!@rabbitmq:5672
INTERNAL_SERVICE_TOKEN=CabInternalToken2026!
```

---

**`env/pricing.env`**
```env
NODE_ENV=production
PORT=3009
REDIS_URL=redis://:CabRedis2026!@redis:6379
RABBITMQ_URL=amqp://rabbit:CabRabbit2026!@rabbitmq:5672
```

---

**`env/review.env`**
```env
NODE_ENV=production
PORT=3010
MONGODB_URI=mongodb://mongo:CabMongo2026!@mongodb:27017/review_db?authSource=admin
JWT_SECRET=CabJwtSecret2026SuperLong32Chars!
INTERNAL_SERVICE_TOKEN=CabInternalToken2026!
RABBITMQ_URL=amqp://rabbit:CabRabbit2026!@rabbitmq:5672
```

---

> ⚠️ Không commit các file này lên GitHub — đã có trong `.gitignore`.

**Upload lên Manager — PowerShell trên máy local:**
```powershell
$key    = "C:\Users\sangt\.ssh\cab-key.pem"
$server = "ubuntu@18.136.250.236"
$repo   = "e:\Nam4 - Ki 2\KLTN2025\Cab-Booking-System-Project"

# Upload tất cả file env
scp -i $key -r "$repo\env" "${server}:~/cab-booking/"

# Upload monitoring config (prometheus, loki, promtail)
scp -i $key -r "$repo\monitoring" "${server}:~/cab-booking/"

# Upload Swarm stack file
scp -i $key "$repo\docker-stack.thesis.yml" "${server}:~/cab-booking/"
```

Xác nhận trên Manager:
```bash
ls ~/cab-booking/env/
# auth.env  booking.env  driver.env  gateway.env  notification.env
# payment.env  pricing.env  review.env  ride.env  user.env  wallet.env

ls ~/cab-booking/
# .env  docker-stack.thesis.yml  env/  monitoring/
```

---

## BƯỚC 12 — Cấu hình stack + Nginx

### 12.1 Chỉnh stack cho 1 worker

Vì chỉ có Worker-1 với label `worker=1`, cần gộp các services từ `worker=2` sang `worker=1`:

**SSH vào Manager:**
```bash
cd ~/cab-booking

# Thay tất cả "worker == 2" thành "worker == 1" trong stack file
sed -i 's/node.labels.worker == 2/node.labels.worker == 1/g' docker-stack.thesis.yml

# Kiểm tra không còn dòng nào chứa worker == 2
grep "worker == 2" docker-stack.thesis.yml
# Không có output = OK
```

### 12.2 Cấu hình Nginx

```bash
sudo tee /etc/nginx/sites-available/cab-apps > /dev/null << 'EOF'
server {
    listen 4000;
    server_name _;
    root /home/ubuntu/customer-build;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
server {
    listen 4001;
    server_name _;
    root /home/ubuntu/driver-build;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
server {
    listen 4002;
    server_name _;
    root /home/ubuntu/admin-build;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

# Bật config mới, tắt default
sudo ln -sf /etc/nginx/sites-available/cab-apps /etc/nginx/sites-enabled/cab-apps
sudo rm -f /etc/nginx/sites-enabled/default

# Kiểm tra config hợp lệ
sudo nginx -t
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# Enable + Start
sudo systemctl enable nginx
sudo systemctl start nginx

# Xem trạng thái
sudo systemctl status nginx
# Active: active (running) ...
```

---

## BƯỚC 13 — Tạo Docker Hub Access Token

Truy cập **[hub.docker.com](https://hub.docker.com)** → đăng nhập.

```
Avatar (góc trên phải) → Account Settings → Security
→ Personal access tokens → Generate new token

Access token description: github-actions-cab-booking
Expiration:               No expiration
Permissions:              Read & Write

→ Generate
```

→ **SAO CHÉP TOKEN NGAY** (chỉ hiện 1 lần, không xem lại được)

Ghi lại:
- `DOCKERHUB_USERNAME` = username Docker Hub của bạn
- `DOCKERHUB_TOKEN` = token vừa copy

**Cập nhật file .env trên Manager:**
```bash
# SSH vào Manager
nano ~/cab-booking/.env
# Thay YOUR_DOCKERHUB_USERNAME bằng username thực → Ctrl+O → Enter → Ctrl+X
```

---

## BƯỚC 14 — Cấu hình GitHub Secrets

```
github.com/foxxiee04/Cab-Booking-System-Project
→ Settings → Secrets and variables → Actions
→ New repository secret  (làm từng cái một)
```

**Thêm 7 secrets** (nhấn "New repository secret" mỗi lần):

| Secret name | Giá trị |
|------------|---------|
| `DOCKERHUB_USERNAME` | Docker Hub username của bạn |
| `DOCKERHUB_TOKEN` | token vừa tạo ở Bước 13 |
| `DEPLOY_HOST` | `18.136.250.236` |
| `DEPLOY_USER` | `ubuntu` |
| `DEPLOY_SSH_KEY` | toàn bộ nội dung file `cab-key.pem` |
| `REACT_APP_API_URL` | `http://18.136.250.236:3000/api` |
| `REACT_APP_SOCKET_URL` | `http://18.136.250.236:3000` |

**Lấy nội dung `DEPLOY_SSH_KEY`** — PowerShell:
```powershell
Get-Content "C:\Users\sangt\.ssh\cab-key.pem" | clip
```

→ Paste vào ô Value. Nội dung phải bắt đầu bằng `-----BEGIN RSA PRIVATE KEY-----` và kết thúc bằng `-----END RSA PRIVATE KEY-----`.

---

## BƯỚC 15 — Deploy Stack + Verify

### 15.1 Deploy

**SSH vào Manager:**
```bash
cd ~/cab-booking

# Load biến từ .env
set -o allexport; source .env; set +o allexport

# Kiểm tra biến đã load đúng
echo "DockerHub: $DOCKERHUB_USERNAME"

# Deploy stack
docker stack deploy \
  -c docker-stack.thesis.yml \
  --with-registry-auth \
  cab-booking
```

### 15.2 Theo dõi tiến trình

```bash
# Xem tất cả services — chờ đến khi tất cả REPLICAS = 1/1
watch -n 5 docker stack services cab-booking
```

Lần đầu mất ~5–10 phút (phải pull images từ Docker Hub).

Nếu service nào bị `0/1` sau 10 phút:
```bash
# Xem lý do
docker service ps cab-booking_<service-name> --no-trunc

# Xem logs
docker service logs cab-booking_<service-name> --tail 50
```

### 15.3 Kiểm tra phân bổ node

```bash
# api-gateway phải chạy trên Manager
docker service ps cab-booking_api-gateway

# ride-service phải chạy trên Worker-1
docker service ps cab-booking_ride-service

# Test API Gateway
curl http://localhost:3000/health
```

### 15.4 Chạy CI/CD để build frontend

```
github.com/foxxiee04/Cab-Booking-System-Project
→ Actions → CI/CD - Docker Hub
→ Run workflow → Branch: main → Run workflow
```

CI/CD sẽ build 3 React apps → rsync lên Manager → reload nginx.

---

## Vận hành hàng ngày

### Bật cluster để test
```
AWS Console → EC2 → chọn cab-manager + cab-worker-1 → Instance state → Start
```
Chờ ~2 phút → Docker Swarm tự kết nối lại, không cần làm gì thêm.

### Tắt cluster khi xong
```
AWS Console → EC2 → chọn cab-manager + cab-worker-1 → Instance state → Stop
```

> ✅ Tất cả data (PostgreSQL, MongoDB) vẫn còn trên EBS  
> ✅ Elastic IP vẫn là `18.136.113.224`  
> ✅ Swarm labels, secrets, config vẫn còn  
> ✅ Không cần setup lại gì — `docker stack deploy` lại là xong

### Lệnh thường dùng (trên Manager)
```bash
docker service ls                                              # trạng thái tất cả services
docker service ps cab-booking_api-gateway                      # node đang chạy service
docker service logs cab-booking_ride-service -f                # logs real-time
docker service logs cab-booking_auth-service 2>&1 | grep OTP   # lấy OTP khi test
docker service rollback cab-booking_api-gateway                # rollback khi lỗi
docker stack rm cab-booking                                    # xóa stack (giữ volumes)
```

---

## Monitoring

| Service | URL | Tài khoản |
|---------|-----|-----------|
| Grafana | http://18.136.250.236:3030 | admin / admin123 |
| Prometheus | http://18.136.250.236:9090 | — |
| RabbitMQ | http://18.136.250.236:15672 | rabbit / CabRabbit2026! |
| API Gateway | http://18.136.250.236:3000/health | — |
| Customer App | http://18.136.250.236:4000 | — |
| Driver App | http://18.136.250.236:4001 | — |
| Admin Dashboard | http://18.136.250.236:4002 | — |

---

## Chi phí thực tế (ap-southeast-1)

| Instance | Giá/giờ | RAM | Dùng cho |
|---------|--------|-----|---------|
| t3.large | $0.0832 | 8GB | Manager |
| t3.medium | $0.0464 | 4GB | Worker |
| EBS gp3 30GB | — | — | $2.40/tháng |
| EBS gp3 20GB | — | — | $1.60/tháng |
| Elastic IP khi stopped | $0.005/giờ | — | max $3.60/tháng |

| Cấu hình | Giá/giờ chạy | Test 3h/ngày × 30 ngày | Chỉ stopped |
|---------|-------------|----------------------|------------|
| **2 node** (Manager + 1 Worker) ← đang dùng | **$0.130** | **~$19/tháng** | ~$7/tháng |
| 3 node (Manager + 2 Worker) | $0.176 | ~$23/tháng | ~$8/tháng |
| 1 node (Manager only) | $0.0832 | ~$11/tháng | ~$5/tháng |

> AWS tính theo **giây** — bật 2 tiếng test xong tắt = $0.26.
