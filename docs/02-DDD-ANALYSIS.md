# CHƯƠNG 2: PHÂN TÍCH DOMAIN-DRIVEN DESIGN (DDD)

---

## 2.1. Mục Tiêu Áp Dụng DDD

Mục tiêu của DDD trong đề tài là **tổ chức hệ thống theo đúng ranh giới nghiệp vụ**, giúp:
- Giảm coupling giữa các phần chức năng
- Tăng khả năng mở rộng theo team và theo tải
- Dễ kiểm soát tính nhất quán dữ liệu trong môi trường phân tán
- Mapping trực tiếp Bounded Context → Microservice theo yêu cầu kiến trúc

Trong phạm vi khóa luận, DDD được áp dụng ở mức:
- Xác định **Ubiquitous Language** (ngôn ngữ chung)
- Phân rã domain thành **Bounded Contexts**
- Mô tả **Entity, Value Object, Aggregate Root, Domain Event** cho từng context
- Định nghĩa **context map** và quan hệ giữa các contexts

---

## 2.2. Ubiquitous Language (Từ Vựng Nghiệp Vụ)

Bảng từ vựng nghiệp vụ giúp tránh mơ hồ khi thiết kế API, event, schema.

| Thuật ngữ | Định nghĩa |
|----------|------------|
| Customer | Khách đặt xe |
| Driver | Tài xế nhận chuyến |
| Ride | Chuyến đi (yêu cầu + hành trình + kết thúc) |
| Ride Request | Yêu cầu đặt xe ban đầu |
| Pickup / Dropoff | Điểm đón / điểm trả |
| Dispatch / Assignment | Điều phối, gán tài xế cho chuyến |
| Fare | Giá cước tính toán |
| Payment | Giao dịch thanh toán |
| ETA | Estimated Time of Arrival – thời gian dự kiến đến |
| Surge Pricing | Giá động theo nhu cầu/cung |
| Ride State | Trạng thái chuyến đi (Pending/Accepted/...) |
| Driver Availability | Khả năng nhận chuyến (online/available/busy) |
| Notification | Thông báo (in-app, realtime) |

---

## 2.3. Domain Tổng Thể và Phân Rã Subdomain

### 2.3.1. Subdomain

Phân rã theo DDD thường gồm **Core Domain**, **Supporting Domain**, **Generic Domain**.

- **Core Domain** (giá trị lõi):
  - Ride Dispatching & Lifecycle (đặt xe, điều phối, state machine)
- **Supporting Domain**:
  - Driver Management (tài xế, trạng thái, vị trí)
  - Payment & Fare (tính cước, thanh toán, hoàn tiền)
  - Notification (realtime updates)
- **Generic Domain**:
  - Auth/User (xác thực, phân quyền)
  - Observability/Monitoring (không phải nghiệp vụ lõi)

### 2.3.2. Domain Boundary (khung nhìn tổng quan)

```
Core: Ride Booking & Dispatch
 ├─ Create Ride Request
 ├─ Match Driver
 ├─ Manage Ride State Machine
 └─ Publish events for other contexts

Supporting:
 ├─ Driver (profile, availability, GPS)
 ├─ Payment (fare, transaction, saga)
 └─ Notification (websocket/push)

Generic:
 └─ Auth/User (JWT, RBAC)
```

---

## 2.4. Xác Định Bounded Contexts và Mapping → Microservices

### 2.4.1. Danh sách Bounded Contexts

| Bounded Context | Trách nhiệm nghiệp vụ | Microservice tương ứng | Database |
|---|---|---|---|
| **Identity & Access** | User, login, JWT, RBAC | **Auth Service** | MongoDB |
| **Ride Management (Core)** | Ride lifecycle, dispatch flow | **Ride Service** | PostgreSQL |
| **Driver Operations** | Driver profile, availability, GPS | **Driver Service** | MongoDB + Redis (Geo) |
| **Payment & Billing** | Fare, payment, refund, saga | **Payment Service** | PostgreSQL |
| **Notification** | Realtime notify, websocket fan-out | **Notification Service** | Redis (Pub/Sub), optional MongoDB |
| **AI Decisioning** | Matching/ETA/Surge (mô phỏng) | **AI Service** (FastAPI) | Optional (model store), Redis cache |

Lưu ý: “Database per service” được đảm bảo; mọi chia sẻ dữ liệu giữa services thông qua **API** và **Domain Events**.

---

## 2.5. Context Map (Quan Hệ Giữa Các Contexts)

### 2.5.1. Relationship Types

- **Customer/Supplier**: Ride Service là supplier của ride states; Notification/Payment/Driver là consumer.
- **Conformist**: Payment/Notification tuân theo contract event do Ride phát hành.
- **Anti-Corruption Layer (ACL)**: Khi Ride gọi AI Service, cần lớp adapter/ACL để tránh nhiễm thuật ngữ AI vào core domain.

