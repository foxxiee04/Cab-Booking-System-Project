# Payment Service — Internal Architecture

Bên trong `payment-service:3004` — quản lý thanh toán MoMo / VNPay / cash, voucher engine, idempotency.

```mermaid
graph TB
    GW["api-gateway"]

    subgraph PAY["payment-service :3004"]
        direction TB

        subgraph CTRL["Controllers"]
            PC["PaymentController"]
            VC["VoucherController"]
            EC["EarningsController"]
        end

        subgraph SVC["Domain Services"]
            PAY_SVC["PaymentService<br/>create · markCompleted · refund"]
            VOUCHER_SVC["VoucherEngine<br/>validate · apply · redeem"]
            COMM["CommissionCalculator<br/>per-vehicle rates<br/>(20% · 18% · 15%)"]
            EARN_SVC["EarningsService<br/>computeNet · period rollups"]
        end

        subgraph IDEMP["Idempotency Layer"]
            IK["idempotencyKey check<br/>(per Payment row)"]
            IPN_HANDLER["IPN handler<br/>signature verify · duplicate guard"]
        end

        subgraph PROVIDERS["Payment Provider Adapters"]
            MOMO["MoMo adapter<br/>create · IPN signature HMAC"]
            VNPAY["VNPay adapter<br/>create · IPN HMAC SHA512"]
            CASH["Cash adapter<br/>(driver collects → debt)"]
        end

        GRPC_SRV["gRPC :50056<br/>EstimateCommission<br/>CanAcceptCash"]
    end

    PG[("payment_db<br/>Payment · DriverEarnings ·<br/>Voucher · UserVoucher · DriverWallet")]
    MQ[("RabbitMQ<br/>publish:<br/>payment.completed<br/>refund.completed<br/>driver.earnings.settled<br/>consume:<br/>ride.completed<br/>ride.cancelled")]
    WAL["wallet-service<br/>internal HTTP"]
    NOTIF["notification-service"]
    EXT["MoMo / VNPay<br/>partner webhooks"]

    GW -->|/api/payments/*| PC
    GW -->|/api/voucher/*| VC
    GW -->|/api/payments/driver/earnings| EC

    PC --> PAY_SVC
    PC --> IPN_HANDLER
    VC --> VOUCHER_SVC
    EC --> EARN_SVC

    PAY_SVC --> COMM
    PAY_SVC --> IK
    PAY_SVC --> PROVIDERS

    PROVIDERS <-->|HTTPS| EXT
    EXT -.->|IPN callback| IPN_HANDLER

    PAY_SVC --- PG
    VOUCHER_SVC --- PG
    EARN_SVC --- PG

    PAY_SVC -.->|publish| MQ
    PAY_SVC -.->|consume ride.completed| MQ
    PAY_SVC -->|topup-completed| WAL
    PAY_SVC -.->|notify| NOTIF
```

## Cơ chế quan trọng

- **Idempotency**: Mỗi `Payment` có `idempotencyKey`. IPN từ MoMo/VNPay có thể gọi N lần — handler check key trước khi xử lý.
- **Voucher 2 lớp**: `Voucher` (master catalog) + `UserVoucher` (đã thu thập); `usedCount` tăng atomically khi apply.
- **Commission per vehicle type**: MOTORBIKE/SCOOTER 20%, CAR_4 18%, CAR_7 15%.
- **Cash debt**: Cash ride không phát sinh PAYMENT giữa khách và platform; chỉ debit hoa hồng khỏi ví tài xế.
