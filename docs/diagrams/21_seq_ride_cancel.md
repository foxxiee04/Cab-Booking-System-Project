# Sequence — Cancel Ride (Customer / Driver)

Hai luồng huỷ chuyến: khách huỷ trước khi tài xế nhận (free) hoặc sau khi nhận (penalty); tài xế huỷ (penalty + acceptance rate giảm).

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    actor D as Driver
    participant GW as api-gateway
    participant Ride as ride-service
    participant Drv as driver-service
    participant Pay as payment-service
    participant Wal as wallet-service
    participant MQ as RabbitMQ
    participant Notif as notification-service

    rect rgb(232, 245, 233)
    Note over C,MQ: Luồng A — Customer huỷ trước khi driver accept (FREE)
    C->>GW: POST /rides/:id/cancel (reason)
    GW->>Ride: forward
    Ride->>Ride: state machine<br/>FINDING_DRIVER → CANCELLED
    Ride-->>MQ: publish ride.cancelled (no penalty)
    MQ->>GW: matcher cancels offer
    MQ-->>Notif: notify offered drivers
    Ride-->>C: { status: CANCELLED }
    end

    rect rgb(255, 243, 224)
    Note over C,Wal: Luồng B — Customer huỷ sau khi driver đã accept (PENALTY)
    C->>GW: POST /rides/:id/cancel
    GW->>Ride: forward
    Ride->>Ride: ACCEPTED → CANCELLED<br/>(elapsed > 5 min → cancelFee)
    Ride-->>MQ: publish ride.cancelled (cancelFee=20000)
    MQ-->>Pay: consume → tạo Payment cancellation fee
    Pay->>Pay: charge customer (online) or<br/>add to driver-side credit (cash)
    MQ-->>Drv: driver.idle
    Drv->>Drv: availabilityStatus = ONLINE (rảnh lại)
    MQ-->>Notif: notify driver
    Ride-->>C: { status: CANCELLED, cancelFee }
    end

    rect rgb(254, 226, 226)
    Note over D,Wal: Luồng C — Driver huỷ sau khi đã accept (PENALTY tài xế)
    D->>GW: POST /rides/:id/driver-cancel (reason)
    GW->>Ride: forward
    Ride->>Drv: notify cancellation
    Drv->>Drv: cancelRate counter++<br/>(score giảm cho dispatch sau)
    Ride->>Ride: state CANCELLED_BY_DRIVER<br/>→ FINDING_DRIVER (retry)
    Ride-->>MQ: publish driver.cancelled
    MQ-->>Wal: consume → DriverWallet.balance -= penaltyFee
    Wal->>Wal: INSERT WalletTransaction<br/>(type=PENALTY, DEBIT)
    MQ->>GW: matcher dispatches lại từ vòng tiếp theo<br/>(rejectedDriverIds += driverId)
    MQ-->>Notif: notify customer "Đang tìm tài xế khác..."
    end
```

## Quy tắc penalty

| Tình huống | Cancel fee | Acceptance/Cancel rate impact |
|-----------|-----------|------------------------------|
| Customer huỷ trước driver accept | 0 đ | Không |
| Customer huỷ ≤ 5 phút sau accept | 0 đ | Không |
| Customer huỷ > 5 phút sau accept | 20.000 đ | Không |
| Driver huỷ sau accept | Penalty 30.000 đ | cancelRate ↑ → score ↓ |
| Driver từ chối popup | 0 đ | acceptRate ↓ → score ↓ |
