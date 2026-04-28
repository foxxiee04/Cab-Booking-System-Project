# Triển khai Docker Swarm Cluster trên AWS EC2

> Region: **ap-southeast-1 (Singapore)** — gần Việt Nam nhất, latency ~20ms  
> Công nghệ: **Docker Swarm** — đơn giản hơn K8s, phù hợp hệ thống luận văn  
> Đã có sẵn: `docker-stack.yml` với replicas, rolling update, overlay network

---

## 1. Kiến trúc tổng thể

```
Internet
    │
    ▼
┌─────────────────────────────────────┐
│     AWS Application Load Balancer   │  ← HTTPS :443 / :80
│         (1 ALB, public subnet)      │
└─────────────┬───────────────────────┘
              │ port 3000 / 4000-4002
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      VPC  10.0.0.0/16                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Public Subnet  10.0.1.0/24                    │ │
│  │                                                            │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │       MANAGER NODE  (Swarm Manager + Worker)         │  │ │
│  │  │       EC2: t3.large  |  IP: 10.0.1.10 (+ Elastic IP) │  │ │
│  │  │                                                      │  │ │
│  │  │  • api-gateway   ×3 replicas                         │  │ │
│  │  │  • PostgreSQL    ×1 (pinned to manager)              │  │ │
│  │  │  • MongoDB       ×1 (pinned to manager)              │  │ │
│  │  │  • Redis         ×1                                  │  │ │
│  │  │  • RabbitMQ      ×1                                  │  │ │
│  │  │  • Prometheus / Grafana / Loki  (monitoring)         │  │ │
│  │  │  • Nginx (frontend SPAs: :4000, :4001, :4002)        │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │                                                            │ │
│  │  ┌──────────────────────┐  ┌───────────────────────┐       │ │
│  │  │  WORKER-1            │  │  WORKER-2             │       │ │
│  │  │  EC2: t3.large       │  │  EC2: t3.medium       │       │ │
│  │  │  IP: 10.0.1.11       │  │  IP: 10.0.1.12        │       │ │
│  │  │                      │  │                       │       │ │
│  │  │  • auth-service  ×2  │  │  • booking-service ×2 │       │ │
│  │  │  • ride-service  ×3  │  │  • pricing-service ×2 │       │ │
│  │  │  • driver-service×3  │  │  • payment-service ×2 │       │ │
│  │  │  • wallet-service×2  │  │  • notification-svc×2 │       │ │
│  │  │  • review-service×2  │  │  • ai-service      ×2 │       │ │
│  │  │  • user-service  ×2  │  │                       │       │ │
│  │  └──────────────────────┘  └───────────────────────┘       │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

Overlay networks (mã hóa TLS tự động):
  • frontend  (overlay) — api-gateway ↔ load balancer
  • backend   (overlay, internal) — tất cả microservices
```

---

## 2. Chi phí ước tính (ap-southeast-1, On-Demand, tháng 4/2026)

### Gói A — Tối thiểu cho demo / luận văn (~$130–145/tháng)

| Thành phần | Instance | vCPU | RAM | $/giờ | $/tháng |
|-----------|---------|------|-----|-------|---------|
| Manager node | t3.large | 2 | 8GB | $0.0928 | **$67.7** |
| Worker-1 | t3.medium | 2 | 4GB | $0.0464 | **$33.8** |
| EBS gp3 30GB × 2 node | — | — | — | — | **$4.8** |
| Elastic IP (1 cái) | — | — | — | free* | **$0** |
| Data transfer out (ước ~10GB) | — | — | — | $0.09/GB | **$0.9** |
| **Tổng** | | | | | **~$107/tháng** |

> *Elastic IP miễn phí khi gắn vào instance đang chạy

### Gói B — Recommended production 3 node (~$185–200/tháng)

