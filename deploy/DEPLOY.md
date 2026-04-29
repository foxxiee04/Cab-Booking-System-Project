# Hướng dẫn Deploy — Cab Booking System trên AWS EC2

> **Hệ thống thực tế đang chạy**
> - Instance: EC2 `t3.large` (4 vCPU, 8 GB RAM) — `ap-southeast-1` (Singapore)
> - IP công khai: `18.136.250.236`
> - Domain: `foxgo.online` (Namecheap + Let's Encrypt SSL)
> - Orchestration: Docker Swarm single-node
> - CI/CD: GitHub Actions → Docker Hub → SSH deploy
> - SSH key: `C:\Users\sangt\.ssh\cab-key.pem`

---

## Mục lục

1. [Kiến trúc tổng thể](#1-kiến-trúc-tổng-thể)
2. [Tạo EC2 Instance từ đầu](#2-tạo-ec2-instance-từ-đầu)
3. [Cài đặt môi trường trên server](#3-cài-đặt-môi-trường-trên-server)
4. [Cấu hình Docker Swarm](#4-cấu-hình-docker-swarm)
5. [Cấu hình DNS và Nginx](#5-cấu-hình-dns-và-nginx)
6. [SSL với Let's Encrypt](#6-ssl-với-lets-encrypt)
7. [Cấu hình môi trường ứng dụng](#7-cấu-hình-môi-trường-ứng-dụng)
8. [Deploy lần đầu](#8-deploy-lần-đầu)
9. [GitHub Actions CI/CD](#9-github-actions-cicd)
10. [Monitoring Stack](#10-monitoring-stack)
11. [Vận hành hàng ngày](#11-vận-hành-hàng-ngày)
12. [Chi phí AWS](#12-chi-phí-aws)

---

## 1. Kiến trúc tổng thể

```
Internet
    │
    ├── https://foxgo.online          → Nginx :80/:443 → /home/ubuntu/customer-build
    ├── https://driver.foxgo.online   → Nginx :80/:443 → /home/ubuntu/driver-build
    ├── https://admin.foxgo.online    → Nginx :80/:443 → /home/ubuntu/admin-build
    └── https://api.foxgo.online      → Nginx :80/:443 → localhost:3000 (API Gateway)
                                                │
                            ┌───────────────────┴──────────────────────┐
                            │  EC2 t3.large — 18.136.250.236            │
                            │  Ubuntu 22.04, Docker Swarm (1 node)      │
                            │                                           │
                            │  ┌─────── Docker Swarm Stack ──────────┐ │
                            │  │  Infrastructure                      │ │
                            │  │    PostgreSQL :5433 (7 databases)   │ │
                            │  │    MongoDB    :27017 (2 databases)   │ │
                            │  │    Redis      :6379                  │ │
                            │  │    RabbitMQ   :5672 / :15672        │ │
                            │  │                                      │ │
                            │  │  Business Services                   │ │
                            │  │    api-gateway      :3000            │ │
                            │  │    auth-service     :3001            │ │
                            │  │    ride-service     :3002            │ │
                            │  │    driver-service   :3003            │ │
                            │  │    payment-service  :3004            │ │
                            │  │    notification     :3005            │ │
                            │  │    wallet-service   :3006            │ │
                            │  │    user-service     :3007            │ │
                            │  │    booking-service  :3008            │ │
                            │  │    pricing-service  :3009            │ │
                            │  │    review-service   :3010            │ │
                            │  │    ai-service       :8000            │ │
                            │  │                                      │ │
                            │  │  Monitoring                          │ │
                            │  │    Prometheus  :9090                 │ │
                            │  │    Grafana     :3030                 │ │
                            │  │    Loki        :3100                 │ │
                            │  │    Promtail    (log collector)       │ │
                            │  │    cAdvisor    :8081                 │ │
                            │  │    Node Exporter :9100               │ │
                            │  └──────────────────────────────────────┘ │
                            │                                           │
                            │  Nginx (host)                            │
                            │    Port 80/443 → React SPAs + API proxy  │
                            └───────────────────────────────────────────┘
```

**Security Group `cab-swarm-sg`:**

| Port | Mục đích | Source |
|------|---------|--------|
| 22 | SSH | 0.0.0.0/0 |
| 80 | HTTP (Let's Encrypt + redirect) | 0.0.0.0/0 |
| 443 | HTTPS | 0.0.0.0/0 |
| 3000 | API Gateway (direct, optional) | 0.0.0.0/0 |
| 4000 | Customer App (direct, optional) | 0.0.0.0/0 |
| 4001 | Driver App (direct, optional) | 0.0.0.0/0 |
| 4002 | Admin Dashboard (direct, optional) | 0.0.0.0/0 |
| 3030 | Grafana | IP cá nhân |
| 9090 | Prometheus | IP cá nhân |
| 15672 | RabbitMQ UI | IP cá nhân |
| 2377 | Docker Swarm management | 0.0.0.0/0 |
| 7946 | Swarm node discovery | 0.0.0.0/0 |
| 4789 | Overlay VXLAN | 0.0.0.0/0 |

---

## 2. Tạo EC2 Instance từ đầu

### 2.1 Tạo Key Pair

```
AWS Console → EC2 → Key Pairs → Create key pair
  Name: cab-key
  Type: RSA
  Format: .pem
→ Download về C:\Users\sangt\.ssh\cab-key.pem
```

### 2.2 Tạo Security Group

```
AWS → EC2 → Security Groups → Create
  Name: cab-swarm-sg
  VPC: default
→ Thêm Inbound rules như bảng ở mục 1
```

### 2.3 Launch EC2 Instance

```
AWS → EC2 → Launch Instance
  Name: cab-manager
  AMI: Ubuntu Server 22.04 LTS (x86_64)
  Instance type: t3.large (4 vCPU, 8 GB RAM)
  Key pair: cab-key
  Security group: cab-swarm-sg
  Storage: 30 GB gp3

→ Launch Instance
```

### 2.4 Gán Elastic IP (giữ IP cố định khi stop/start)

```
AWS → EC2 → Elastic IPs → Allocate Elastic IP
→ Associate → chọn instance cab-manager
```

---

## 3. Cài đặt môi trường trên server

SSH vào server:
```bash
ssh -i "C:\Users\sangt\.ssh\cab-key.pem" ubuntu@18.136.250.236
```

### 3.1 Cài Docker

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
newgrp docker
docker --version
```

### 3.2 Cài Nginx và Certbot

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
sudo systemctl enable nginx
```

### 3.3 Tạo thư mục cho React builds

```bash
mkdir -p /home/ubuntu/customer-build
mkdir -p /home/ubuntu/driver-build
mkdir -p /home/ubuntu/admin-build

# Cho Nginx đọc được
sudo chmod o+x /home/ubuntu
```

### 3.4 Tạo thư mục deploy

```bash
mkdir -p ~/cab-booking/env
mkdir -p ~/cab-booking/monitoring
```

---

## 4. Cấu hình Docker Swarm

```bash
# Khởi tạo Swarm (single-node)
docker swarm init --advertise-addr 172.31.19.49

# Xác nhận
docker node ls
# Phải thấy: ID ... Status=Ready, Availability=Active, Manager Status=Leader
```

---

## 5. Cấu hình DNS và Nginx

### 5.1 DNS trên Namecheap

Vào `foxgo.online` → Advanced DNS → thêm:

| Type | Host | Value |
|------|------|-------|
| A Record | `@` | `18.136.250.236` |
| A Record | `www` | `18.136.250.236` |
| A Record | `api` | `18.136.250.236` |
| A Record | `driver` | `18.136.250.236` |
| A Record | `admin` | `18.136.250.236` |

Xóa các record cũ xung đột (CNAME www, URL Redirect @).

### 5.2 Cấu hình Nginx

```bash
sudo nano /etc/nginx/conf.d/foxgo.conf
```

```nginx
server {
    listen 80;
    server_name foxgo.online www.foxgo.online;
    root /home/ubuntu/customer-build;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
}

server {
    listen 80;
    server_name driver.foxgo.online;
    root /home/ubuntu/driver-build;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
}

server {
    listen 80;
    server_name admin.foxgo.online;
    root /home/ubuntu/admin-build;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
}

server {
    listen 80;
    server_name api.foxgo.online;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 6. SSL với Let's Encrypt

```bash
# Đảm bảo port 80 đã mở trong Security Group
sudo certbot --nginx \
  -d foxgo.online \
  -d www.foxgo.online \
  -d api.foxgo.online \
  -d driver.foxgo.online \
  -d admin.foxgo.online

# Certbot tự renew mỗi 90 ngày — kiểm tra timer
sudo systemctl status certbot.timer
```

---

## 7. Cấu hình môi trường ứng dụng

### 7.1 File .env chính

```bash
nano ~/cab-booking/.env
```

```env
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<strong-password>
MONGO_USER=mongo
MONGO_PASSWORD=<strong-password>
RABBITMQ_USER=admin
RABBITMQ_PASS=<strong-password>
REDIS_PASSWORD=<strong-password>

# Security
JWT_SECRET=<random-32-chars>
REFRESH_TOKEN_SECRET=<random-32-chars>
INTERNAL_SERVICE_TOKEN=<random-32-chars>

# SMS OTP
OTP_SMS_MODE=mock   # hoặc: sns | twilio | speedsms

# Docker Hub
DOCKERHUB_USERNAME=foxxiee04

# Monitoring
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=<strong-password>
```

### 7.2 Khởi tạo PostgreSQL databases

```bash
# Chạy sau khi stack đã up
PGID=$(docker ps --filter "name=cab-booking_postgres" --format "{{.ID}}" | head -1)
for db in auth_db booking_db driver_db payment_db ride_db user_db wallet_db; do
  docker exec "$PGID" psql -U postgres -c "CREATE DATABASE $db;" 2>/dev/null || true
done
```

---

## 8. Deploy lần đầu

```bash
cd ~/cab-booking

# Đăng nhập Docker Hub (cần 1 lần)
docker login -u foxxiee04

# Deploy stack
docker stack deploy \
  -c docker-stack.thesis.yml \
  --with-registry-auth \
  cab-booking

# Xem trạng thái
docker stack services cab-booking
docker stack ps cab-booking

# Xem logs service bất kỳ
docker service logs cab-booking_api-gateway --tail 50 -f
```

---

## 9. GitHub Actions CI/CD

### 9.1 Secrets cần thiết (GitHub → Settings → Secrets)

| Secret | Giá trị |
|--------|---------|
| `DOCKERHUB_USERNAME` | `foxxiee04` |
| `DOCKERHUB_TOKEN` | Docker Hub access token |
| `DEPLOY_HOST` | `18.136.250.236` |
| `DEPLOY_USER` | `ubuntu` |
| `DEPLOY_SSH_KEY` | Nội dung file `cab-key.pem` |
| `REACT_APP_API_URL` | `https://api.foxgo.online` |
| `REACT_APP_SOCKET_URL` | `https://api.foxgo.online` |

### 9.2 Pipeline workflow

```
git push origin main
        │
        ▼
┌── Stage 1: Tests (parallel, continue-on-error) ──┐
│  test-unit  test-contract  test-integration  test-ai │
└──────────────────────────────────────────────────────┘
        │
        ▼
┌── Stage 2: Docker Build & Push (12 services, matrix) ─┐
│  Build images → push foxxiee04/cab-<service>:latest    │
└────────────────────────────────────────────────────────┘
        │
        ├── Stage 3a: Deploy Backend ──────────────────────
        │     SCP: docker-stack.thesis.yml + monitoring/
        │     SSH: docker stack deploy cab-booking
        │
        └── Stage 3b: Deploy Frontend (3 apps parallel) ──
              npm build → rsync → /home/ubuntu/*-build/
              sudo systemctl reload nginx
```

### 9.3 Deploy thủ công

```bash
# Trigger deploy không cần thay đổi code
git commit --allow-empty -m "ci: manual redeploy"
git push origin main
```

---

## 10. Monitoring Stack

Monitoring chạy cùng stack, truy cập qua IP trực tiếp:

| Service | URL | Tài khoản |
|---------|-----|-----------|
| **Grafana** | http://18.136.250.236:3030 | admin / (xem .env) |
| **Prometheus** | http://18.136.250.236:9090 | — |
| **RabbitMQ UI** | http://18.136.250.236:15672 | admin / (xem .env) |

Grafana tự load 4 dashboard:
- **System Overview** — CPU, Memory, Disk, Network của EC2
- **Container Resources** — CPU/Memory từng service Docker
- **Application Metrics** — RabbitMQ queues, API Gateway AI matching
- **Service Logs** — Tìm kiếm log từ tất cả services qua Loki

Xem chi tiết: [`monitoring/README.md`](../monitoring/README.md)

---

## 11. Vận hành hàng ngày

### Kiểm tra sức khỏe hệ thống

```bash
# Tất cả services đang chạy?
docker stack services cab-booking

# Service nào bị crash/restart?
docker stack ps cab-booking --no-trunc | grep -v Running

# Xem log service lỗi
docker service logs cab-booking_<service-name> --tail 100

# API Gateway health
curl https://api.foxgo.online/health
curl https://api.foxgo.online/ready
```

### Restart một service

```bash
docker service update --force cab-booking_api-gateway
```

### Scale service (tăng replicas)

```bash
docker service scale cab-booking_api-gateway=2
```

### Cập nhật image thủ công (không qua CI/CD)

```bash
cd ~/cab-booking
docker stack deploy -c docker-stack.thesis.yml --with-registry-auth cab-booking
docker image prune -f
```

### Stop/Start EC2 (tiết kiệm chi phí)

```bash
# KHÔNG tắt instance, dùng AWS Console:
# EC2 → Instance → Stop Instance
# → Elastic IP giữ nguyên → domain không bị mất
# Khi cần dùng lại: Start Instance → stack tự resume
```

### Backup database

```bash
PGID=$(docker ps --filter "name=cab-booking_postgres" --format "{{.ID}}" | head -1)

# Backup tất cả databases
for db in auth_db booking_db driver_db payment_db ride_db user_db wallet_db; do
  docker exec "$PGID" pg_dump -U postgres "$db" > ~/backup_${db}_$(date +%Y%m%d).sql
done
```

---

## 12. Chi phí AWS

### Cấu hình đang dùng

| Resource | Chi phí |
|----------|---------|
| EC2 t3.large (on-demand) | ~$0.0736/giờ |
| EBS 30 GB gp3 | ~$2.4/tháng |
| Elastic IP (khi instance running) | Miễn phí |
| Elastic IP (khi instance stopped) | $0.005/giờ |
| Data transfer out | $0.09/GB |

### Ước tính theo mức sử dụng

| Kịch bản | Chi phí/tháng |
|----------|---------------|
| Chạy 24/7 (production) | ~$57 |
| Chạy 8h/ngày (demo thường xuyên) | ~$20 |
| Chạy 3h/ngày (thesis defense) | ~$8 |
| Stop khi không dùng | ~$2.4 (chỉ EBS) |

**Tiết kiệm:** Stop instance khi không cần → chỉ tính phí EBS ~$2.4/tháng.

---

## Troubleshooting

### Service không start được

```bash
# Xem lý do
docker service ps cab-booking_<service> --no-trunc

# Thường gặp:
# - Image không pull được → kiểm tra DOCKERHUB credentials
# - OOM (Out of Memory) → giảm số services chạy đồng thời
# - DB connection failed → kiểm tra .env credentials
```

### Nginx 500 error

```bash
sudo tail -20 /var/log/nginx/error.log
# Thường do permission: sudo chmod o+x /home/ubuntu
```

### HTTPS cert hết hạn

```bash
sudo certbot renew --dry-run    # test
sudo certbot renew              # renew thật
sudo systemctl reload nginx
```

### PostgreSQL databases missing

```bash
PGID=$(docker ps --filter "name=cab-booking_postgres" --format "{{.ID}}" | head -1)
for db in auth_db booking_db driver_db payment_db ride_db user_db wallet_db; do
  docker exec "$PGID" psql -U postgres -c "CREATE DATABASE $db;" 2>/dev/null || echo "$db already exists"
done
```
