# CHƯƠNG 8: THIẾT KẾ CI/CD PIPELINE

---

## 8.1. Mục Tiêu CI/CD

CI/CD trong khóa luận nhằm:
- Tự động hóa build/test
- Đóng gói microservices thành Docker images
- Deploy lên Docker Swarm với cơ chế rolling update

Phạm vi khóa luận:
- Test cơ bản (unit test / smoke test)
- Build & push images
- Deploy tự động (hoặc semi-auto) lên Swarm manager

---

## 8.2. Kiến Trúc Pipeline Tổng Thể

### 8.2.1. Stages

1) **CI (Continuous Integration)**
- Lint/format (tùy)
- Run unit tests
- Build Docker images
- Push images lên registry

2) **CD (Continuous Deployment)**
- SSH vào Swarm Manager
- `docker stack deploy` với image tags mới
- Verify health (smoke check)

### 8.2.2. Registry

Có thể dùng:
- Docker Hub
- GitHub Container Registry
- Private registry (mô tả)

---

## 8.3. GitHub Actions (mô tả đề xuất)

### 8.3.1. Trigger

- `push` lên `main`
- `pull_request` để chạy CI
- `workflow_dispatch` để deploy thủ công

### 8.3.2. Secrets cần thiết

- `REGISTRY_USERNAME`, `REGISTRY_PASSWORD`
- `SWARM_MANAGER_HOST`
- `SWARM_MANAGER_SSH_KEY`
- `DEPLOY_PATH` hoặc `STACK_FILE_PATH`

---

## 8.4. Pipeline Flow (ASCII)

```
Developer push code
   ▼
GitHub Actions
   ├─ Checkout
   ├─ Install dependencies
   ├─ Run tests (basic)
   ├─ Docker build (per service)
   ├─ Docker push (tag: git sha)
   ▼
CD job
   ├─ SSH to Swarm Manager
   ├─ docker stack deploy
   ├─ rolling update
   └─ smoke check
```

---

## 8.5. Strategy gắn version & rollback

### 8.5.1. Image tagging

Khuyến nghị:
- `service:{git_sha}` cho traceability
- `service:latest` chỉ dùng cho dev

### 8.5.2. Rollback

- Swarm hỗ trợ rollback service update (tùy cách deploy).
- Ở mức khóa luận:
  - lưu lại stack file cũ
  - redeploy version trước

---

## 8.6. Kiểm thử trong pipeline (mức khóa luận)

- Unit test cho core logic:
  - Ride state machine transitions
  - Payment fare calculation
  - Auth token validation

- Smoke test sau deploy:
  - gọi `GET /health` qua gateway
  - kiểm tra kết nối RabbitMQ/Redis (ở mức basic)

---

## 8.7. Mẫu workflow (mang tính mô tả)

```yaml
name: cab-booking-cicd

on:
  push:
    branches: ["main"]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: echo "run tests here"
      - name: Build and push images
        run: echo "docker build/push for each service"

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Swarm
        run: echo "ssh and docker stack deploy"
```

Ghi chú: Workflow thực tế sẽ phụ thuộc repo structure. Trong khóa luận, phần quan trọng là trình bày logic pipeline và secrets.

---

## 8.8. Kết Luận Chương

Chương 8 đã:
- Đề xuất CI/CD pipeline phù hợp Docker Swarm
- Mô tả stages, secrets, tagging, rollback
- Nêu scope kiểm thử và smoke check

---

*Tiếp theo: [Chương 9 - Monitoring & Reliability](./09-MONITORING-RELIABILITY.md)*
