# Payment Service

> **Cổng HTTP:** 3004 | **Cổng gRPC:** 50056 | **Database:** PostgreSQL (`payment_db`)

---

## 1. Tổng quan

Payment Service xử lý **toàn bộ vòng đời thanh toán** của chuyến đi:
- Tính giá cuối cùng (fare) sau khi chuyến hoàn thành
- Tích hợp cổng thanh toán MoMo và VNPay
- Tính hoa hồng và thu nhập tài xế
- Quản lý voucher/mã giảm giá
- Đảm bảo **idempotency** — callback IPN có thể gọi nhiều lần, không được xử lý trùng

---

## 2. Công nghệ

| Thành phần | Công nghệ |
|-----------|----------|
| Runtime | Node.js 20, TypeScript |
| HTTP Framework | Express.js |
| ORM | Prisma (PostgreSQL) |
| Events | RabbitMQ (amqplib) với **Outbox Pattern** |
| Payment Gateways | MoMo API, VNPay API |
| Validation | `joi` |
| gRPC Server | `@grpc/grpc-js` |

---

## 3. Database Schema (`payment_db`)

### Bảng `Fare` — Cấu trúc giá chuyến đi

```sql
Fare {
  id                String    @id @default(uuid())
  rideId            String    @unique     -- FK logic → Ride
  baseFare          Decimal               -- Giá khởi điểm
  distanceFare      Decimal               -- Cước khoảng cách
  timeFare          Decimal               -- Cước thời gian
  surgeMultiplier   Decimal @default(1)   -- Hệ số giờ cao điểm
  totalFare         Decimal               -- Tổng = (base + dist + time) × surge
  distanceKm        Decimal
  durationMinutes   Int
  currency          String @default("VND")
  createdAt         DateTime @default(now())
}
```

### Bảng `Payment` — Giao dịch thanh toán

```sql
Payment {
  id                String          @id @default(uuid())
  rideId            String                  -- FK logic → Ride
  customerId        String
  driverId          String?

  amount            Decimal                 -- Số tiền gốc
  discountAmount    Decimal @default(0)     -- Giảm từ voucher
  finalAmount       Decimal                 -- amount - discountAmount

  currency          String @default("VND")
  method            PaymentMethod           -- CASH | MOMO | VNPAY | WALLET
  provider          PaymentProvider         -- MOCK | MOMO | VNPAY

  status            PaymentStatus           -- PENDING | PROCESSING | COMPLETED | FAILED | REFUNDED

  -- Gateway response
  transactionId     String?                 -- ID từ cổng thanh toán
  paymentIntentId   String?
  paymentMethodId   String?
  clientSecret      String?                 -- VNPay/MoMo redirect secret
  metadata          Json?

  -- Idempotency
  idempotencyKey    String    @unique       -- Chìa khóa tránh xử lý trùng

  -- Voucher
  voucherId         String?
  voucherCode       String?

  -- Timestamps
  initiatedAt       DateTime @default(now())
  completedAt       DateTime?
  failedAt          DateTime?
  refundedAt        DateTime?
  refundReason      String?
}
```

### Bảng `DriverEarnings` — Thu nhập tài xế

```sql
DriverEarnings {
  id              String    @id @default(uuid())
  rideId          String    @unique
  driverId        String

  grossFare       Decimal               -- Giá toàn bộ chuyến
  commissionRate  Decimal               -- Tỷ lệ hoa hồng (0.15–0.20)
  platformFee     Decimal               -- grossFare × commissionRate
  bonus           Decimal @default(0)   -- Thưởng (đủ cuốc, giờ cao điểm...)
  penalty         Decimal @default(0)   -- Phạt (hủy nhiều...)
  netEarnings     Decimal               -- grossFare - platformFee + bonus - penalty

  paymentMethod   PaymentMethod
  driverCollected Boolean @default(false)  -- true nếu CASH (tài xế nhận tiền mặt)
  cashDebt        Decimal @default(0)      -- Nợ nền tảng nếu CASH ride
  isPaid          Boolean @default(false)

  bonusBreakdown  Json?
  penaltyBreakdown Json?
  settledAt       DateTime?
  createdAt       DateTime @default(now())
}
```

### Bảng `Voucher` — Mã giảm giá

```sql
Voucher {
  id            String        @id @default(uuid())
  code          String        @unique           -- WELCOME20, FLAT30K...
  description   String
  audienceType  VoucherAudience                 -- ALL_CUSTOMERS | NEW_CUSTOMERS | RETURNING_CUSTOMERS
  discountType  DiscountType                    -- PERCENT | FIXED
  discountValue Decimal                         -- 20 (%) hoặc 30000 (VND)
  maxDiscount   Decimal?                        -- Giới hạn giảm tối đa
  minFare       Decimal @default(0)             -- Giá chuyến tối thiểu
  startTime     DateTime
  endTime       DateTime
  usageLimit    Int?                            -- Tổng số lần dùng
  perUserLimit  Int @default(1)                 -- Mỗi user dùng tối đa
  isActive      Boolean @default(true)
}
```

### Bảng `OutboxEvent` — Đảm bảo at-least-once delivery