### 2.5.2. Context Map (ASCII)

```
          ┌──────────────────┐
          │ Identity & Access│
          │   (Auth Service) │
          └─────────┬────────┘
                    │ JWT/RBAC
                    ▼
┌─────────────────────────────────────────────────────┐
│            Ride Management (CORE)                   │
│                 (Ride Service)                      │
└───────┬──────────────┬───────────────┬──────────────┘
        │events         │REST/Events     │REST
        ▼               ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Notification │  │   Payment    │  │  AI Service  │
│   Service    │  │   Service    │  │  (FastAPI)   │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       │events           │events           │
       ▼                 ▼                 ▼
   ┌──────────────┐  ┌──────────────┐  (No direct DB share)
   │ Driver Ops   │  │ Reporting/BI │
   │ (Driver Svc) │  │ (optional)   │
   └──────────────┘  └──────────────┘
```

---

## 2.6. Thiết Kế DDD Cho Từng Bounded Context

Phần này mô tả theo template:
- Entity
- Value Object
- Aggregate Root
- Domain Event
- Invariants (ràng buộc nghiệp vụ)

### 2.6.1. Identity & Access Context (Auth Service)

**Entities**
- `User`: id, role, status, createdAt

**Value Objects**
- `Email`, `PhoneNumber` (validation)
- `HashedPassword`
- `RefreshToken` (tokenId, expiresAt)

**Aggregate Root**
- `UserAggregate` (root: User)
  - quản lý đăng ký, đổi mật khẩu, refresh token rotation

**Domain Events**
- `UserRegistered`
- `UserRoleChanged`
- `UserDisabled`

**Invariants**
- Email/phone duy nhất
- Refresh token rotation: token cũ bị revoke khi cấp token mới

---

### 2.6.2. Ride Management Context (Ride Service) – CORE

**Entities**
- `Ride`: rideId, customerId, driverId?, status, createdAt
- `RideTimeline`: lưu các mốc thời gian theo trạng thái

**Value Objects**
- `GeoPoint(lat, lng)`
- `LocationAddress(text, geoPoint)`
- `RideRoute(pickup, dropoff)`
- `RideStatus` (enum: Pending, Accepted, InProgress, Completed, Cancelled)

**Aggregate Root**
- `RideAggregate` (root: Ride)
  - các hành vi (commands):
    - `CreateRide()`
    - `AssignDriver(driverId)`
    - `AcceptRide(driverId)` (nếu mô hình accept nằm tại Ride)
    - `StartRide()`
    - `CompleteRide()`
    - `CancelRide(reason)`

**Domain Events**
- `RideCreated`
- `RideAssignmentRequested`
- `RideAssigned`
- `RideAccepted`
- `RideStarted`
- `RideCompleted`
- `RideCancelled`

**Invariants (ràng buộc)**
- State machine hợp lệ: chỉ cho phép chuyển trạng thái hợp lệ
- Một ride chỉ có tối đa 1 driver active
- Không cho “Completed” chuyển về trạng thái khác

**State Machine (mô tả chuẩn hóa)**
- Pending → Accepted → InProgress → Completed
- Pending → Cancelled
- Accepted → Cancelled (theo policy)

---

### 2.6.3. Driver Operations Context (Driver Service)

**Entities**
- `Driver`: driverId, userId, licenseInfo, vehicleInfo, status

**Value Objects**
- `DriverStatus` (Offline, Online, Busy, Suspended)
- `VehicleInfo(plate, type, brand)`
- `GeoPoint(lat, lng)`

**Aggregate Root**
- `DriverAggregate` (root: Driver)
  - `GoOnline()` / `GoOffline()`
  - `UpdateLocation(geoPoint, timestamp)`
  - `MarkBusy(rideId)` / `MarkAvailable()`

**Domain Events**
- `DriverOnline`
- `DriverOffline`
- `DriverLocationUpdated`
- `DriverBecameBusy`
- `DriverBecameAvailable`

**Invariants**
- Driver Offline không được nhận ride
- Driver Busy không được assign ride mới

---

### 2.6.4. Payment & Billing Context (Payment Service)

**Entities**
- `Payment`: paymentId, rideId, customerId, amount, currency, status
- `Fare`: rideId, baseFare, distanceFare, timeFare, surgeMultiplier

**Value Objects**
- `Money(amount, currency)`
- `PaymentStatus` (Pending, Authorized, Captured, Failed, Refunded)
- `FarePolicy` (các tham số tính cước)

