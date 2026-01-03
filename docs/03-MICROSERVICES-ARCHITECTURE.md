# CHƯƠNG 3: THIẾT KẾ KIẾN TRÚC MICROSERVICES

---

## 3.1. Mục Tiêu Kiến Trúc

Hệ thống được thiết kế theo Microservices Architecture nhằm đạt các mục tiêu:
- **Tách biệt trách nhiệm nghiệp vụ** theo Bounded Context (DDD)
- **Database per service** để đảm bảo quyền sở hữu dữ liệu và giảm coupling
- **Stateless services** để scale ngang và self-healing
- **Event-driven** để đạt eventual consistency và giảm phụ thuộc đồng bộ
- **Real-time** phục vụ tracking GPS và trạng thái chuyến đi

---

## 3.2. Nguyên Tắc Thiết Kế Microservices

### 3.2.1. Database per Service & Data Ownership

Mỗi microservice **sở hữu dữ liệu của mình**, các service khác **không được truy cập trực tiếp DB**.
Các nhu cầu chia sẻ dữ liệu được giải quyết bằng:
- **API call** (sync) cho các truy vấn tức thời
- **Domain events** (async) để đồng bộ dữ liệu read-model/caches

### 3.2.2. Stateless Services

- Service không lưu session state trong memory.
- Authentication dựa trên **JWT** và **refresh token**.
- Các trạng thái tạm thời (ví dụ: presence, mapping socket) đặt trong **Redis**.

### 3.2.3. Contract-first Communication

- API được chuẩn hóa bằng OpenAPI (REST) hoặc protobuf (gRPC – tùy chọn).
- Events chuẩn hóa schema (eventId, correlationId, occurredAt, payload).

---

## 3.3. Danh Sách Microservices và Trách Nhiệm

| Service | Vai trò | Giao tiếp chính | DB |
|---|---|---|---|
| **API Gateway** | Entry point, auth, routing, rate limit | REST to services | (Không sở hữu DB) |
| **Auth Service** | Đăng ký/đăng nhập, JWT, RBAC | REST, publish events | MongoDB |
| **Ride Service (Core)** | Ride lifecycle, dispatch orchestration | REST, publish events | PostgreSQL |
| **Driver Service** | Driver profile, online/offline, GPS | REST, events | MongoDB + Redis Geo |
| **Payment Service** | Fare, payment, refund, Saga | Events + REST | PostgreSQL |
| **Notification Service** | WebSocket/Socket.IO, fan-out | Consume events + Redis Pub/Sub | Redis (Pub/Sub), optional MongoDB |
| **AI Service (FastAPI)** | Matching/ETA/Surge (mô phỏng) | REST/gRPC (sync) | Optional |

---

## 3.4. API Gateway Design

### 3.4.1. Vai trò và chức năng

API Gateway là **entry point duy nhất** cho client:
- **JWT Authentication**: verify access token; inject `userId`, `role` vào request context
- **Routing**: map endpoint → service
- **Rate limiting**: hạn chế theo IP/userId/route
- **Load balancing cơ bản**: round-robin đến các replicas (Swarm ingress/overlay hỗ trợ)

### 3.4.2. Routing Table (mẫu)

| Route Prefix | Service | Ghi chú |
|---|---|---|
| `/api/auth/*` | Auth Service | login/register/refresh |
| `/api/rides/*` | Ride Service | core ride API |
| `/api/drivers/*` | Driver Service | driver profile, status |
| `/api/payments/*` | Payment Service | payment init, status |
| `/ws/*` | Notification Service | websocket/socket.io |
| `/api/ai/*` | AI Service | internal hoặc admin-only |

### 3.4.3. Token Strategy

- **Access token (JWT)**: short TTL (ví dụ 15 phút)
- **Refresh token**: dài hơn (ví dụ 7–30 ngày), rotation + revoke

Lưu ý: Trong kiến trúc microservices, các service nội bộ không nên tự “trust” client JWT một cách mù quáng; API Gateway thực hiện verify chính, service vẫn verify chữ ký JWT (hoặc validate qua JWKS) tùy mức độ bảo mật mong muốn.

---

## 3.5. Event-driven Architecture với Message Broker

### 3.5.1. Lý do dùng message broker

- Giảm coupling (Ride không cần gọi trực tiếp Notification/Payment mỗi bước)
- Cho phép retry/queue khi consumer tạm thời down
- Dễ mở rộng consumer (thêm reporting, fraud detection)

### 3.5.2. Chọn RabbitMQ hay Kafka (mức khóa luận)

**RabbitMQ** phù hợp hơn cho khóa luận vì:
- Cấu hình và vận hành đơn giản
- Hỗ trợ các pattern (topic, direct, fanout)
- Đủ đáp ứng throughput cho prototype

**Kafka** phù hợp nếu nhấn mạnh:
- Thông lượng rất lớn
- Log-based retention lâu dài
- Nhiều consumer group, replay sự kiện

Trong đề tài, chọn RabbitMQ; Kafka có thể đề cập như hướng mở rộng.

### 3.5.3. Exchange/Queue đề xuất (RabbitMQ)

