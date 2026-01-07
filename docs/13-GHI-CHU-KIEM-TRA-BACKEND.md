# Ghi chú kiểm tra Backend (theo hướng DDD)

Tài liệu này ghi lại các điểm *khớp/mismatch* giữa code, dữ liệu và kiến trúc (DDD + microservices), để bạn dễ hoàn thiện báo cáo và triển khai.

## 1) Tổng quan cấu trúc (Backend)
- Mỗi service là một bounded context riêng (Auth / Ride / Driver / Payment / Notification / AI).
- `database-per-service` đã được áp dụng:
  - Ride/Payment: PostgreSQL + Prisma schema.
  - Auth/Driver: MongoDB + Mongoose.
  - Realtime/index: Redis (Geo + Socket.IO adapter).
  - Integration async: RabbitMQ.

## 2) Mapping DDD (đang ở mức “DDD-lite”)
Hiện tại code đang gần với layered architecture, có thể map sang DDD như sau:
- **Domain layer**:
  - Ride service có `src/domain/ride-state-machine.ts` dùng để enforce state transition (đúng hướng DDD).
  - Các service khác chủ yếu dùng `models/` (Mongoose) hoặc Prisma models trực tiếp → domain entity chưa tách rõ.
- **Application layer**:
  - `src/services/*` chứa use-cases (create ride, accept, complete, process payment…).
- **Infrastructure layer**:
  - DB clients (PrismaClient/Mongoose), Redis, RabbitMQ publisher/consumer.
- **Interface layer**:
  - `src/routes/*` (HTTP API), middleware.

> Ghi chú: Nếu bạn cần “đúng DDD hơn”, bước tiếp theo là tách `domain/entities`, `domain/value-objects`, `application/use-cases`, `infrastructure/repositories` và tránh để Prisma/Mongoose model “lộ” thẳng trong domain.

## 3) Các vấn đề logic/contract cần chú ý
### 3.1. Ride ↔ AI contract mismatch (đã sửa)
- Trước đây Ride service gọi AI estimate với payload `dropoff`, trong khi AI service yêu cầu `destination`.
- Trước đây Ride service đọc `duration_seconds`, trong khi AI trả `duration_minutes`.

Mình đã sửa để Ride gọi đúng contract và convert phút → giây:
- [services/ride-service/src/services/ride.service.ts](services/ride-service/src/services/ride.service.ts)

### 3.2. Redis GEO key giữa Driver ↔ AI (đã sửa)
- Driver service dùng GEO key: `drivers:geo:online`.
- AI service trước đây đọc key khác → match driver không ra kết quả.

Mình đã sửa AI service đọc đúng key:
- [services/ai-service/app/services/redis_service.py](services/ai-service/app/services/redis_service.py)

### 3.3. Payment/Outbox pattern (chưa hoàn chỉnh)
- Payment service đã có bảng `OutboxEvent` trong Prisma.
- Nhưng hiện tại service **vừa ghi outbox vừa publish event trực tiếp**.

Gợi ý (để đúng “Outbox pattern”):
- Chọn 1 trong 2 hướng:
  1) **Chỉ publish qua outbox worker** (khuyến nghị), hoặc
  2) **Bỏ outbox** và publish trực tiếp (đơn giản hơn nhưng kém reliability).

## 4) Database & migrations (điểm khó)
- Prisma migrations hiện chưa được commit (`prisma/migrations` không thấy trong repo).
- Dockerfile có fallback `prisma db push` nếu không có migrations.

> Điểm khó: nếu muốn báo cáo/triển khai “chuẩn”, bạn nên tạo migrations và deploy bằng `prisma migrate deploy`. Khi không có Docker engine/DB chạy, việc generate migrations sẽ khó hơn (cần môi trường DB).

## 5) Cleanup file/thư mục thừa (khuyến nghị)
- Các thư mục `dist/` và `node_modules/` trong từng service là build artifact, nên **không commit** và có thể xóa để repo gọn.
- `.gitignore` đã ignore các mục này.

## 6) TODO còn lại
- Driver service có TODO: “notify customer no drivers available” trong consumer.
- Nếu muốn demo giống app thật: bổ sung event + notification khi không tìm được tài xế.
