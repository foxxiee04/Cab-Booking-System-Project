# Test nghiệp vụ theo mô hình DDD (hướng dẫn thực hành)

Mục tiêu của tài liệu này: giúp bạn test **logic nghiệp vụ** (business rules) theo đúng tinh thần DDD trong hệ thống microservices.

---

## 1) Test theo 3 tầng (đúng DDD)

### Tầng A — Domain tests (quan trọng nhất)
- Test các **quy tắc nghiệp vụ thuần** (không DB, không network).
- Ví dụ: Ride state machine (các transition hợp lệ/không hợp lệ), policy cancel, điều kiện cần driver.

**Lợi ích**: chạy nhanh, ổn định, dễ chứng minh “mình có DDD”.

### Tầng B — Application/Use-case tests
- Test các use-case ở `src/services/*` (create ride, accept ride, process payment…).
- Mock các dependency:
  - Prisma/Mongoose (database)
  - Redis
  - RabbitMQ publisher/consumer
  - HTTP call (axios) sang AI service

**Lợi ích**: chứng minh nghiệp vụ chạy đúng khi phối hợp nhiều lớp.

### Tầng C — E2E/Smoke tests
- Chạy cả hệ thống (Gateway + services + DB) và test các luồng chính.
- Repo có sẵn PowerShell smoke test:
  - [scripts/smoke-test.ps1](scripts/smoke-test.ps1)

---

## 2) Test case nghiệp vụ nên có (để viết báo cáo)

### 2.1. Auth
- Register/login/refresh.
- RBAC: customer/driver/admin.

### 2.2. Ride (core)
- Create ride luôn tạo transition record đầu tiên.
- Transition hợp lệ: `PENDING -> ASSIGNED -> ACCEPTED -> IN_PROGRESS -> COMPLETED`.
- Reject: `ASSIGNED -> PENDING`.
- Cancel: chỉ cho cancel khi `PENDING/ASSIGNED/ACCEPTED`.

### 2.3. Driver
- Online/offline.
- GPS update: update Mongo + update Redis Geo khi ONLINE.
- Nearby drivers: query Redis Geo.

### 2.4. Payment
- Khi nhận `RideCompleted`: tạo Fare + Payment.
- Payment thành công → `COMPLETED`, thất bại → `FAILED`.
- Refund chỉ cho phép khi `COMPLETED`.

### 2.5. Notification (realtime)
- Khi có event `ride.assigned` hoặc `payment.completed` → push qua Socket.IO.

---

## 3) Cách chạy test (theo repo hiện tại)

### 3.1. Unit/Service tests (Jest)
Chạy trong từng service:
- Ride Service: `npm test`
- Payment Service: `npm run db:generate` (lần đầu/CI) rồi `npm test`
- Auth Service: `npm test`
- Driver Service: `npm test`

Gợi ý: chạy ở Windows PowerShell:
- `cd services/ride-service; npm test`

### 3.2. E2E smoke test
Điều kiện: Docker engine phải chạy.

1) Tạo `.env` từ `.env.example`
2) Chạy infra + services:
- `docker compose --env-file .env up -d`
3) Smoke test:
- `pwsh scripts/smoke-test.ps1 -BaseUrl "http://localhost:3000"`

---

## 4) Ghi chú (chỗ khó)
- **Flaky test**: nếu test đụng vào `mockPaymentGateway()` (có random fail) thì test sẽ không ổn định. Nên mock phần gateway.
- **Outbox pattern**: nếu vừa publish trực tiếp vừa ghi outbox, có thể tạo duplicate events trong production; khi viết test cần xác định rõ chiến lược.
- **Integration** (DB thật): chỉ nên làm ít case quan trọng vì setup nặng và dễ fail trên máy yếu.
