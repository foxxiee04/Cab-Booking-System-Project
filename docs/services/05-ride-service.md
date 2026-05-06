# Ride Service

> **Cổng HTTP:** 3002 | **Cổng gRPC:** 50054 | **Database:** PostgreSQL (`ride_db`)

---

## 1. Tổng quan

Ride Service là **trung tâm điều phối** của toàn bộ hành trình đặt xe. Service này:
- Tạo và quản lý vòng đời chuyến đi qua **State Machine**
- Điều phối offer tài xế (đề xuất, timeout, từ chối, tái đề xuất)
- Lưu lịch sử chuyến đi, chat, và audit trail trạng thái
- Publish domain events để các service khác phản ứng

---

## 2. Công nghệ

| Thành phần | Công nghệ |
|-----------|----------|
| Runtime | Node.js 20, TypeScript |
| HTTP Framework | Express.js |
| ORM | Prisma (PostgreSQL) |
| Events | RabbitMQ (amqplib) |
| gRPC Server | `@grpc/grpc-js` |
| Validation | `joi` |

---

## 3. Database Schema (`ride_db`)

### Bảng `Ride`

```sql
Ride {
  id                  String    @id @default(uuid())

  -- Liên kết người dùng
  customerId          String               -- Auth User.id
  driverId            String?              -- Auth User.id (null khi chưa có tài xế)

  -- Trạng thái (State Machine)
  status              RideStatus @default(CREATED)

  -- Thông tin chuyến
  vehicleType         VehicleType          -- MOTORBIKE | SCOOTER | CAR_4 | CAR_7
  paymentMethod       PaymentMethod        -- CASH | MOMO | VNPAY | WALLET
  voucherCode         String?

  -- Địa điểm
  pickupAddress       String
  pickupLat           Decimal
  pickupLng           Decimal
  dropoffAddress      String
  dropoffLat          Decimal
  dropoffLng          Decimal

  -- Metrics chuyến đi
  distance            Decimal?             -- km
  duration            Int?                 -- giây
  fare                Decimal?             -- VND
  surgeMultiplier     Decimal @default(1)

  -- Điều phối tài xế
  suggestedDriverIds  String[]             -- IDs đã được thuật toán chọn
  offeredDriverIds    String[]             -- IDs đã nhận offer
  rejectedDriverIds   String[]             -- IDs đã từ chối
  reassignAttempts    Int @default(0)
  acceptedDriverId    String?

  -- Timestamps
  requestedAt         DateTime @default(now())
  offeredAt           DateTime?
  assignedAt          DateTime?
  acceptedAt          DateTime?
  pickupAt            DateTime?            -- Thực tế đón được khách
  startedAt           DateTime?
  completedAt         DateTime?
  cancelledAt         DateTime?

  -- Hủy
  cancelReason        String?
  cancelledBy         CancelledBy?         -- CUSTOMER | DRIVER | SYSTEM
}
```

### Enum `RideStatus`

```
CREATED         → Đặt xe thành công, đang chờ điều phối
FINDING_DRIVER  → Đang tìm tài xế
OFFERED         → Đã gửi offer cho tài xế, chờ chấp nhận
ASSIGNED        → Tài xế đã chấp nhận
ACCEPTED        → Tài xế xác nhận lên đường đón
PICKING_UP      → Tài xế đang trên đường đến điểm đón
IN_PROGRESS     → Đang trên đường đến điểm đến
COMPLETED       → Hoàn thành
CANCELLED       → Đã hủy
```

### Bảng `RideStateTransition` (Audit Trail)

```sql
RideStateTransition {
  id          String    @id @default(uuid())
  rideId      String               -- FK → Ride
  fromStatus  String?              -- Trạng thái gốc (null nếu là CREATED)
  toStatus    String               -- Trạng thái mới
  actorId     String?              -- userId thực hiện chuyển trạng thái
  actorType   String               -- CUSTOMER | DRIVER | SYSTEM
  reason      String?              -- Lý do (khi hủy)
  occurredAt  DateTime @default(now())
}
```

### Bảng `RideChatMessage`

```sql
RideChatMessage {
  id          String    @id @default(uuid())
  rideId      String               -- FK → Ride
  senderId    String               -- userId người gửi
  senderRole  String               -- DRIVER | CUSTOMER
  type        String               -- TEXT | SYSTEM
  message     String
  createdAt   DateTime @default(now())
}
```

---

## 4. State Machine

**File:** `src/domain/ride-state-machine.ts`

```typescript
const VALID_TRANSITIONS: Record<RideStatus, RideStatus[]> = {
  CREATED:        ['FINDING_DRIVER', 'CANCELLED'],
  FINDING_DRIVER: ['OFFERED', 'CANCELLED'],
  OFFERED:        ['ASSIGNED', 'FINDING_DRIVER', 'CANCELLED'],
  ASSIGNED:       ['ACCEPTED', 'FINDING_DRIVER', 'CANCELLED'],
  ACCEPTED:       ['PICKING_UP', 'CANCELLED'],
  PICKING_UP:     ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS:    ['COMPLETED', 'CANCELLED'],
  COMPLETED:      [],
  CANCELLED:      [],
};
```

