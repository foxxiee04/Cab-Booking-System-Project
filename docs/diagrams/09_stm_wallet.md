# State Machine: Driver Wallet (T+24h Settlement)

Ví tài xế áp dụng mô hình fintech T+24h: thu nhập vào `pendingBalance` trước, sau 24h mới chuyển sang `availableBalance`.

```mermaid
stateDiagram-v2
    [*] --> ACTIVE : Tài xế được duyệt\n→ wallet-service tạo WalletAccount

    ACTIVE --> PENDING_SETTLEMENT : Nhận ride.completed event\ncreditEarning() → pendingBalance += netEarnings

    PENDING_SETTLEMENT --> ACTIVE : Cron job sau T+24h\nsettlePendingEarnings()\navailableBalance += N\npendingBalance -= N

    ACTIVE --> LOCKED : Admin compliance hold\n(nghi ngờ gian lận / vi phạm)
    LOCKED --> ACTIVE : Admin release lock

    ACTIVE --> INACTIVE : Tài khoản bị vô hiệu hoá
    INACTIVE --> ACTIVE : Admin reactivate
```

## Cấu trúc số dư ví

```mermaid
graph LR
    subgraph Wallet["WalletAccount"]
        AB["availableBalance\n(có thể rút ngay)"]
        PB["pendingBalance\n(đang giữ T+24h)"]
    end

    EVENT["ride.completed\nnetEarnings"] -->|"creditEarning()"| PB
    PB -->|"T+24h cron\nsettlePendingEarnings()"| AB
    AB -->|"Tài xế rút"| WITHDRAW["Withdrawal\n(ngân hàng / MoMo)"]
```

## Luồng tiền hoa hồng

| Loại xe | commissionRate | Ví dụ fare 100k |
|---------|---------------|-----------------|
| MOTORBIKE / SCOOTER | 20% | platformFee = 20k, netEarnings = 80k |
| CAR_4 | 18% | platformFee = 18k, netEarnings = 82k |
| CAR_7 | 15% | platformFee = 15k, netEarnings = 85k |
