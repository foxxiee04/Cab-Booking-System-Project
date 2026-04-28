# API Gateway

> **Cổng HTTP:** 3000 | **Database:** Redis | **Vai trò:** Điểm vào duy nhất của toàn hệ thống

---

## 1. Tổng quan

API Gateway là **single entry point** cho toàn bộ traffic từ 3 ứng dụng frontend (customer, driver, admin). Không một client nào được gọi thẳng vào microservice phía sau — tất cả đều đi qua gateway.

Ngoài việc proxy request, gateway còn chứa hai thành phần nghiệp vụ nặng:
- **Socket.IO Hub**: máy chủ WebSocket duy nhất, phân phối real-time events đến tất cả clients.
- **Driver Matching Engine**: thuật toán điều phối tài xế theo địa lý, rating và hành vi.

---

## 2. Công nghệ

| Thành phần | Công nghệ |
|-----------|----------|
| Runtime | Node.js 20, TypeScript |
| HTTP Framework | Express.js |
| Real-time | Socket.IO 4 (Redis Adapter cho horizontal scale) |
| Proxy | `http-proxy-middleware` |
| Cache / Geo | ioredis (Redis geospatial `GEOADD`/`GEORADIUS`) |
| Auth | `jsonwebtoken` (RS256/HS256) |
| Metrics | `prom-client` (Prometheus) |
| Docs | Swagger UI (`swagger-jsdoc`) |
| Rate Limiting | `express-rate-limit` |

---

## 3. Kiến trúc nội bộ

```
src/
├── app.ts                  # Express app factory, middleware stack
├── index.ts                # Entry point: HTTP server + Socket + RabbitMQ consumer
├── routes/
│   ├── proxy.ts            # Bảng định tuyến → service URLs
│   ├── map.ts              # Endpoints bản đồ (nominatim, OSRM)
│   └── admin.ts            # Tổng hợp health/stats cho admin
├── socket/
│   └── server.ts           # Socket.IO server init, namespace, event handlers
├── matching/
│   └── driver-matcher.ts   # Thuật toán điều phối tài xế
├── events/
│   └── consumer.ts         # RabbitMQ consumer — nhận events từ Ride/Payment
├── location/
│   └── location.controller.ts  # Cập nhật vị trí tài xế vào Redis
├── grpc/
│   └── bridge.client.ts    # HTTP→gRPC bridge (Pricing, Driver)
├── middleware/
│   ├── auth.ts             # JWT verify, inject x-user-id/role/email headers
│   ├── rate-limit.ts       # Rate limiter cấu hình theo route
│   └── request-context.ts  # Request tracing (correlation ID)
└── swagger-docs.ts         # OpenAPI definition
```

---

## 4. Bảng định tuyến (Route Table)

| Path prefix | Downstream service | Ghi chú |
|------------|-------------------|---------|
| `/api/auth/*` | auth-service:3001 | Forced HTTP (không qua gRPC bridge) |
| `/api/users/*` | user-service:3007 | |
| `/api/driver/*` | driver-service:3003 | Một số route `me/*` forced HTTP |
| `/api/rides/*` | ride-service:3002 | |
| `/api/bookings/*` | booking-service:3008 | |
| `/api/pricing/*` | pricing-service:3009 | gRPC bridge cho `/estimate` |
| `/api/payment/*` | payment-service:3004 | |
| `/api/wallet/*` | wallet-service:3006 | |
| `/api/wallet/top-up/*` | payment-service:3004 | Overrides wallet route |
| `/api/admin/wallet/*` | wallet-service:3006 | |
| `/api/notifications/*` | notification-service:3005 | |
| `/api/reviews/*` | review-service:3010 | |
| `/api/ai/*` | ai-service:8000 | |

> **Address normalization**: Tất cả payload địa chỉ đi qua `normalizeAddressPayloadDeep()` trước khi forward — chuẩn hóa format địa chỉ Việt Nam không nhất quán.

---

## 5. Middleware Stack

```
Request → [Rate Limit] → [CORS] → [Helmet] → [Morgan log]
       → [Request Context] → [JWT Auth] → [Address Normalize]
       → [Proxy / Socket] → Response
```

**JWT Auth middleware** (`src/middleware/auth.ts`):
- Xác minh token từ `Authorization: Bearer <token>` header
- Inject 3 header vào request forward: `x-user-id`, `x-user-role`, `x-user-email`
- Downstream services **tin tưởng** các header này mà **không** verify lại JWT

---

## 6. Socket.IO Hub

