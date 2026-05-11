# State Machine — Payment Lifecycle

Vòng đời `Payment` row trong `payment_db`. Idempotency đảm bảo IPN gọi N lần chỉ chuyển state 1 lần.

```mermaid
stateDiagram-v2
    [*] --> INITIATED : POST /payments/momo/create<br/>(rideId, amount)

    INITIATED --> PENDING : Provider trả payUrl<br/>(MoMo / VNPay accepted)
    INITIATED --> FAILED : Provider error<br/>(network / invalid data)

    PENDING --> COMPLETED : IPN callback<br/>(resultCode=0)<br/>signature verified
    PENDING --> FAILED : IPN callback<br/>(resultCode != 0)<br/>or timeout > 30 min
    PENDING --> CANCELLED : Customer cancel<br/>before paying

    COMPLETED --> REFUNDED : POST /payments/:id/refund<br/>(ride cancelled after pay,<br/>or admin refund)

    FAILED --> [*]
    CANCELLED --> [*]
    REFUNDED --> [*]

    note right of PENDING
        Idempotency key check:
        IPN có thể fire nhiều lần,
        chỉ xử lý lần đầu
    end note

    note right of COMPLETED
        Publish payment.completed
        → wallet, notification consume
    end note

    note right of REFUNDED
        Publish refund.completed
        → wallet credit lại customer
        (online) or release debt (cash)
    end note
```

## Mapping với phương thức thanh toán

| Method | INITIATED | PENDING | COMPLETED | Note |
|--------|-----------|---------|-----------|------|
| **CASH** | (skip) | (skip) | Tự động khi ride.completed | Không có Payment row đến platform; chỉ ghi DriverEarnings + cash debt |
| **MOMO** | `/momo/create` | Đợi user redirect + IPN | IPN resultCode=0 | Có row Payment |
| **VNPAY** | `/vnpay/create` | Đợi user redirect + IPN | IPN responseCode=00 | Có row Payment |
| **WALLET** | (atomic) | (skip) | Trừ balance ngay | Đồng bộ trong 1 transaction |

## Edge cases

- **Double IPN**: `idempotencyKey` unique → INSERT conflict → skip xử lý.
- **IPN trễ**: PENDING quá 30 phút → cron auto-mark FAILED, customer được hoàn tiền nếu đã trừ.
- **Race với cancel**: Customer cancel trong PENDING → state CANCELLED; nếu IPN sau đó tới → idempotency block transition.
