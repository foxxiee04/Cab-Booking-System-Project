# RabbitMQ Event Bus — Producers & Consumers

Topic exchange `domain-events` — async communication giữa các service.

```mermaid
graph LR
    subgraph Producers["Producers"]
        BK["booking-service"]
        RD["ride-service"]
        PM["payment-service"]
        WL["wallet-service"]
        AU["auth-service"]
        DV["driver-service"]
    end

    subgraph Exchange["RabbitMQ :5672\ndomain-events (topic exchange)"]
        EX{{"routing\nby key"}}
    end

    subgraph Consumers["Consumers"]
        GW_M["api-gateway\nmatching worker"]
        NT["notification-service"]
        PM2["payment-service\n(saga consumer)"]
        WL2["wallet-service"]
        US["user-service"]
        RD2["ride-service\n(side effects)"]
    end

    BK -->|"booking.confirmed"| EX
    RD -->|"ride.created\nride.completed\nride.cancelled"| EX
    PM -->|"driver.earning.settled\nrefund.completed\nwallet.topup.completed"| EX
    WL -->|"wallet.topup.completed"| EX
    AU -->|"user.registered"| EX
    DV -->|"driver.approved"| EX

    EX -->|"ride.created"| GW_M
    EX -->|"ride.* / booking.*"| NT
    EX -->|"ride.completed"| PM2
    EX -->|"driver.earning.settled\nrefund.completed\nwallet.topup.completed"| WL2
    EX -->|"user.registered"| US
    EX -->|"driver.approved"| RD2
```

## Bảng routing key chính

| Event | Producer | Consumers | Tác dụng |
|-------|----------|-----------|----------|
| `booking.confirmed` | booking | api-gateway, ride | Kích hoạt tạo Ride + matching |
| `ride.created` | ride | api-gateway | Bắt đầu vòng ghép xe |
| `ride.completed` | ride | payment | Tính phí, tạo thanh toán |
| `driver.earning.settled` | payment | wallet | Credit thu nhập tài xế |
| `refund.completed` | payment | wallet | Hoàn tiền vào ví |
| `wallet.topup.completed` | wallet/payment | wallet | Xác nhận nạp tiền |
| `user.registered` | auth | user | Tạo profile người dùng |
| `driver.approved` | driver | ride, notification | Kích hoạt driver profile |
