# Auth Service

> **Cổng HTTP:** 3001 | **Cổng gRPC:** 50051 | **Database:** PostgreSQL (`auth_db`)

---

## 1. Tổng quan

Auth Service là **nguồn sự thật duy nhất** cho danh tính người dùng trong hệ thống. Service chịu trách nhiệm:
- Đăng ký tài khoản qua OTP (phone-first)
- Đăng nhập bằng số điện thoại/email/identifier + mật khẩu và phát JWT access/refresh token
- Quản lý phiên đăng nhập (refresh, revoke)
- Kiểm tra danh tính qua gRPC (các service nội bộ gọi vào để validate userId)

Sau khi xác thực, API Gateway inject `x-user-id`, `x-user-role`, `x-user-email` vào mọi request — **các downstream service tin tưởng các header này mà không re-verify JWT**.

---

## 2. Công nghệ

| Thành phần | Công nghệ |
|-----------|----------|
| Runtime | Node.js 20, TypeScript |
| HTTP Framework | Express.js |
| ORM | Prisma (PostgreSQL) |
| Password | `bcryptjs` (salt rounds = 10) |
| Token | `jsonwebtoken` (HS256) |
| OTP Storage | Redis (TTL mặc định 120 giây, tự expire) |
| OTP SMS | Mock dev endpoint, Twilio, SpeedSMS, AWS SNS |
| gRPC Server | `@grpc/grpc-js` |
| Events | RabbitMQ (amqplib) |
| Validation | `joi` |

---

## 3. Database Schema (`auth_db`)

### Bảng `User`

```sql
User {
  id            String   @id @default(uuid())
  phone         String   @unique          -- Định danh chính (login bằng phone)
  email         String?  @unique          -- Tùy chọn
  passwordHash  String?                   -- bcrypt hash, có sau khi hoàn tất đăng ký
  role          Role     @default(CUSTOMER) -- CUSTOMER | DRIVER | ADMIN
  status        UserStatus @default(ACTIVE) -- ACTIVE | INACTIVE | SUSPENDED
  firstName     String?
  lastName      String?
  avatar        String?  -- URL ảnh đại diện
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

### Bảng `RefreshToken`

```sql
RefreshToken {
  id          String    @id @default(uuid())
  tokenId     String    @unique     -- UUID ngẫu nhiên, được lưu trong JWT payload
  userId      String               -- FK → User
  expiresAt   DateTime             -- Thời điểm hết hạn (7 ngày mặc định)
  revokedAt   DateTime?            -- NULL nếu còn hiệu lực
  deviceInfo  String?              -- User-Agent header
  ipAddress   String?              -- IP của client
  createdAt   DateTime @default(now())
}
```

### Bảng `OtpRecord`

```sql
OtpRecord {
  id        String    @id @default(uuid())
  phone     String                 -- Số điện thoại nhận OTP
  otpHash   String                 -- SHA-256 hash của mã OTP (không lưu plaintext trong mode thật)
  expiresAt DateTime               -- Hết hạn theo OTP_TTL_SECONDS (mặc định 120 giây)
  attempts  Int       @default(0)  -- Số lần thử sai (max 5)
  verified  Boolean   @default(false)
  createdAt DateTime  @default(now())
}
```

> **OTP chủ yếu lưu trong Redis** (TTL mặc định `120s`). `OtpRecord` dùng cho audit trail; OTP được hash SHA-256, chỉ mock mode mới lưu thêm plaintext ngắn hạn để lấy qua endpoint dev.

### Bảng `AuditLog`

```sql
AuditLog {
  id        String   @id @default(uuid())
  userId    String?              -- Có thể null nếu chưa login
  action    String               -- "LOGIN", "REGISTER", "LOGOUT", "OTP_SENT", ...
  phone     String?
  ipAddress String?
  success   Boolean
  metadata  Json?                -- Dữ liệu bổ sung (device, error reason...)
  createdAt DateTime @default(now())
}
```

---

## 4. API Endpoints

| Method | Path | Mô tả | Auth |
|--------|------|-------|------|
| POST | `/api/auth/register` | Đăng ký tài khoản mới | ❌ |
| POST | `/api/auth/register-phone/start` | Gửi OTP trước khi nhập hồ sơ | ❌ |
| POST | `/api/auth/register-phone/verify` | Xác thực OTP đăng ký | ❌ |
| POST | `/api/auth/register-phone/complete` | Hoàn tất đăng ký và nhận token | ❌ |
| POST | `/api/auth/login` | Đăng nhập bằng phone+password | ❌ |
| POST | `/api/auth/refresh` | Làm mới access token | ❌ (refresh token) |
| POST | `/api/auth/logout` | Thu hồi refresh token | ✅ |
| POST | `/api/auth/send-otp` | Gửi lại OTP đăng ký | ❌ |
| POST | `/api/auth/verify-otp` | Xác minh OTP cho flow đăng ký cũ | ❌ |
| POST | `/api/auth/forgot-password` | Gửi OTP đặt lại mật khẩu | ❌ |
| POST | `/api/auth/reset-password` | Xác thực OTP và đổi mật khẩu | ❌ |
| GET | `/api/auth/dev/otp?phone=...&purpose=register` | Lấy OTP mock (Postman) | ✅ khi `OTP_SMS_MODE=mock` và (dev **hoặc** `OTP_ENABLE_DEV_ENDPOINT=true` trên server demo) |
| PATCH | `/api/auth/change-password` | Đổi mật khẩu | ✅ |
| GET | `/api/auth/me` | Thông tin user hiện tại | ✅ |
| PATCH | `/api/auth/me` | Cập nhật profile cơ bản | ✅ |

---

## 5. Luồng Đăng ký

```
Client                    Auth Service              Redis          SMS / Mock
  │                           │                       │                │
  │── POST /register-phone/start ────────────────────►│                │
  │   {phone}                 │── SET otp:{phone} ───►│                │
  │                           │   (TTL 120 giây)      │                │
  │                           │──────────── send SMS / mock log ──────►│
  │◄─ {message: "OTP sent"} ──│                       │                │
  │                           │                       │                │
  │── GET /dev/otp?phone=... ─►│                       │                │
  │   (Postman/docker compose)│◄─ otp plaintext (dev) │                │
  │                           │                       │                │
  │── POST /register-phone/verify ───────────────────►│                │
  │   {phone, otp}            │── GET otp:{phone} ───►│                │
  │                           │◄─ {otpHash} ──────────│                │
  │                           │ timing-safe SHA-256 compare            │
  │◄─ {verified: true} ───────│                       │                │
  │                           │                       │                │
  │── POST /register-phone/complete ─────────────────►│                │
  │   {phone, password, role} │── INSERT User ─────────────────────────│
  │◄─ {accessToken, user} ────│                       │                │
