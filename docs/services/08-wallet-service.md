# Wallet Service

> **Cổng HTTP:** 3006 | **Database:** PostgreSQL (`wallet_db`)

---

## 1. Tổng quan

Wallet Service là **nguồn sự thật duy nhất cho số dư ví tài xế** (driver-facing balance). Đây là service fintech phức tạp nhất trong hệ thống, thực hiện:

- Ký quỹ kích hoạt tài khoản (300.000 VND bắt buộc)
- Giữ thu nhập T+24h (pending balance) trước khi có thể rút
- Ghi nhận công nợ từng chuyến CASH và tất toán FIFO
- Sổ cái thương nhân (MerchantLedger) ghi nhận mọi dòng tiền vào/ra nền tảng
- Số dư singleton MerchantBalance phản ánh tài chính nền tảng

> **Phân biệt với Payment Service**: `payment_db` có DriverWallet nhưng chỉ dùng cho nạp tiền (top-up flow). `wallet_db` là nguồn sự thật cho số dư thực tế.

---

## 2. Công nghệ

| Thành phần | Công nghệ |
|-----------|----------|
| Runtime | Node.js 20, TypeScript |
| HTTP Framework | Express.js |
| ORM | Prisma (PostgreSQL) |
| Events | RabbitMQ (amqplib) |
| Validation | `joi` |

---

## 3. Database Schema (`wallet_db`)

### Bảng `DriverWallet` — Ví tài xế

```sql
DriverWallet {
  id                        String          @id @default(uuid())
  driverId                  String          @unique   -- Auth User.id

  balance                   Decimal @default(0)     -- Tổng số dư (bao gồm locked)
  availableBalance          Decimal @default(0)     -- Có thể rút (balance - locked - pending)
  pendingBalance            Decimal @default(0)     -- Thu nhập đang giữ T+24h
  lockedBalance             Decimal @default(0)     -- Ký quỹ cố định (300.000đ)
  debt                      Decimal @default(0)     -- Nợ từ chuyến CASH chưa thanh toán

  status                    WalletStatus @default(INACTIVE)
  -- INACTIVE | ACTIVE | BLOCKED
  initialActivationCompleted Boolean @default(false)
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt
}
```

**Công thức số dư:**
```
availableBalance = balance - lockedBalance - pendingBalance - debt
```

### Bảng `PendingEarning` — Giữ thu nhập T+24h

```sql
PendingEarning {
  id          String    @id @default(uuid())
  driverId    String
  amount      Decimal                         -- Số tiền giữ
  rideId      String    @unique               -- FK logic → Ride
  settleAt    DateTime                        -- now() + 24h
  settledAt   DateTime?                       -- NULL nếu chưa giải phóng
  createdAt   DateTime  @default(now())
}
```

### Bảng `DebtRecord` — Công nợ từ chuyến CASH

```sql
DebtRecord {
  id          String      @id @default(uuid())
  driverId    String
  amount      Decimal                         -- Tổng nợ ban đầu (= platformFee)
  remaining   Decimal                         -- Còn lại chưa trả
  rideId      String                          -- FK logic → Ride
  status      DebtStatus                      -- ACTIVE | OVERDUE | SETTLED
  dueDate     DateTime                        -- now() + 2 ngày
  settledAt   DateTime?
  createdAt   DateTime    @default(now())
}
```

### Bảng `WalletTransaction` — Lịch sử giao dịch

```sql
WalletTransaction {
  id              String      @id @default(uuid())
  driverId        String
  type            WalletTxType        -- EARN | COMMISSION | BONUS | WITHDRAW | REFUND | TOP_UP
  direction       TxDirection         -- CREDIT | DEBIT
  amount          Decimal
  balanceAfter    Decimal             -- Số dư sau giao dịch (immutable snapshot)
  description     String
  referenceId     String?             -- rideId, withdrawalId...
  idempotencyKey  String    @unique   -- Chống xử lý trùng
  metadata        Json?
  createdAt       DateTime  @default(now())
}
```

### Bảng `WithdrawalRequest` — Yêu cầu rút tiền

```sql
WithdrawalRequest {
  id              String              @id @default(uuid())
  driverId        String
  amount          Decimal
  status          WithdrawalStatus    -- PENDING | PROCESSING | COMPLETED | FAILED | CANCELLED
  bankName        String
  accountNumber   String
  accountHolder   String
  processedAt     DateTime?
  failureReason   String?
  createdAt       DateTime @default(now())
}
```

### Bảng `MerchantLedger` — Sổ cái nền tảng

```sql
MerchantLedger {
  id              String          @id @default(uuid())
  type            LedgerType      -- IN | OUT
  category        LedgerCategory
  -- IN:  PAYMENT (khách trả), TOP_UP (tài xế nạp)
  -- OUT: PAYOUT (chi cho tài xế), WITHDRAW (tài xế rút), VOUCHER, REFUND
  amount          Decimal
  referenceId     String?
  idempotencyKey  String @unique
  description     String
  metadata        Json?
  createdAt       DateTime @default(now())
}
```