**Aggregate Root**
- `PaymentAggregate` (root: Payment)
  - `CreatePaymentForRide(rideId)`
  - `Authorize()`
  - `Capture()`
  - `Fail(reason)`
  - `Refund()`

**Domain Events**
- `FareCalculated`
- `PaymentInitiated`
- `PaymentCompleted`
- `PaymentFailed`
- `RefundCompleted`

**Invariants**
- Mỗi ride có tối đa 1 payment “active”
- Chỉ “Captured” mới được coi là hoàn tất thanh toán

---

### 2.6.5. Notification Context (Notification Service)

**Entities**
- `Notification`: id, userId, type, payload, createdAt, readAt?

**Value Objects**
- `NotificationType` (RideStatusChanged, DriverArrived, PaymentStatus, ...)
- `Channel` (WebSocket, Email, SMS)

**Aggregate Root**
- `NotificationAggregate` (root: Notification) – trong phạm vi khóa luận có thể đơn giản hóa

**Domain Events (consumed)**
- Consume: `RideAssigned`, `RideStarted`, `RideCompleted`, `PaymentCompleted`, `DriverLocationUpdated` (tùy strategy)

**Invariants**
- Gửi thông báo phải idempotent theo (eventId, userId, type)

---

### 2.6.6. AI Decisioning Context (AI Service – FastAPI)

Đây là context đặc thù: **không sở hữu core domain**, mà cung cấp “recommendations”.

**Entities (tối giản)**
- `ModelVersion`: version, trainedAt, metrics

**Value Objects**
- `CandidateDriver(driverId, score)`
- `ETA(seconds)`
- `SurgeMultiplier(multiplier)`

**Aggregate Root**
- Có thể không cần aggregate phức tạp; AI service chủ yếu là stateless inference

**Domain Events**
- Thường không phát hành domain event; gọi qua REST/gRPC.

**Invariants**
- AI output phải có “explainable fields” tối thiểu (score, reason)
- Timeout và fallback: nếu AI chậm/lỗi, Ride Service fallback rule-based (nearest driver)

---

## 2.7. Thiết Kế Domain Events Cho Event-Driven Architecture

### 2.7.1. Danh mục Events Chính

| Event | Producer | Consumers | Ý nghĩa |
|------|----------|-----------|--------|
| `RideCreated` | Ride | Driver, Notification, AI (optional) | Có yêu cầu đặt xe mới |
| `RideAssignmentRequested` | Ride | Driver, AI | Yêu cầu tìm driver phù hợp |
| `RideAssigned` | Ride | Notification, Driver, Payment | Đã gán driver cho ride |
| `RideAccepted` | Ride/Driver | Notification | Driver chấp nhận |
| `RideStarted` | Ride | Notification, Payment | Bắt đầu hành trình |
| `RideCompleted` | Ride | Payment, Notification | Kết thúc hành trình |
| `RideCancelled` | Ride | Notification, Payment | Hủy chuyến |
| `PaymentCompleted` | Payment | Ride (optional), Notification | Thanh toán thành công |
| `PaymentFailed` | Payment | Ride, Notification | Thanh toán thất bại |
| `DriverLocationUpdated` | Driver | Notification (tracking), AI | Cập nhật GPS |

### 2.7.2. Event Schema (chuẩn hóa)

Một event điển hình:
- `eventId` (UUID)
- `eventType`
- `occurredAt`
- `correlationId` (liên kết cùng 1 flow đặt xe)
- `causationId` (event trước đó)
- `payload`

Ví dụ (khái niệm):
```json
{
  "eventId": "uuid",
  "eventType": "RideCreated",
  "occurredAt": "2026-01-02T10:00:00Z",
  "correlationId": "ride-uuid",
  "payload": {
    "rideId": "ride-uuid",
    "customerId": "cust-uuid",
    "pickup": {"lat": 10.76, "lng": 106.68},
    "dropoff": {"lat": 10.78, "lng": 106.70}
  }
}
```

### 2.7.3. Idempotency & Exactly-once (ở mức khóa luận)

- RabbitMQ/Kafka thường đảm bảo **at-least-once**.
- Consumer phải idempotent (lưu `eventId` đã xử lý).
- Với Payment Saga, cần “outbox pattern” (mô tả ở Chương microservices) để tránh mất event khi commit DB.

---

## 2.8. Kết Luận Chương

Chương 2 đã:
- Xác định Ubiquitous Language và phân rã domain
- Định nghĩa Bounded Contexts và mapping rõ ràng sang microservices
- Thiết kế Entity/VO/Aggregate/Domain Events cho từng context
- Chuẩn hóa danh mục domain events phục vụ event-driven architecture

---

*Tiếp theo: [Chương 3 - Kiến trúc Microservices](./03-MICROSERVICES-ARCHITECTURE.md)*