```sql
OutboxEvent {
  id              String    @id @default(uuid())
  eventType       String               -- "payment.completed", "driver.earnings.settled"
  payload         Json
  correlationId   String?
  publishedAt     DateTime?            -- NULL nếu chưa gửi
  createdAt       DateTime @default(now())
}
```

---

## 4. Tỷ lệ Hoa hồng

| Loại xe | Tỷ lệ hoa hồng |
|---------|---------------|
| CAR_7 | 15% |
| CAR_4 | 18% |
| SCOOTER | 18% |
| MOTORBIKE | 20% |

---

## 5. API Endpoints

### Customer

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/payments` | Tạo payment ngoài/generic |
| POST | `/api/payments/intents` | Tạo payment intent |
| GET | `/api/payments/methods` | Danh sách phương thức thanh toán |
| POST | `/api/payments/momo/create` | Tạo thanh toán MoMo |
| POST | `/api/payments/vnpay/create` | Tạo thanh toán VNPay |
| GET | `/api/payments/:id` | Trạng thái thanh toán theo paymentId |
| GET | `/api/payments/ride/:rideId` | Thanh toán theo rideId |
| GET | `/api/payments/customer/history` | Lịch sử thanh toán của khách |
| POST | `/api/payments/ipn/momo` | Callback IPN MoMo thống nhất |
| POST | `/api/payments/ipn/vnpay` | Callback IPN VNPay thống nhất |
| GET | `/api/voucher/public` | Danh sách voucher công khai |
| POST | `/api/voucher/apply` | Áp voucher |

### Driver Wallet (trong payment-service)

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/wallet` | Ví payment-side của tài xế |
| POST | `/api/wallet/top-up/init` | Khởi tạo nạp ví qua MoMo/VNPay |
| POST | `/api/wallet/top-up/sandbox-confirm` | Xác nhận nạp ví trong sandbox/dev |
| GET | `/api/wallet/top-up/status/:topUpId` | Kiểm tra trạng thái lệnh nạp |
| POST | `/api/wallet/withdraw` | Yêu cầu rút tiền |

---

## 6. Idempotency — Chống xử lý trùng

```
IPN callback từ MoMo/VNPay
    │
    ▼
Tìm Payment theo idempotencyKey
    │
    ├─ Đã tồn tại và status = COMPLETED → trả về 200 (bỏ qua)
    └─ Chưa tồn tại hoặc PENDING
         │
         ▼
    Xử lý thanh toán trong DB transaction
         │
         ▼
    UPDATE Payment.status = COMPLETED
    INSERT OutboxEvent {type: "payment.completed", ...}
         │
         ▼
    Outbox Worker: đọc và publish RabbitMQ
    UPDATE OutboxEvent.publishedAt = now()
```

---

## 7. Luồng Thanh toán Chuyến Đi

```
[ride.completed event received]
         │
         ▼
Payment Service consumer
         │
         ├─ Lấy Fare từ Pricing Service (gRPC)
         ├─ Áp dụng voucher nếu có (giảm finalAmount)
         ├─ INSERT Fare record
         ├─ INSERT Payment record (status=PENDING)
         │
         ├─ Nếu CASH:
         │    └─ Payment status = COMPLETED (tiền mặt không cần gateway)
         │       INSERT DriverEarnings (driverCollected=true, cashDebt=platformFee)
         │
         └─ Nếu MOMO/VNPAY:
              └─ Gọi payment gateway API
                 └─ Nhận IPN callback
                    └─ UPDATE Payment status = COMPLETED
                       INSERT DriverEarnings
                       Publish payment.completed → Wallet Service
```

---

## 8. Outbox Pattern

```
┌──────────────────────────────────────────────┐
│  DB Transaction                               │
│  ├─ UPDATE Payment                           │
│  └─ INSERT OutboxEvent (publishedAt = NULL)  │
└──────────────────────────────────────────────┘
        │
        ▼ (không đồng bộ)
┌─────────────────────────────────────────────┐
│  Outbox Worker (polling mỗi 1s)              │
│  SELECT * FROM OutboxEvent WHERE publishedAt IS NULL │
│  FOR EACH event:                             │
│    publish to RabbitMQ                       │
│    UPDATE publishedAt = NOW()                │
└─────────────────────────────────────────────┘
```

Đảm bảo: kể cả khi RabbitMQ tạm thời ngắt kết nối, event không bao giờ bị mất.

---

## 9. Cấu hình & Biến môi trường

| Biến | Mô tả |
|------|-------|
| `DATABASE_URL` | PostgreSQL → `payment_db` |
| `RABBITMQ_URL` | Publish/consume events |
| `MOMO_PARTNER_CODE` | Thông tin tích hợp MoMo |
| `MOMO_ACCESS_KEY` | |
| `MOMO_SECRET_KEY` | |
| `MOMO_IPN_URL` | URL callback từ MoMo |
| `VNPAY_TMN_CODE` | Thông tin tích hợp VNPay |
| `VNPAY_HASH_SECRET` | |
| `VNPAY_IPN_URL` | URL callback từ VNPay |
| `INTERNAL_SERVICE_TOKEN` | Token cho internal API calls |
| `GRPC_PORT` | Cổng gRPC (mặc định `50056`) |

---

## 10. Khởi động & Vận hành

```bash
npm run dev:payment

cd services/payment-service
npx prisma migrate dev
npx prisma generate

GET http://localhost:3004/health
```
