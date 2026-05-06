# User Service

> **Cổng HTTP:** 3007 | **Cổng gRPC:** 50052 | **Database:** PostgreSQL (`user_db`)

---

## 1. Tổng quan

User Service quản lý **thông tin hồ sơ người dùng** tách biệt khỏi thông tin xác thực (Auth Service). Theo nguyên tắc Single Responsibility:
- **Auth Service** giữ: phone, passwordHash, role, JWT
- **User Service** giữ: firstName, lastName, avatar, trạng thái hồ sơ

Sự tách biệt này cho phép cập nhật thông tin cá nhân mà không ảnh hưởng đến hệ thống xác thực, và ngược lại.

---

## 2. Công nghệ

| Thành phần | Công nghệ |
|-----------|----------|
| Runtime | Node.js 20, TypeScript |
| HTTP Framework | Express.js |
| ORM | Prisma (PostgreSQL) |
| gRPC Server | `@grpc/grpc-js` |
| Validation | `joi` |

---

## 3. Database Schema (`user_db`)

### Bảng `UserProfile`

```sql
UserProfile {
  id          String      @id @default(uuid())
  userId      String      @unique    -- FK logic → Auth Service User.id (không ràng buộc DB)
  firstName   String?
  lastName    String?
  phone       String?                -- Bản sao từ Auth (denormalized, để tránh JOIN cross-service)
  avatar      String?                -- URL ảnh S3/CDN
  status      ProfileStatus @default(ACTIVE)  -- ACTIVE | INACTIVE | BANNED
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}
```

**Lưu ý thiết kế**: `userId` là UUID tham chiếu đến `User.id` trong `auth_db` nhưng **không có foreign key constraint** qua database (cross-service constraint). Tính nhất quán được đảm bảo bởi application layer: Auth Service publish event `user.registered` → User Service tạo profile.

---

## 4. API Endpoints

| Method | Path | Mô tả | Auth |
|--------|------|-------|------|
| POST | `/api/users` | Tạo hồ sơ user (thường do event/seed gọi) | Nội bộ |
| GET | `/api/users/:userId` | Lấy hồ sơ theo Auth `userId` | ✅ qua Gateway |

> Các thao tác đăng nhập, đổi mật khẩu, cập nhật profile cơ bản hiện nằm ở Auth Service (`/api/auth/me`). User Service chỉ giữ profile projection tối giản.

---

## 5. gRPC Interface

**Proto service:** `UserService`

```protobuf
rpc GetUserProfileById (GetUserProfileRequest) returns (UserProfileResponse);
rpc GetUserProfileByUserId (GetUserProfileByUserIdRequest) returns (UserProfileResponse);
```

Các service cần hiển thị tên người dùng (ví dụ: Review Service khi hiển thị tên reviewer) gọi gRPC vào đây.

---

## 6. Luồng tạo Profile

```
[Auth Service] → publish user.registered event (RabbitMQ)
                        │
                        ▼
               [User Service Consumer]
                        │
                        ▼
               INSERT UserProfile {userId, firstName, lastName, phone}
```

Khi người dùng register thành công, Auth Service publish sự kiện. User Service lắng nghe và tự động tạo profile. Điều này đảm bảo hồ sơ luôn tồn tại mà không cần User Service gọi trực tiếp vào Auth.

---

## 7. Cấu hình & Biến môi trường

| Biến | Mô tả |
|------|-------|
| `DATABASE_URL` | PostgreSQL → `user_db` |
| `RABBITMQ_URL` | Lắng nghe `user.registered` |
| `GRPC_PORT` | Cổng gRPC (mặc định `50052`) |
| `S3_BUCKET` | Lưu ảnh avatar (optional) |
| `S3_REGION` | AWS region |

---

## 8. Khởi động & Vận hành

```bash
npm run dev:user

# Prisma
cd services/user-service
npx prisma migrate dev
npx prisma generate

# Health check
GET http://localhost:3007/health
```
