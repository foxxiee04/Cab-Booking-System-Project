# CHƯƠNG 7: KIẾN TRÚC TRIỂN KHAI (DOCKER SWARM)

---

## 7.1. Mục Tiêu Triển Khai

Triển khai hệ thống trên môi trường mô phỏng doanh nghiệp quy mô nhỏ:
- VirtualBox + CentOS 10
- Docker Swarm (Manager + Worker)
- Overlay network, service discovery nội bộ
- Replicas, rolling update, self-healing

Mục tiêu học thuật:
- Chứng minh khả năng thiết kế và vận hành hệ thống phân tán
- Trình bày rõ **logical deployment** và **physical deployment**

---

## 7.2. Môi Trường Hạ Tầng (VirtualBox + CentOS)

### 7.2.1. Sơ đồ vật lý (Physical deployment)

Gợi ý topology (tối thiểu 3 VM):
- **VM1**: Swarm Manager
- **VM2**: Worker-1
- **VM3**: Worker-2

Gợi ý cấu hình VM (có thể điều chỉnh theo máy):
- Manager: 2 vCPU, 4GB RAM
- Worker: 2 vCPU, 4GB RAM mỗi node
- Network: Host-only (internal) + NAT (ra internet để pull image)

ASCII:

```
VirtualBox Host
 ├─ VM1: centos-manager (Swarm Manager)
 ├─ VM2: centos-worker1 (Swarm Worker)
 └─ VM3: centos-worker2 (Swarm Worker)

Network:
- NAT: update/pull images
- Host-only/Private: swarm overlay communication
```

---

## 7.3. Logical Deployment Architecture

### 7.3.1. Các lớp triển khai

- **Edge layer**: API Gateway (và/hoặc Nginx ingress)
- **Service layer**: auth/ride/driver/payment/notification/ai
- **Data layer**: PostgreSQL, MongoDB, Redis, RabbitMQ
- **Observability layer**: Prometheus, Grafana (Chương 9)

### 7.3.2. Network segmentation

Trong Swarm:
- `frontend` (overlay): lớp edge, nơi gateway expose port
- `backend` (overlay, internal): services nội bộ + databases giao tiếp
- `monitoring` (overlay): observability stack (Prometheus/Grafana)

Nguyên tắc:
- Database không expose ra network public
- Chỉ API Gateway (và WebSocket endpoint nếu tách riêng) được publish port ra ngoài

---

## 7.4. Docker Swarm – Các Thành Phần Kỹ Thuật

### 7.4.1. Swarm Manager vs Worker

- **Manager**:
  - lưu cluster state
  - schedule tasks
  - chịu trách nhiệm raft consensus
- **Worker**:
  - chạy containers/tasks

Khuyến nghị:
- Không chạy workload “nặng” trên manager (tùy quy mô demo)

### 7.4.2. Service Discovery

Docker Swarm cung cấp DNS nội bộ:
- service name: `auth-service`, `ride-service`, ...
- load balancing qua VIP hoặc DNSRR

### 7.4.3. Replicas và Rolling Update

- Stateless services scale bằng `replicas: N`
- Rolling update:
  - update từng replica
  - rollback khi healthcheck fail (mô tả ở mức kiến trúc)

### 7.4.4. Self-healing

Swarm tự reschedule task khi:
- container crash
- node down

---

## 7.5. Deployment Layout (vai trò từng node)

Gợi ý phân bổ:

- **Manager**:
  - API Gateway (replica 1)
  - RabbitMQ (1)
  - Prometheus/Grafana (1) (tùy)

- **Worker-1**:
  - Ride Service (2)
  - Notification Service (2)
  - Redis (1)

- **Worker-2**:
  - Auth Service (2)
  - Driver Service (2)
  - Payment Service (2)
  - PostgreSQL (1), MongoDB (1)
  - AI Service (1)

Lưu ý: Trong khóa luận, có thể đặt database ở 1 node để đơn giản; nhấn mạnh trade-off về SPOF.

---

## 7.6. Lưu Trữ Dữ Liệu (Volumes)

Các dịch vụ stateful cần volume:
- PostgreSQL data
- MongoDB data
- Redis (nếu persistence bật)
- RabbitMQ data

Trong Swarm:
- Dùng named volumes (đơn giản)
- Hoặc NFS/GlusterFS (mô tả như hướng mở rộng)

---

## 7.7. Secrets & Config

- Dùng `docker secret` cho:
  - JWT signing key
  - DB passwords
  - RabbitMQ credentials

- Dùng `docker config` cho:
  - gateway config
  - prom/grafana config

---

## 7.8. Ví dụ Swarm Stack (mang tính mô tả)

Ví dụ lược giản `docker-stack.yml` (minh họa các ý chính):

```yaml
version: "3.8"

networks:
  frontend:
    driver: overlay
  backend:
    driver: overlay

services:
  api-gateway:
    image: your-registry/api-gateway:latest
    ports:
      - "80:8080"
    networks: [frontend, backend]
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 5s
      restart_policy:
        condition: on-failure

  ride-service:
    image: your-registry/ride-service:latest
    networks: [backend]
    deploy:
      replicas: 2

  notification-service:
    image: your-registry/notification-service:latest
    networks: [frontend, backend]
    deploy:
      replicas: 2

  redis:
    image: redis:7
    networks: [backend]

  rabbitmq:
    image: rabbitmq:3-management
    networks: [backend]
```

Lưu ý: File trên dùng để mô tả kiến trúc; triển khai thực tế cần bổ sung volumes/secrets/healthchecks.

---

## 7.9. Quy Trình Deploy

Trên Swarm manager:
- init swarm
- join workers
- deploy stack:
  - `docker stack deploy -c docker-stack.yml cab-booking`

Cập nhật phiên bản:
- push image tag mới
- `docker service update ...` hoặc redeploy stack

---

## 7.10. Kết Luận Chương

Chương 7 đã:
- Mô tả kiến trúc triển khai theo logical/physical
- Trình bày vai trò manager/worker, overlay network, discovery
- Nêu cơ chế replicas, rolling update, self-healing

---

*Tiếp theo: [Chương 8 - CI/CD Pipeline](./08-CICD-PIPELINE.md)*
