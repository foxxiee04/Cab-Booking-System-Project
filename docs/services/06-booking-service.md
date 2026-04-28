# Booking Service

> **Cổng HTTP:** 3008 | **Cổng gRPC:** 50053 | **Database:** PostgreSQL (`booking_db`)

---

## 1. Tổng quan

Booking Service xử lý **bước tiền đặt xe** — lúc khách hàng chọn địa điểm, xem giá ước tính, và xác nhận ý định đặt xe **trước khi** Ride Service tạo chuyến đi thực sự. Tương đương "giỏ hàng" trong e-commerce.

**Vì sao cần tách Booking khỏi Ride?**
- Cho phép khách xem giá nhiều lần mà không tạo chuyến (không spam Ride Service)
- Lưu thông tin ước tính để so sánh với giá thực tế sau khi chuyến hoàn thành
- Hỗ trợ chức năng đặt trước (scheduled ride, tương lai)

---

## 2. Công nghệ

| Thành phần | Công nghệ |
|-----------|----------|
| Runtime | Node.js 20, TypeScript |
| HTTP Framework | Express.js |
| ORM | Prisma (PostgreSQL) |
| gRPC Server | `@grpc/grpc-js` |
| Events | RabbitMQ (amqplib) |
| Validation | `joi` |

---

## 3. Database Schema (`booking_db`)

### Bảng `Booking`

```sql
Booking {
  id                  String        @id @default(uuid())
  customerId          String                    -- Auth User.id

  -- Địa điểm
  pickupAddress       String
  pickupLat           Decimal
  pickupLng           Decimal
  dropoffAddress      String
  dropoffLat          Decimal
  dropoffLng          Decimal

  -- Tùy chọn
  vehicleType         VehicleType               -- MOTORBIKE | SCOOTER | CAR_4 | CAR_7
  paymentMethod       PaymentMethod             -- CASH | MOMO | VNPAY | WALLET

  -- Giá ước tính (snapshot từ Pricing Service)
  estimatedFare       Decimal
  estimatedDistance   Decimal                   -- km
  estimatedDuration   Int                       -- giây
  surgeMultiplier     Decimal @default(1)

  -- Trạng thái
  status              BookingStatus @default(PENDING)
  -- PENDING | CONFIRMED | CANCELLED | EXPIRED

  -- Metadata
  notes               String?                   -- Ghi chú của khách
  customerPhone       String?                   -- Phone snapshot

  -- Timestamps
  createdAt           DateTime @default(now())
  confirmedAt         DateTime?
  cancelledAt         DateTime?
  expiresAt           DateTime?                 -- Tự động expire sau X phút
}
```

**BookingStatus transitions:**
```
PENDING → CONFIRMED (khách bấm "Xác nhận đặt xe")
        → CANCELLED (khách hủy)
        → EXPIRED   (không hành động sau timeout)
CONFIRMED → CANCELLED
```

---

## 4. API Endpoints

| Method | Path | Mô tả | Auth |
|--------|------|-------|------|
| POST | `/api/bookings` | Tạo booking mới (xem giá) | ✅ CUSTOMER |
| GET | `/api/bookings/:id` | Xem chi tiết booking | ✅ |
| POST | `/api/bookings/:id/confirm` | Xác nhận → tạo chuyến đi | ✅ CUSTOMER |
| POST | `/api/bookings/:id/cancel` | Hủy booking | ✅ CUSTOMER |
| GET | `/api/bookings/history` | Lịch sử bookings | ✅ CUSTOMER |

---

## 5. Luồng Đặt Xe

```
Customer App                Booking Service              Pricing Service
     │                           │                             │
     │── POST /bookings ─────────►│                             │
     │   {pickup, dropoff, type}  │── gRPC EstimateFare ───────►│
     │                            │◄─ {fare, distance, surge} ──│
     │                            │ INSERT Booking (PENDING)     │
     │◄─ {bookingId, fare} ───────│                             │
     │                            │                             │
     │── POST /bookings/:id/confirm►                            │
     │                            │ UPDATE status = CONFIRMED   │
     │                            │── Publish booking.confirmed──┐
     │                            │                             │▼
     │                            │                        [Ride Service]
     │                            │                        Tạo Ride
     │◄─ {rideId} ────────────────│                             │
```

---

## 6. gRPC Interface

```protobuf
rpc GetBookingById (GetBookingByIdRequest) returns (BookingResponse);
rpc GetActiveBookingByCustomer (GetActiveBookingRequest) returns (BookingResponse);
```

---

## 7. Cấu hình & Biến môi trường

| Biến | Mô tả |
|------|-------|
| `DATABASE_URL` | PostgreSQL → `booking_db` |
| `RABBITMQ_URL` | Publish `booking.confirmed` |
| `PRICING_SERVICE_URL` | Gọi ước tính giá (HTTP hoặc gRPC) |
| `BOOKING_EXPIRY_MINUTES` | Thời gian tự động expire (mặc định 10 phút) |
| `GRPC_PORT` | Cổng gRPC (mặc định `50053`) |

---

## 8. Khởi động & Vận hành

```bash
npm run dev:booking

cd services/booking-service
npx prisma migrate dev
npx prisma generate

GET http://localhost:3008/health
```