### Bảng `MerchantBalance` — Số dư nền tảng (singleton)

```sql
MerchantBalance {
  id        Int     @id @default(1)  -- Luôn = 1 (singleton)
  balance   Decimal                  -- totalIn - totalOut
  totalIn   Decimal
  totalOut  Decimal
  updatedAt DateTime @updatedAt
}
```

---

## 4. Mô hình Tài chính

```
Chuyến đi HOÀN THÀNH
         │
         ├─── CASH ride (tài xế thu tiền mặt):
         │      • Publish driver.earnings.settled
         │      • Wallet Service: INSERT PendingEarning (T+24h)
         │                        INSERT DebtRecord (T+2d) cho platformFee
         │
         └─── ONLINE ride (MoMo/VNPay):
                • Publish driver.earnings.settled
                • Wallet Service: INSERT PendingEarning (T+24h)
                  (không có DebtRecord vì platform đã thu trực tiếp)

Sau 24h (settlement cron):
         • PendingEarning → settledAt = now()
         • availableBalance += amount
         • Nếu còn debt → trừ debt trước (FIFO), rồi mới credit phần còn lại

Rút tiền:
         • Kiểm tra availableBalance >= amount + lockedBalance
         • INSERT WithdrawalRequest (PENDING)
         • Admin duyệt → chuyển khoản ngân hàng → COMPLETED
         • DEBIT WalletTransaction
```

---

## 5. API Endpoints

### Tài xế

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/wallet/balance` | Số dư chi tiết (balance, available, pending, debt) |
| GET | `/api/wallet/transactions` | Lịch sử giao dịch (phân trang) |
| GET | `/api/wallet/pending-earnings` | Thu nhập đang giữ T+24h |
| GET | `/api/wallet/debts` | Danh sách công nợ |
| POST | `/api/wallet/withdraw` | Yêu cầu rút tiền |
| GET | `/api/wallet/withdrawals` | Lịch sử rút tiền |

### Admin

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/admin/wallet/merchant-balance` | Số dư nền tảng |
| GET | `/api/admin/wallet/merchant-ledger` | Sổ cái nền tảng |
| GET | `/api/admin/wallet/:driverId` | Ví của tài xế cụ thể |
| PATCH | `/api/admin/wallet/withdrawals/:id/approve` | Duyệt rút tiền |
| PATCH | `/api/admin/wallet/withdrawals/:id/reject` | Từ chối rút tiền |

---

## 6. Events Consumed

| Event | Hành động |
|-------|----------|
| `driver.earnings.settled` | Tạo PendingEarning, DebtRecord nếu CASH |
| `refund.completed` | CREDIT ví tài xế nếu platform refund |
| `wallet.topup.completed` | CREDIT ví tài xế (nạp tiền thành công) |
| `driver.approved` | Tạo DriverWallet với status=INACTIVE |

---

## 7. Kích hoạt Ví (Ký quỹ)

```
Tài xế được duyệt → driver.approved → Wallet Service tạo ví INACTIVE
        │
        ├─ Tài xế nạp 300.000đ (qua MoMo/VNPay)
        │  → payment-service xử lý top-up
        │  → Publish wallet.topup.completed
        │
        ▼
Wallet Service: CREDIT 300.000đ
                lockedBalance = 300.000đ
                status = ACTIVE
                initialActivationCompleted = true
```

---

## 8. FIFO Debt Settlement

Khi thu nhập T+24h được giải phóng:
```
grossEarning = 100.000đ
debt (tổng) = 18.000đ (platformFee từ chuyến CASH trước đó)

Settlement:
  1. Trả nợ trước: debt -= 18.000, remaining = 0 → SETTLED
  2. Credit phần còn lại: availableBalance += (100.000 - 18.000) = 82.000đ
```

---

## 9. Cấu hình & Biến môi trường

| Biến | Mô tả |
|------|-------|
| `DATABASE_URL` | PostgreSQL → `wallet_db` |
| `RABBITMQ_URL` | Consume events |
| `ACTIVATION_DEPOSIT` | Số tiền ký quỹ (mặc định `300000`) |
| `PENDING_HOLD_HOURS` | Thời gian giữ thu nhập (mặc định `24`) |
| `DEBT_DUE_DAYS` | Hạn thanh toán nợ (mặc định `2`) |
| `BANK_SIMULATION_ENABLED` | Mô phỏng ngân hàng (dev) |

---

## 10. Khởi động & Vận hành

```bash
npm run dev:wallet

cd services/wallet-service
npx prisma migrate dev
npx prisma generate

GET http://localhost:3006/health
```