Mọi cập nhật trạng thái đều đi qua hàm `transition(rideId, newStatus, actor)` — không update thẳng field `status`. Sau mỗi chuyển trạng thái hợp lệ, một `RideStateTransition` được ghi vào DB.

---

## 5. API Endpoints

### Customer

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/rides` | Tạo chuyến đi mới |
| GET | `/api/rides/:rideId` | Chi tiết chuyến đi |
| GET | `/api/rides/customer/history` | Lịch sử chuyến của khách |
| GET | `/api/rides/customer/active` | Chuyến active của khách |
| POST | `/api/rides/:rideId/cancel` | Hủy chuyến |
| GET | `/api/rides/:rideId/messages` | Lịch sử chat |
| POST | `/api/rides/:rideId/messages` | Gửi tin nhắn |

### Driver

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/rides/available` | Danh sách chuyến có thể nhận |
| GET | `/api/rides/driver/active` | Chuyến active của tài xế |
| GET | `/api/rides/driver/history` | Lịch sử chuyến của tài xế |
| POST | `/api/rides/:rideId/accept` | Chấp nhận chuyến |
| POST | `/api/rides/:rideId/reject` | Từ chối chuyến |
| POST | `/api/rides/:rideId/pickup` | Xác nhận đã đón khách |
| POST | `/api/rides/:rideId/start` | Bắt đầu chuyến (→ IN_PROGRESS) |
| POST | `/api/rides/:rideId/complete` | Hoàn thành chuyến |
| POST | `/api/rides/:rideId/accept-offer` | Chấp nhận offer từ matching |
| POST | `/api/rides/:rideId/reject-offer` | Từ chối offer từ matching |

---

## 6. Domain Events Published

| Event | Khi nào | Consumers |
|-------|---------|----------|
| `ride.created` | Tạo chuyến | API Gateway (trigger matching) |
| `ride.finding_driver` | Bắt đầu tìm tài xế | API Gateway |
| `ride.offered` | Gửi offer | API Gateway (Socket.IO → driver) |
| `ride.assigned` | Tài xế nhận chuyến | API Gateway, Notification |
| `ride.picking_up` | Tài xế đến đón | API Gateway (Socket.IO → customer) |
| `ride.started` | Bắt đầu chạy | API Gateway |
| `ride.completed` | Hoàn thành | **Payment Service** (tính tiền), Notification |
| `ride.cancelled` | Hủy | Payment (refund nếu có), Notification |
| `ride.chat_message` | Tin nhắn mới | API Gateway (Socket.IO relay) |

---

## 7. Luồng Tạo Chuyến Đi (Happy Path)

```
Customer App                   Ride Service                  API Gateway
     │                              │                              │
     │── POST /rides ──────────────►│                              │
     │   {pickup, dropoff, type}    │ Gọi Pricing Service          │
     │                              │ ← estFare, surge              │
     │                              │ INSERT Ride (CREATED)         │
     │                              │ FINDING_DRIVER transition     │
     │                              │── Publish ride.created ──────►│
     │◄─ {rideId, estFare} ─────────│                              │
     │                              │                   Matching algo
     │                              │◄── offer.send {driverId} ───│
     │                              │ Ride → OFFERED               │
     │                              │── Publish ride.offered ──────►│
     │                              │                   Socket.IO → Driver
     │                              │                              │
     │                              │◄── POST /accept (driver) ───── Driver App
     │                              │ Ride → ASSIGNED              │
     │                              │── Publish ride.assigned ─────►│
     │                              │                   Socket.IO → Customer
     │                              │                              │
     ...driver arrives, starts, completes...
     │                              │── Publish ride.completed ────►│
     │                              │              Payment Service tính tiền
```

---

## 8. Offer Timeout & Reassign

Khi tài xế không phản hồi trong `OFFER_TIMEOUT_SECONDS` (mặc định 30s):
1. Ride chuyển về `FINDING_DRIVER`
2. `reassignAttempts++`
3. Tài xế đã timeout được thêm vào `rejectedDriverIds`
4. Gateway kích hoạt vòng matching tiếp theo (radius mở rộng)
5. Nếu hết 3 vòng: `ride.no_driver_found` → hủy hoặc notify customer

---

## 9. gRPC Interface

```protobuf
rpc GetRideById (GetRideByIdRequest) returns (RideResponse);
rpc GetActiveRideByDriverId (GetActiveRideRequest) returns (RideResponse);
```

---

## 10. Cấu hình & Biến môi trường

| Biến | Mô tả |
|------|-------|
| `DATABASE_URL` | PostgreSQL → `ride_db` |
| `RABBITMQ_URL` | Publish/consume events |
| `PRICING_SERVICE_URL` | Gọi ước tính giá |
| `OFFER_TIMEOUT_SECONDS` | Timeout chờ tài xế nhận (mặc định 30) |
| `GRPC_PORT` | Cổng gRPC (mặc định `50054`) |

---

## 11. Khởi động & Vận hành

```bash
npm run dev:ride

cd services/ride-service
npx prisma migrate dev
npx prisma generate

GET http://localhost:3002/health
```

> **Build context**: Cần build từ **root** (phụ thuộc `shared/`).