```

---

## 6. Luồng Đăng nhập & Token

```
Client                    Auth Service
  │                           │
  │── POST /login ───────────►│
  │   {phone, password}       │ 1. Tìm user theo phone
  │                           │ 2. bcrypt.compare(password, hash)
  │                           │ 3. Tạo accessToken (JWT, 15 phút)
  │                           │ 4. Tạo refreshToken (UUID, 7 ngày)
  │                           │ 5. Lưu RefreshToken vào DB
  │◄─ {accessToken,           │
  │    refreshToken, user} ───│
  │                           │
  │── POST /refresh ─────────►│
  │   {refreshToken}          │ 1. Xác minh refreshToken hợp lệ
  │                           │ 2. Kiểm tra DB: chưa bị revoke, chưa hết hạn
  │                           │ 3. Tạo accessToken mới (xoay vòng)
  │◄─ {accessToken} ──────────│
```

**JWT Payload:**
```json
{
  "sub": "user-uuid",
  "phone": "0901234567",
  "role": "CUSTOMER",
  "iat": 1714000000,
  "exp": 1714000900
}
```

---

## 7. gRPC Interface

**Proto service:** `AuthService`

```protobuf
rpc ValidateUser (ValidateUserRequest) returns (ValidateUserResponse);
rpc GetUserById (GetUserByIdRequest) returns (GetUserByIdResponse);
```

Các service nội bộ (ví dụ: Driver Service khi cần kiểm tra userId) gọi gRPC vào Auth thay vì HTTP để giảm latency.

---

## 8. OTP — Chế độ Mock (Development)

Khi `OTP_SMS_MODE=mock` (mặc định trong `docker-compose.yml`), OTP vẫn được log để debug nhưng cách test chính là gọi endpoint dev qua Gateway/Postman:

```http
GET http://localhost:3000/api/auth/dev/otp?phone=0901234501&purpose=register
GET http://localhost:3000/api/auth/dev/otp?phone=0901234501&purpose=reset
```

Điều kiện bật endpoint:
- `auth-service`: `OTP_SMS_MODE=mock` và (`NODE_ENV!=production` **hoặc** `OTP_ENABLE_DEV_ENDPOINT=true` — chỉ server demo)
- `api-gateway`: cùng `OTP_ENABLE_DEV_ENDPOINT=true` nếu `NODE_ENV=production` (đưa `/api/auth/dev/otp` vào public path)

Trong Postman collection, chạy request gửi OTP trước, sau đó chạy request **Lấy OTP (mock mode)**. Endpoint này không dùng cho production.

---

## 9. Cấu hình & Biến môi trường

| Biến | Mô tả |
|------|-------|
| `DATABASE_URL` | PostgreSQL connection string → `auth_db` |
| `REDIS_URL` | Redis cho OTP cache |
| `JWT_SECRET` | Khóa ký access token |
| `JWT_EXPIRES_IN` | Thời hạn access token (mặc định `15m`) |
| `REFRESH_TOKEN_SECRET` | Khóa ký refresh token |
| `REFRESH_TOKEN_EXPIRES_IN` | Thời hạn refresh token (mặc định `30d`) |
| `OTP_SMS_MODE` | `mock`, `twilio`, `speedsms`, hoặc `sns` |
| `TWILIO_ACCOUNT_SID` | Twilio credentials |
| `TWILIO_AUTH_TOKEN` | Twilio credentials |
| `TWILIO_FROM_PHONE` | Số gửi SMS |
| `GRPC_PORT` | Cổng gRPC server (mặc định `50051`) |
| `RABBITMQ_URL` | Publish sự kiện `user.registered` |

---

## 10. Khởi động & Vận hành

```bash
# Development (hot reload)
npm run dev:auth

# Prisma migrations
cd services/auth-service
npx prisma migrate dev    # tạo migration mới
npx prisma migrate deploy # chạy migration (production)
npx prisma generate       # tái tạo Prisma client

# Health check
GET http://localhost:3001/health
# → {"status":"ok","service":"auth-service"}
```

> **Bảo mật**: Không bao giờ log `passwordHash`. OTP plaintext chỉ tồn tại ngắn hạn trong Redis khi `OTP_SMS_MODE=mock` để phục vụ dev/test; production phải dùng SMS provider thật.