- Exchange: `domain-events` (type: topic)
- Routing keys:
  - `ride.created`, `ride.assigned`, `ride.completed`, ...
  - `payment.completed`, `payment.failed`
  - `driver.location.updated`

Queues (mỗi service subscribe theo nhu cầu):
- `notification.q` bind `ride.*`, `payment.*`, `driver.location.*`
- `payment.q` bind `ride.completed`, `ride.cancelled`
- `driver.q` bind `ride.assignment.requested` (nếu driver matching qua event)

---

## 3.6. Thiết Kế Giao Tiếp Giữa Các Services

### 3.6.1. Giao tiếp Sync (REST)

Dùng khi cần phản hồi tức thời:
- Auth: login/register/refresh
- Ride: create ride (client cần nhận `rideId` ngay)
- Ride → AI: request matching/ETA/surge (timeout + fallback)

### 3.6.2. Giao tiếp Async (Events)

Dùng khi chấp nhận eventual consistency:
- Ride publish `RideCreated` → Notification inform customer
- Ride publish `RideCompleted` → Payment calculate fare + initiate payment
- Payment publish `PaymentCompleted` → Notification gửi biên nhận

---

## 3.7. Thiết Kế Dữ Liệu và Database per Service

### 3.7.1. Auth Service (MongoDB)

Collections đề xuất:
- `users`:
  - `_id`, `email/phone`, `passwordHash`, `role`, `status`, `createdAt`
- `refresh_tokens`:
  - `tokenId`, `userId`, `expiresAt`, `revokedAt?`, `deviceInfo?`

Indexes:
- unique index: `email`, `phone`
- index: `userId` trên `refresh_tokens`

### 3.7.2. Ride Service (PostgreSQL)

Tables đề xuất:
- `rides`:
  - `ride_id (PK)`, `customer_id`, `driver_id?`, `status`, `pickup_lat`, `pickup_lng`, `drop_lat`, `drop_lng`, `created_at`
- `ride_state_transitions`:
  - `id`, `ride_id`, `from_status`, `to_status`, `occurred_at`, `actor_id`, `reason?`

Indexes:
- `rides(customer_id, created_at desc)`
- `rides(driver_id, created_at desc)`

### 3.7.3. Driver Service (MongoDB + Redis)

MongoDB collections:
- `drivers`: driver profile, vehicle, verification, status

Redis:
- Geo set: `drivers:geo:online` (GEOADD, GEORADIUS)
- Keys: `driver:{id}:status`, `driver:{id}:lastSeen`

### 3.7.4. Payment Service (PostgreSQL)

Tables:
- `fares`: `ride_id (PK)`, breakdown, surge_multiplier
- `payments`: `payment_id (PK)`, `ride_id`, `amount`, `status`, `created_at`

---

## 3.8. Saga Pattern cho Payment (Event-driven)

### 3.8.1. Bài toán

Ride hoàn thành → cần tính cước và xử lý thanh toán.
Trong microservices, không thể dùng distributed ACID transaction giữa Ride và Payment.

### 3.8.2. Chọn Saga dạng Choreography

- Ride phát event `RideCompleted`
- Payment consume, tính cước, chuyển trạng thái payment
- Payment phát `PaymentCompleted` hoặc `PaymentFailed`
- Ride/Notification phản ứng theo event

Ưu điểm: đơn giản, phù hợp khóa luận. Nhược điểm: khó quan sát flow nếu không có tracing/correlation.

### 3.8.3. Outbox Pattern (khuyến nghị mô tả)

Để tránh tình huống “commit DB thành công nhưng publish event thất bại”:
- Payment ghi event vào bảng `outbox_events` trong cùng transaction
- Worker (hoặc background job) đọc outbox và publish sang RabbitMQ
- Đánh dấu `published_at`

Mức khóa luận: có thể triển khai tối giản hoặc mô tả kiến trúc.

---

## 3.9. Đảm Bảo Tính Nhất Quán: Eventual Consistency

Nguyên tắc:
- Mỗi service đảm bảo strong consistency trong DB của mình
- Giữa services: chấp nhận độ trễ đồng bộ (milliseconds → seconds)

Ví dụ:
- Ride đã `Assigned` nhưng Notification gửi chậm 1–2 giây vẫn chấp nhận.

---

## 3.10. Observability ở mức kiến trúc

Trong hệ thống microservices, cần:
- **Correlation ID** xuyên suốt request → events
- Structured logging (JSON)
- Metrics (Prometheus)

Các phần chi tiết triển khai ở Chương 9.

---

## 3.11. Kết Luận Chương

Chương 3 đã:
- Mô tả kiến trúc microservices, database-per-service, stateless
- Thiết kế API Gateway theo yêu cầu (JWT, routing, rate limit, LB)
- Thiết kế event-driven với RabbitMQ và danh mục event
- Mô tả Saga Pattern (Payment) và Outbox Pattern (khuyến nghị)

---

*Tiếp theo: [Chương 4 - Luồng Nghiệp Vụ End-to-End](./04-BUSINESS-FLOWS.md)*