```
Client connects → authenticate(token) event
               → validate JWT
               → join room: userId, rideId (nếu có)

Events phát ra bởi gateway:
  ride:status_update   → {rideId, status, driverId, ...}
  ride:driver_location → {rideId, lat, lng}
  ride:offer           → {rideId, driverId, ...} (gửi đến driver)
  ride:chat_message    → {rideId, senderId, message}
  call:incoming        → WebRTC signaling
  call:offer/answer/ice-candidate → WebRTC relay
```

**Redis Adapter**: Socket.IO dùng Redis pub/sub để đồng bộ events giữa nhiều instance gateway khi scale ngang.

---

## 7. Thuật toán Driver Matching

**File:** `src/matching/driver-matcher.ts`

### Luồng điều phối

```
ride.created event received
    │
    ▼
Round 1: radius = 2km, max_drivers = 1
    │ offer gửi đến tài xế tốt nhất
    │ timeout ~30s
    ├─ accepted → ASSIGNED
    └─ rejected/timeout → Round 2: radius = 3km, max_drivers = 3
                          ├─ accepted → ASSIGNED  
                          └─ timeout → Round 3: radius = 5km, max_drivers = 5
                                       ├─ accepted → ASSIGNED
                                       └─ all rejected → ride.no_driver_found
```

### Hàm tính điểm (Scoring)

```typescript
score = 0.40 × (1 - normalizedDistance)   // Khoảng cách (càng gần điểm càng cao)
      + 0.25 × normalizedRating            // Rating trung bình tài xế
      + 0.15 × normalizedIdleTime          // Thời gian chờ (càng lâu chờ càng ưu tiên)
      + 0.15 × acceptanceRate              // Tỷ lệ chấp nhận lịch sử
      - 0.05 × cancelRate                  // Phạt tỷ lệ hủy
```

Nếu `MATCHING_AI_ADJUSTMENT_ENABLED=true`, xác suất chấp nhận từ AI service điều chỉnh điểm (timeout 150ms, fallback về điểm gốc).

### Redis Geospatial

```
GEOADD drivers:geo:online <lng> <lat> <driverId>   // Driver online
GEORADIUS drivers:geo:online <lng> <lat> <radius> km ASC  // Tìm gần nhất
ZREM drivers:geo:online <driverId>                  // Driver offline/busy
```

---

## 8. RabbitMQ Consumer

Gateway subscribe vào `domain-events` topic exchange và xử lý các events sau:

| Event | Hành động |
|-------|----------|
| `ride.created` | Kích hoạt matching algorithm |
| `ride.offered` | Gửi Socket.IO offer đến driver |
| `ride.accepted` | Broadcast trạng thái đến customer |
| `ride.picking_up` | Update location tracking |
| `ride.started` | Bắt đầu stream vị trí tài xế |
| `ride.completed` | Dừng tracking, broadcast kết quả |
| `ride.cancelled` | Notify cả hai bên |
| `payment.completed` | Notify customer |

---

## 9. Cấu hình & Biến môi trường

| Biến | Mô tả | Mặc định |
|------|-------|---------|
| `PORT` | Cổng HTTP | 3000 |
| `JWT_SECRET` | Khóa ký JWT | — (bắt buộc) |
| `REDIS_URL` | Kết nối Redis | `redis://localhost:6379` |
| `RABBITMQ_URL` | Kết nối RabbitMQ | — (bắt buộc) |
| `*_SERVICE_URL` | URLs dịch vụ phía sau | — (bắt buộc) |
| `MATCHING_ROUNDS` | Cấu hình vòng matching `radius×count` | `2×1,3×3,5×5` |
| `MATCHING_AI_ADJUSTMENT_ENABLED` | Dùng AI để điều chỉnh điểm | `false` |
| `RATE_LIMIT_WINDOW_MS` | Cửa sổ rate limit | 60000 |
| `RATE_LIMIT_MAX_REQUESTS` | Số request tối đa/window | 100 |

---

## 10. Khởi động & Vận hành

```bash
# Development
npm run dev:gateway

# Production (Docker)
docker compose up api-gateway

# Health check
GET http://localhost:3000/health
# → {"status":"healthy","service":"api-gateway","timestamp":"..."}

# Readiness (kiểm tra downstream)
GET http://localhost:3000/ready
# → {"ready": true, "checks": {...}}

# Metrics (Prometheus)
GET http://localhost:3000/metrics

# Swagger docs
GET http://localhost:3000/swagger-docs
```

> **Build context**: Gateway cần build từ **root** vì phụ thuộc vào `shared/` package.