| Thành phần | Instance | vCPU | RAM | $/giờ | $/tháng |
|-----------|---------|------|-----|-------|---------|
| Manager node | t3.large | 2 | 8GB | $0.0928 | **$67.7** |
| Worker-1 | t3.large | 2 | 8GB | $0.0928 | **$67.7** |
| Worker-2 | t3.medium | 2 | 4GB | $0.0464 | **$33.8** |
| EBS gp3 30GB × 3 node | — | — | — | $0.08/GB | **$7.2** |
| ALB (Application Load Balancer) | — | — | — | $0.008/hr | **$6.0** |
| Elastic IP (1 cái) | — | — | — | free | **$0** |
| Data transfer out (~20GB) | — | — | — | $0.09/GB | **$1.8** |
| **Tổng** | | | | | **~$184/tháng** |

### Gói C — Tiết kiệm: Reserved Instance 1 năm (Gói B)

| Loại | Tiết kiệm | $/tháng |
|------|-----------|---------|
| On-Demand | 0% | ~$184 |
| Reserved 1yr (No Upfront) | ~35% | **~$120** |
| Reserved 1yr (All Upfront) | ~40% | **~$110** |
| Spot Instances (workers only) | ~70% (không ổn định) | ~$90 |

---

## 3. Bước 1: Tạo VPC và Security Groups

### 3.1 Tạo VPC (bỏ qua nếu dùng Default VPC)

```
AWS Console → VPC → Create VPC
  Name: cab-booking-vpc
  IPv4 CIDR: 10.0.0.0/16

AWS Console → Subnets → Create Subnet
  Name: cab-booking-public
  VPC: cab-booking-vpc
  CIDR: 10.0.1.0/24
  AZ: ap-southeast-1a
```

### 3.2 Tạo Security Groups

**SG 1: `cab-swarm-managers`** (cho Manager node)

| Type | Protocol | Port | Source | Mô tả |
|------|---------|------|--------|-------|
| SSH | TCP | 22 | Your IP/32 | Admin SSH |
| Custom TCP | TCP | 3000 | 0.0.0.0/0 | API Gateway |
| Custom TCP | TCP | 4000-4002 | 0.0.0.0/0 | Frontend SPAs |
| Custom TCP | TCP | 2377 | cab-swarm-workers | Swarm cluster mgmt |
| Custom TCP | TCP | 7946 | cab-swarm-workers | Container network discovery |
| Custom UDP | UDP | 7946 | cab-swarm-workers | Container network discovery |
| Custom UDP | UDP | 4789 | cab-swarm-workers | Overlay network (VXLAN) |

**SG 2: `cab-swarm-workers`** (cho Worker nodes)

| Type | Protocol | Port | Source | Mô tả |
|------|---------|------|--------|-------|
| SSH | TCP | 22 | Your IP/32 | Admin SSH |
| Custom TCP | TCP | 2377 | cab-swarm-managers | Swarm cluster mgmt |
| Custom TCP | TCP | 7946 | cab-swarm-managers | Network discovery |
| Custom UDP | UDP | 7946 | cab-swarm-managers | Network discovery |
| Custom UDP | UDP | 4789 | cab-swarm-managers | Overlay VXLAN |
| All traffic | All | All | cab-swarm-workers | Inter-worker communication |

> ⚠️ Port 3001–3010 và 50051–50059 KHÔNG cần mở ra ngoài — chỉ giao tiếp qua overlay network nội bộ

---

## 4. Bước 2: Launch EC2 Instances

### 4.1 AMI và cấu hình chung

```
AMI: Ubuntu Server 24.04 LTS (HVM), SSD Volume Type
     ami-0c55b159cbfafe1f0 (ap-southeast-1)

Key pair: dùng key pair đã có hoặc tạo mới
Network: cab-booking-vpc  (hoặc Default VPC)
Subnet: ap-southeast-1a (public subnet)
Auto-assign public IP: Enable (chỉ Manager, workers có thể tắt)
```

### 4.2 Launch 3 instances

**Instance 1 — Manager**
```
Name: cab-manager-1
Type: t3.large
Security Group: cab-swarm-managers
Storage: 30GB gp3
```

**Instance 2 — Worker-1**
```
Name: cab-worker-1
Type: t3.large
Security Group: cab-swarm-workers
Storage: 30GB gp3
```

**Instance 3 — Worker-2**
```
Name: cab-worker-2
Type: t3.medium
Security Group: cab-swarm-workers
Storage: 30GB gp3
```

