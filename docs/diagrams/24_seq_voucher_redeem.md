# Sequence — Voucher Redemption

Customer áp voucher khi đặt xe → hệ thống validate audience/usage limit → trừ giá vào fare → khi ride completed, ghi nhận `MerchantLedger VOUCHER (CHI)` đối với platform.

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant GW as api-gateway
    participant Pay as payment-service
    participant Ride as ride-service
    participant Pric as pricing-service
    participant Wal as wallet-service
    participant DB as payment_db
    participant MQ as RabbitMQ

    C->>GW: GET /voucher (xem danh sách của tôi)
    GW->>Pay: forward
    Pay->>DB: SELECT UserVoucher JOIN Voucher<br/>WHERE userId = C.userId<br/>AND voucher.endTime > NOW()
    DB-->>Pay: vouchers[]
    Pay-->>C: list (code, discount, minFare, conditions)

    Note over C,Pric: Tạo ride với voucher code
    C->>GW: POST /rides<br/>(pickup, dropoff, vehicleType, voucherCode=WEEKEND10)
    GW->>Ride: forward
    Ride->>Pric: gRPC EstimateFare<br/>(distance, duration, vehicleType)
    Pric-->>Ride: { totalFare: 120000 }

    Ride->>Pay: POST /internal/voucher/validate<br/>(code, userId, fare=120000, vehicleType)
    Pay->>DB: SELECT Voucher WHERE code=WEEKEND10
    Pay->>Pay: kiểm tra:<br/>- isActive = true<br/>- startTime ≤ NOW ≤ endTime<br/>- audience match (NEW/RETURNING/ALL)<br/>- minFare ≤ fare<br/>- usageLimit > usedCount<br/>- UserVoucher.usedCount < perUserLimit
    alt Invalid
        Pay-->>Ride: { valid: false, reason }
        Ride-->>C: 400 VOUCHER_INVALID
    end
    Pay->>Pay: tính discount<br/>PERCENT: min(fare × pct/100, maxDiscount)<br/>FIXED: discountValue
    Pay-->>Ride: { valid: true, discount: 12000, finalFare: 108000 }

    Ride->>Ride: tạo Ride row<br/>fare = 108000, voucherCode, voucherDiscount = 12000
    Ride->>Pay: POST /internal/voucher/reserve (rideId, voucherId)
    Pay->>DB: UPDATE Voucher<br/>usedCount++<br/>(reserved, sẽ commit khi ride completed)
    Ride-->>C: { rideId, fare: 108000, savedAmount: 12000 }

    Note over C,MQ: Ride completes
    Ride-->>MQ: publish ride.completed (with voucherDiscount)
    MQ-->>Pay: consume

    Pay->>DB: UPDATE UserVoucher<br/>usedCount++<br/>(commit redemption)
    Pay->>Pay: tạo Payment row<br/>amount = 108000 (already discounted)
    Pay->>Wal: ghi MerchantLedger 2 entry:<br/>1. PAYMENT (IN) 108000<br/>2. VOUCHER (OUT) 12000<br/>(platform absorbs discount)
    Wal->>Wal: merchant_balance.totalIn += 108000<br/>merchant_balance.totalOut += 12000

    rect rgb(254, 226, 226)
    Note over Ride,Pay: Ride cancelled → refund voucher slot
    alt Ride CANCELLED
        Ride-->>MQ: ride.cancelled
        MQ-->>Pay: rollback voucher
        Pay->>DB: UPDATE Voucher usedCount--<br/>UPDATE UserVoucher usedCount--<br/>(nếu chưa commit, chỉ release reserve)
    end
    end
```

## Voucher seed có sẵn (5 mã)

| Code | Audience | Discount | Min fare |
|------|----------|----------|---------|
| `WELCOME20` | NEW | 20% (max 50K) | 0 |
| `FLAT30K` | ALL | flat 30.000đ | 80.000 |
| `NEWUSER50` | NEW | 50% (max 100K) | 0 |
| `WEEKEND10` | ALL | 10% (max 30K) | 0 |
| `OLDUSER15` | RETURNING | 15% (max 40K) | 50.000 |
