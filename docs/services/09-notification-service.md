# Notification Service

> **Cổng HTTP:** 3005 | **Database:** MongoDB (`notification_db`)

---

## 1. Tổng quan

Notification Service là **kênh truyền thông một chiều** từ hệ thống đến người dùng. Service hoàn toàn **event-driven** — không nhận request HTTP trực tiếp từ clients, chỉ lắng nghe RabbitMQ events và gửi thông báo qua nhiều kênh.

**Kênh thông báo hỗ trợ:**
- **Email** — Nodemailer (SMTP/SendGrid)
- **SMS** — Twilio
- **Push Notification** — Firebase Cloud Messaging (FCM)
- **In-app** — Socket.IO (qua API Gateway)

---

## 2. Công nghệ

| Thành phần | Công nghệ |
|-----------|----------|
| Runtime | Node.js 20, TypeScript |
| HTTP Framework | Express.js |
| Database | MongoDB (Mongoose ODM) |
| Events | RabbitMQ (consumer only) |
| Email | Nodemailer + SMTP/SendGrid |
| SMS | Twilio |
| Push | Firebase Admin SDK (FCM) |

---

## 3. Database Schema (`notification_db`)

MongoDB document-based, không dùng Prisma.

### Collection `notifications`

```javascript
{
  _id:          ObjectId,
  userId:       String,         // Người nhận
  type:         String,         // "EMAIL" | "SMS" | "PUSH" | "IN_APP"
  recipient:    String,         // Email, phone, deviceToken
  subject:      String?,        // Email subject
  message:      String,         // Nội dung (plain text hoặc template key)
  templateKey:  String?,        // Key template nếu dùng template engine
  templateData: Object?,        // Data cho template
  status:       String,         // "PENDING" | "SENT" | "FAILED"
  priority:     String,         // "LOW" | "MEDIUM" | "HIGH"
  retryCount:   Number,
  maxRetries:   Number,
  errorMessage: String?,
  sentAt:       Date?,
  createdAt:    Date,
  updatedAt:    Date,
}
```

### Collection `notification_templates`

```javascript
{
  _id:      ObjectId,
  key:      String,           // "ride_confirmed", "payment_success"...
  channel:  String,           // "EMAIL" | "SMS"
  subject:  String?,
  body:     String,           // Template với {{variables}}
  isActive: Boolean,
}
```

---

## 4. Events Consumed từ RabbitMQ

| Event | Thông báo gửi | Kênh |
|-------|--------------|------|
| `user.registered` | Chào mừng đến CabBooking | Email |
| `ride.assigned` | Tài xế đang đến đón bạn | SMS + Push |
| `ride.picking_up` | Tài xế đã đến điểm đón | Push |
| `ride.completed` | Chuyến đi hoàn thành, tổng tiền X | Email + Push |
| `ride.cancelled` | Chuyến đi đã bị hủy | SMS + Push |
| `payment.completed` | Thanh toán thành công | Email |
| `payment.failed` | Thanh toán thất bại | SMS |
| `driver.approved` | Hồ sơ tài xế đã được duyệt | Email + SMS |
| `driver.rejected` | Hồ sơ tài xế bị từ chối | Email |

---

## 5. Retry Logic

```
Gửi thông báo thất bại
        │
        ▼
retryCount++
        │
        ├─ retryCount <= maxRetries (mặc định 3) → đưa vào retry queue (delay tăng dần)
        │   delay = 2^retryCount phút (1, 2, 4 phút)
        └─ retryCount > maxRetries → status = FAILED, log alert
```

---

## 6. API Endpoints

| Method | Path | Mô tả | Auth |
|--------|------|-------|------|
| GET | `/api/notifications` | Lịch sử thông báo của user hiện tại | ✅ |
| POST | `/api/notifications/send` | Gửi thông báo tùy chỉnh | ✅ ADMIN/SYSTEM |
| POST | `/api/notifications/retry` | Retry thông báo lỗi | ✅ ADMIN/SYSTEM |
| GET | `/api/notifications/statistics` | Thống kê gửi thành công/thất bại | ✅ ADMIN/SYSTEM |

---

## 7. Cấu hình & Biến môi trường

| Biến | Mô tả |
|------|-------|
| `MONGODB_URI` | MongoDB connection string → `notification_db` |
| `RABBITMQ_URL` | Consumer events |
| `SMTP_HOST` | SMTP server |
| `SMTP_PORT` | SMTP port |
| `SMTP_USER` | Email gửi |
| `SMTP_PASS` | Mật khẩu SMTP |
| `TWILIO_ACCOUNT_SID` | Twilio credentials |
| `TWILIO_AUTH_TOKEN` | |
| `TWILIO_PHONE_NUMBER` | Số gửi SMS |
| `FCM_SERVICE_ACCOUNT` | Firebase service account JSON |
| `NOTIFICATION_MODE` | `mock` (log only) hoặc `live` |

---

## 8. Khởi động & Vận hành

```bash
npm run dev:notification

# Service này không có Prisma migration
# MongoDB collections tự tạo khi insert

GET http://localhost:3005/health
```

> **Trong dev**: Đặt `NOTIFICATION_MODE=mock` để chỉ log thay vì gửi thật (tránh spam SMS/email).