### 4.3 Gắn Elastic IP cho Manager

```
EC2 → Elastic IPs → Allocate Elastic IP address
→ Associate → chọn cab-manager-1
```

Ghi lại:
- `MANAGER_PUBLIC_IP` = Elastic IP vừa gắn
- `MANAGER_PRIVATE_IP` = 10.0.1.x (từ EC2 console)
- `WORKER1_PRIVATE_IP` = 10.0.1.y
- `WORKER2_PRIVATE_IP` = 10.0.1.z

---

## 5. Bước 3: Cài đặt Docker trên TẤT CẢ 3 nodes

SSH vào từng node và chạy:

```bash
# Chạy trên manager, worker-1, worker-2 (lần lượt)
ssh -i your-key.pem ubuntu@<NODE_IP>

# Script cài Docker + các tool cần thiết
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu
sudo apt-get install -y nginx rsync

# Khởi động lại session để group docker có hiệu lực
exit
ssh -i your-key.pem ubuntu@<NODE_IP>
docker --version  # kiểm tra
```

---

## 6. Bước 4: Khởi tạo Docker Swarm

### 6.1 Init Swarm trên Manager

```bash
# SSH vào Manager
ssh -i your-key.pem ubuntu@<MANAGER_PUBLIC_IP>

# Init với private IP (không phải public IP — để internal communication)
docker swarm init --advertise-addr <MANAGER_PRIVATE_IP>

# Output sẽ có dạng:
# docker swarm join --token SWMTKN-1-xxxxx <MANAGER_PRIVATE_IP>:2377
# → LƯU TOKEN NÀY LẠI
```

### 6.2 Join Workers vào Swarm

```bash
# Lấy join token (nếu đã quên)
docker swarm join-token worker   # chạy trên manager

# SSH vào Worker-1
ssh -i your-key.pem ubuntu@<WORKER1_PUBLIC_IP>
docker swarm join --token SWMTKN-1-xxxxx <MANAGER_PRIVATE_IP>:2377

# SSH vào Worker-2
ssh -i your-key.pem ubuntu@<WORKER2_PUBLIC_IP>
docker swarm join --token SWMTKN-1-xxxxx <MANAGER_PRIVATE_IP>:2377
```

### 6.3 Kiểm tra cluster

```bash
# Chạy trên Manager
docker node ls

# Output mong muốn:
# ID                  HOSTNAME     STATUS  AVAILABILITY  MANAGER STATUS
# abc123 *            cab-manager  Ready   Active        Leader
# def456              cab-worker-1 Ready   Active
# ghi789              cab-worker-2 Ready   Active
```

### 6.4 Gắn label cho nodes (để phân bổ services)

```bash
# Trên Manager — đặt label cho workers
docker node update --label-add role=app cab-worker-1
docker node update --label-add role=app cab-worker-2
docker node update --label-add role=infra cab-manager-1

# Optional: label cho AI node nếu muốn pin ml workload
docker node update --label-add ml=true cab-worker-1
```

---

## 7. Bước 5: Tạo Docker Secrets

```bash
# Trên Manager — tạo secrets từ command line
echo "postgres" | docker secret create postgres_user -
echo "YourStrongPassword123!" | docker secret create postgres_password -
echo "mongo" | docker secret create mongo_user -
echo "YourMongoPassword123!" | docker secret create mongo_password -

# Kiểm tra
docker secret ls
```

---

## 8. Bước 6: Upload code và deploy Stack

### 8.1 Copy các file cần thiết lên Manager

```bash
# Từ máy local
scp -i your-key.pem docker-stack.yml ubuntu@<MANAGER_PUBLIC_IP>:~/cab-booking/
scp -i your-key.pem scripts/init-db.sql ubuntu@<MANAGER_PUBLIC_IP>:~/cab-booking/scripts/
scp -i your-key.pem -r monitoring ubuntu@<MANAGER_PUBLIC_IP>:~/cab-booking/
scp -i your-key.pem -r env ubuntu@<MANAGER_PUBLIC_IP>:~/cab-booking/
```

### 8.2 Tạo file .env trên Manager

