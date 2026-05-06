# Driver Service

> **Cổng HTTP:** 3003 | **Cổng gRPC:** 50055 | **Database:** PostgreSQL (`driver_db`) + Redis

---

## 1. Tổng quan

Driver Service quản lý **toàn bộ vòng đời của tài xế** trong hệ thống:
- Hồ sơ tài xế, phương tiện, bằng lái
- Quy trình duyệt hồ sơ (PENDING → APPROVED/REJECTED)
- Trạng thái trực tuyến (ONLINE/OFFLINE/BUSY)
- Vị trí địa lý real-time (Redis geospatial index)
- Kiểm tra điều kiện nhận chuyến (`canAcceptRide`)

---

## 2. Công nghệ

| Thành phần | Công nghệ |
|-----------|----------|
| Runtime | Node.js 20, TypeScript |
| HTTP Framework | Express.js |
| ORM | Prisma (PostgreSQL) |
| Cache + Geo | ioredis (Redis `GEOADD`/`GEORADIUS`) |
| gRPC Server | `@grpc/grpc-js` |
| Events | RabbitMQ (amqplib) |
| Validation | `joi` |

---

## 3. Database Schema (`driver_db`)

### Bảng `Driver`

```sql
Driver {
  id                  String          @id @default(uuid())
  userId              String          @unique   -- FK logic → Auth User.id

  -- Trạng thái
  status              DriverStatus    @default(PENDING)
  -- PENDING | APPROVED | REJECTED | SUSPENDED
  availabilityStatus  AvailabilityStatus @default(OFFLINE)
  -- OFFLINE | ONLINE | BUSY

  -- Thông tin phương tiện
  vehicleType         VehicleType     -- MOTORBIKE | SCOOTER | CAR_4 | CAR_7
  vehicleBrand        String
  vehicleModel        String
  vehiclePlate        String          @unique
  vehicleColor        String?
  vehicleYear         Int?
  vehicleImageUrl     String?

  -- Bằng lái
  licenseClass        LicenseClass    -- A1 | B | D2 | ...
  licenseNumber       String
  licenseExpiryDate   DateTime
  licenseVerified     Boolean         @default(false)

  -- Rating
  ratingAverage       Decimal         @default(0)   -- 0–5 sao
  ratingCount         Int             @default(0)

  -- Vị trí hiện tại
  lastLocationLat     Decimal?
  lastLocationLng     Decimal?
  lastLocationTime    DateTime?

  -- Chuyến hiện tại
  currentRideId       String?         -- NULL nếu không có chuyến

  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt
}
```

**Enums:**
```typescript
DriverStatus       = PENDING | APPROVED | REJECTED | SUSPENDED
AvailabilityStatus = OFFLINE | ONLINE | BUSY
VehicleType        = MOTORBIKE | SCOOTER | CAR_4 | CAR_7
LicenseClass       = A1 | A | B | C1 | C | D1 | D2 | D | BE | C1E | CE | D1E | D2E | DE
```

---

## 4. API Endpoints

### Tài xế tự quản lý

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/drivers/register` | Tạo hồ sơ tài xế |
| GET | `/api/drivers/me` | Xem hồ sơ tài xế của mình |
| PUT | `/api/drivers/me` | Cập nhật thông tin |
| POST | `/api/drivers/me/online` | Chuyển sang ONLINE |
| POST | `/api/drivers/me/offline` | Chuyển sang OFFLINE |
| POST | `/api/drivers/me/location` | Cập nhật vị trí (GPS) |
| GET | `/api/drivers/me/available-rides` | Xem chuyến có thể nhận |
| POST | `/api/drivers/me/rides/:rideId/accept` | Nhận chuyến từ danh sách/offer |
| GET | `/api/drivers/me/rides/assigned` | Chuyến đang được gán |

### Admin

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/admin/drivers` | Danh sách tài xế (phân trang, filter) |
| POST | `/api/admin/drivers/:driverId/approve` | Duyệt hồ sơ |
| POST | `/api/admin/drivers/:driverId/reject` | Từ chối hồ sơ |
| PATCH | `/api/drivers/:driverId/verify` | Xác minh bằng lái/hồ sơ |

