# Auth Service

> **Cổng HTTP:** 3001 | **Cổng gRPC:** 50051 | **Database:** PostgreSQL (`auth_db`)

---

## 1. Tổng quan

Auth Service là **nguồn sự thật duy nhất** cho danh tính người dùng trong hệ thống. Service chịu trách nhiệm:
- Đăng ký tài khoản qua OTP (phone-first)
- Xác thực danh tính và phát JWT access/refresh token
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
| OTP Storage | Redis (TTL tự động expire) |
| OTP SMS | Twilio (mock mode: log stdout) |
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
  passwordHash  String                    -- bcrypt hash
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
  expiresAt   DateTime             -- Thời điểm hết hạn (30 ngày mặc định)
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
  otpHash   String                 -- bcrypt hash của mã OTP (không lưu plaintext)
  expiresAt DateTime               -- Hết hạn sau 5 phút
  attempts  Int       @default(0)  -- Số lần thử sai (max 3)
  verified  Boolean   @default(false)
  createdAt DateTime  @default(now())
}
```

> **OTP chủ yếu lưu trong Redis** (TTL = 5 phút). `OtpRecord` dùng cho audit trail.

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
| POST | `/api/auth/login` | Đăng nhập bằng phone+password | ❌ |
| POST | `/api/auth/refresh` | Làm mới access token | ❌ (refresh token) |
| POST | `/api/auth/logout` | Thu hồi refresh token | ✅ |
| POST | `/api/auth/otp/send` | Gửi OTP đến số điện thoại | ❌ |
| POST | `/api/auth/otp/verify` | Xác minh OTP | ❌ |
| POST | `/api/auth/change-password` | Đổi mật khẩu | ✅ |
| GET | `/api/auth/me` | Thông tin user hiện tại | ✅ |

---

## 5. Luồng Đăng ký

```
Client                    Auth Service              Redis          SMS (Twilio)
  │                           │                       │                │
  │── POST /otp/send ────────►│                       │                │
  │   {phone}                 │── SET otp:{phone} ───►│                │
  │                           │   (TTL 5 phút)        │                │
  │                           │──────────────────────────── send SMS ──►│
  │◄─ {message: "OTP sent"} ──│                       │                │
  │                           │                       │                │
  │── POST /otp/verify ──────►│                       │                │
  │   {phone, otp}            │── GET otp:{phone} ───►│                │
  │                           │◄─ {otpHash} ──────────│                │
  │                           │ bcrypt.compare()       │                │
  │◄─ {verified: true} ───────│                       │                │
  │                           │                       │                │
  │── POST /register ────────►│                       │                │
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
  │                           │ 4. Tạo refreshToken (UUID, 30 ngày)
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

Khi `OTP_SMS_MODE=mock` (mặc định trong dev):
```bash
# OTP được in ra stdout thay vì gửi SMS
docker logs cab-auth-service 2>&1 | grep OTP
```

**Không bao giờ expose OTP qua API** — kể cả trong môi trường dev.

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
| `OTP_SMS_MODE` | `mock` (stdout) hoặc `twilio` (thật) |
| `TWILIO_ACCOUNT_SID` | Twilio credentials |
| `TWILIO_AUTH_TOKEN` | Twilio credentials |
| `TWILIO_PHONE_NUMBER` | Số gửi SMS |
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

> **Bảo mật**: Không bao giờ log `passwordHash` hoặc OTP plaintext. `AuditLog` không lưu mật khẩu.