```bash
# SSH vào Manager
cat > ~/cab-booking/.env << 'EOF'
DOCKERHUB_USERNAME=your-dockerhub-username
IMAGE_TAG=latest

POSTGRES_USER=postgres
POSTGRES_PASSWORD=YourStrongPassword123!
MONGO_USER=mongo
MONGO_PASSWORD=YourMongoPassword123!
RABBITMQ_USER=rabbit
RABBITMQ_PASS=RabbitPassword123!
REDIS_PASSWORD=RedisPassword123!

JWT_SECRET=your-256-bit-jwt-secret-here
REFRESH_TOKEN_SECRET=your-refresh-secret-here
INTERNAL_SERVICE_TOKEN=your-internal-token-here

GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin123
EOF
```

### 8.3 Deploy Stack

```bash
# SSH vào Manager
cd ~/cab-booking
export $(cat .env | grep -v ^# | xargs)

docker stack deploy \
  --compose-file docker-stack.yml \
  --with-registry-auth \
  cab-booking

# Theo dõi tiến trình
docker stack services cab-booking
watch docker stack ps cab-booking
```

### 8.4 Kiểm tra services chạy

```bash
docker service ls
# Mong muốn: tất cả REPLICAS đạt X/X (ví dụ 3/3, 2/2)

# Xem logs 1 service
docker service logs cab-booking_api-gateway --follow --tail 50

# Xem service chạy trên node nào
docker service ps cab-booking_ride-service
```

---

## 9. Bước 7: Cài Nginx cho Frontend trên Manager

```bash
# SSH vào Manager
sudo cp ~/cab-booking/deploy/nginx/nginx-apps.conf /etc/nginx/sites-available/cab-apps
sudo ln -sf /etc/nginx/sites-available/cab-apps /etc/nginx/sites-enabled/cab-apps
sudo nginx -t && sudo systemctl enable nginx && sudo systemctl start nginx

# Tạo thư mục build (CI/CD sẽ rsync vào đây)
mkdir -p ~/customer-build ~/driver-build ~/admin-build
```

---

## 10. Bước 8: Setup Application Load Balancer (Gói B)

> Nếu chỉ dùng Gói A (2 node), bỏ qua bước này — dùng trực tiếp Elastic IP

```
EC2 → Load Balancers → Create Load Balancer → Application Load Balancer

Name: cab-booking-alb
Scheme: Internet-facing
IP type: IPv4
Listeners: HTTP:80, HTTPS:443 (cần cấu hình SSL cert)
VPC: cab-booking-vpc
AZ: chọn ap-southeast-1a

Target Groups:
  TG-1: cab-api-gateway
        Protocol: HTTP, Port: 3000
        Health check: /health
        Targets: Manager node
  
  TG-2: cab-frontend
        Protocol: HTTP, Port: 4000 / 4001 / 4002
        Targets: Manager node

Listener Rules:
  /api/*         → TG-1 (api-gateway)
  /socket.io/*   → TG-1 (api-gateway, sticky sessions bật)
  /* port 4000   → TG-2 customer-app
  /* port 4001   → TG-2 driver-app
  /* port 4002   → TG-2 admin-app
```

> ⚠️ **Socket.IO cần Sticky Sessions**: ALB → Target Group → Attributes → Stickiness = **Application-based** (duration: 1 day)

---

## 11. Cập nhật CI/CD để deploy lên Swarm

Thêm job `deploy-swarm` vào `.github/workflows/ci-cd.yml` (thay thế `deploy-backend`):