> Route public qua Gateway dùng tiền tố `/api/drivers`, không phải `/api/driver`.

---

## 5. Redis Geospatial Index

```
Key: "drivers:geo:online"
Type: Redis Sorted Set (geospatial)

# Tài xế đi online
GEOADD drivers:geo:online <lng> <lat> <driverId>

# API Gateway tìm tài xế gần nhất
GEORADIUS drivers:geo:online <lng> <lat> 2 km ASC

# Tài xế đi offline / bận
ZREM drivers:geo:online <driverId>
```

Ngoài ra, driver stats được cache trong Redis Hash:
```
HSET driver:stats:<driverId>
  rating      4.72
  rideCount   128
  acceptRate  0.88
  cancelRate  0.04
```

---

## 6. gRPC Interface

**Proto service:** `DriverService`

```protobuf
rpc GetDriverById (GetDriverByIdRequest) returns (DriverResponse);
rpc GetDriverByUserId (GetDriverByUserIdRequest) returns (DriverResponse);
rpc CheckCanAcceptRide (CheckCanAcceptRideRequest) returns (CanAcceptRideResponse);
```

**`CheckCanAcceptRide`**: Trước khi tài xế đi online, gọi Payment Service để kiểm tra `balance > DEBT_LIMIT`. Nếu nợ quá hạn, tài xế không thể nhận chuyến.

---

## 7. Luồng Duyệt Tài Xế

```
Tài xế đăng ký → status = PENDING
Admin xem danh sách PENDING
Admin duyệt → PATCH /approve
    │
    ├─ licenseVerified = true
    ├─ status = APPROVED
    └─ Publish: driver.approved (→ Wallet Service tạo ví)
                               (→ Notification: thông báo tài xế)

Admin từ chối → status = REJECTED
    └─ Publish: driver.rejected (→ Notification)
```

---

## 8. Luồng Cập nhật Vị trí

```
Driver App
    │── POST /api/drivers/me/location {lat, lng}
    ▼
Driver Service
    │── UPDATE Driver.lastLocationLat/Lng/Time
    │── GEOADD drivers:geo:online lng lat driverId
    └── Publish: driver.location_updated

API Gateway (Socket.IO)
    └── Nhận event → broadcast đến customer đang xem chuyến
```

Tần suất cập nhật: ~5 giây/lần khi tài xế đang chạy chuyến, ~30 giây khi ONLINE chờ.

---

## 9. Wallet Gate (Điều kiện nhận chuyến)

Trước khi tài xế chuyển sang ONLINE, Driver Service gọi Payment Service qua HTTP nội bộ:
```
GET /internal/wallet/can-accept-ride
Headers: x-internal-token: <secret>
         x-driver-id: <driverId>

Response: { canAccept: true/false, reason: "..." }
```

Điều kiện `canAccept = false`: tài xế có nợ quá hạn, số dư ví < ngưỡng tối thiểu.

---

## 10. Cấu hình & Biến môi trường

| Biến | Mô tả |
|------|-------|
| `DATABASE_URL` | PostgreSQL → `driver_db` |
| `REDIS_URL` | Geospatial index và stats cache |
| `RABBITMQ_URL` | Publish/consume events |
| `PAYMENT_SERVICE_URL` | Gọi kiểm tra wallet gate |
| `INTERNAL_SERVICE_TOKEN` | Token cho internal calls |
| `GRPC_PORT` | Cổng gRPC (mặc định `50055`) |
| `DRIVER_GEO_KEY` | Redis key (mặc định `drivers:geo:online`) |

---

## 11. Khởi động & Vận hành

```bash
npm run dev:driver

# Prisma
cd services/driver-service
npx prisma migrate dev
npx prisma generate

# Health check
GET http://localhost:3003/health
```

> **Build context**: Driver Service cần build từ **root** (phụ thuộc `shared/`).