```yaml
deploy-swarm:
  name: Deploy - Docker Swarm
  runs-on: ubuntu-latest
  needs: [docker-build-and-push]
  if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'
  environment:
    name: production
  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Copy stack files to Manager
      uses: appleboy/scp-action@v0.1.7
      with:
        host: ${{ secrets.DEPLOY_HOST }}
        username: ${{ secrets.DEPLOY_USER }}
        key: ${{ secrets.DEPLOY_SSH_KEY }}
        port: ${{ secrets.DEPLOY_PORT || 22 }}
        source: "docker-stack.yml,scripts/init-db.sql,monitoring/"
        target: "~/cab-booking/"

    - name: Deploy stack to Swarm
      uses: appleboy/ssh-action@v1.0.3
      with:
        host: ${{ secrets.DEPLOY_HOST }}
        username: ${{ secrets.DEPLOY_USER }}
        key: ${{ secrets.DEPLOY_SSH_KEY }}
        port: ${{ secrets.DEPLOY_PORT || 22 }}
        script: |
          set -e
          cd ~/cab-booking

          # Login Docker Hub để pull private images (nếu có)
          echo "${{ secrets.DOCKERHUB_TOKEN }}" | \
            docker login -u "${{ secrets.DOCKERHUB_USERNAME }}" --password-stdin

          # Set image tag = git sha của commit vừa push
          export IMAGE_TAG=${{ github.sha }}
          export DOCKERHUB_USERNAME=${{ secrets.DOCKERHUB_USERNAME }}
          set -o allexport; source .env; set +o allexport

          echo "▶ Deploying stack cab-booking (tag=$IMAGE_TAG)..."
          docker stack deploy \
            --compose-file docker-stack.yml \
            --with-registry-auth \
            --resolve-image always \
            cab-booking

          echo "▶ Waiting for services to converge..."
          sleep 30
          docker stack services cab-booking

          echo "✅ Swarm deployment complete"
```

---

## 12. Vận hành hàng ngày

### Xem trạng thái cluster

```bash
# Tất cả services và số replicas
docker service ls

# Service nào đang fail
docker stack ps cab-booking --filter "desired-state=failed"

# Logs real-time
docker service logs cab-booking_api-gateway -f

# Tài nguyên từng node
docker node inspect --format '{{ .Description.Resources }}' self
```

### Scale services thủ công

```bash
# Tăng replicas
docker service scale cab-booking_ride-service=5

# Giảm xuống khi traffic thấp
docker service scale cab-booking_ai-service=1
```

### Rolling update thủ công

```bash
# Force update (re-pull image latest)
docker service update --image your-hub/cab-ride-service:latest cab-booking_ride-service

# Update toàn bộ stack với tag mới
export IMAGE_TAG=abc1234
docker stack deploy -c docker-stack.yml --with-registry-auth cab-booking
```

### Rollback service khi lỗi

```bash
docker service rollback cab-booking_api-gateway
```

### Backup Database

```bash
# PostgreSQL
docker exec $(docker ps -q -f name=cab-booking_postgres) \
  pg_dumpall -U postgres > backup-$(date +%Y%m%d).sql

# MongoDB
docker exec $(docker ps -q -f name=cab-booking_mongodb) \
  mongodump --out /backup/$(date +%Y%m%d) \
  --username mongo --password YourMongoPassword123!
```

---

## 13. Monitoring

Sau khi deploy, truy cập:

| Service | URL | Mô tả |
|---------|-----|-------|
| Grafana | `http://<MANAGER_IP>:3006` | Dashboards (admin/admin123) |
| Prometheus | `http://<MANAGER_IP>:9090` | Metrics raw |
| RabbitMQ | `http://<MANAGER_IP>:15672` | Queue management |
| cAdvisor | `http://<MANAGER_IP>:8081` | Container resource usage |

---

## 14. Tóm tắt chi phí

| Gói | Cấu hình | $/tháng | Phù hợp |
|-----|---------|---------|---------|
| **A — Demo** | Manager t3.large + 1 Worker t3.medium | ~$107 | Bảo vệ luận văn |
| **B — Prod 3 node** | 1×t3.large + 2×(t3.large + t3.medium) | ~$184 | Demo live |
| **B Reserved 1yr** | Gói B, trả trước 1 năm | ~$120 | Tiết kiệm nhất |
| **C — Full HA** | 3×t3.large + 1×t3.xlarge (DB) | ~$340 | Production thực |

> 💡 **Mẹo tiết kiệm**: Dùng **AWS Free Tier** cho tháng đầu (t2.micro × 750 giờ), sau đó nâng lên Gói A khi gần bảo vệ. Tổng chi phí 3 tháng demo = **~$0 (free tier) + $107 × 2 = $214**.
