# Tài liệu Kiến trúc Microservice — Cab Booking System

> Tài liệu kỹ thuật mô tả chi tiết từng microservice trong hệ thống đặt xe trực tuyến.

---

## Danh sách Service

| # | Service | Cổng HTTP | Cổng gRPC | Database | Tài liệu |
|---|---------|-----------|-----------|----------|----------|
| 1 | **API Gateway** | 3000 | — | Redis | [01-api-gateway.md](./01-api-gateway.md) |
| 2 | **Auth Service** | 3001 | 50051 | PostgreSQL (`auth_db`) | [02-auth-service.md](./02-auth-service.md) |
| 3 | **User Service** | 3007 | 50052 | PostgreSQL (`user_db`) | [03-user-service.md](./03-user-service.md) |
| 4 | **Driver Service** | 3003 | 50055 | PostgreSQL (`driver_db`) + Redis | [04-driver-service.md](./04-driver-service.md) |
| 5 | **Ride Service** | 3002 | 50054 | PostgreSQL (`ride_db`) | [05-ride-service.md](./05-ride-service.md) |
| 6 | **Booking Service** | 3008 | 50053 | PostgreSQL (`booking_db`) | [06-booking-service.md](./06-booking-service.md) |
| 7 | **Payment Service** | 3004 | 50056 | PostgreSQL (`payment_db`) | [07-payment-service.md](./07-payment-service.md) |
| 8 | **Wallet Service** | 3006 | — | PostgreSQL (`wallet_db`) | [08-wallet-service.md](./08-wallet-service.md) |
| 9 | **Notification Service** | 3005 | — | MongoDB (`notification_db`) | [09-notification-service.md](./09-notification-service.md) |
| 10 | **Review Service** | 3010 | — | MongoDB (`review_db`) | [10-review-service.md](./10-review-service.md) |
| 11 | **Pricing Service** | 3009 | 50057 | — (Redis cache) | [11-pricing-service.md](./11-pricing-service.md) |
| 12 | **AI Service** | 8000 | — | — (file-based models) | [12-ai-service.md](./12-ai-service.md) |

---

## Kiến trúc tổng quan

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                  │
│        Customer App (:4000)  Driver App (:4001)  Admin (:4002)  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTP / WebSocket
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY (:3000)                         │
│   JWT verify  │  HTTP Proxy  │  Socket.IO Hub  │  Rate Limit    │
│               │  Driver Matching Algorithm       │               │
└──────┬────────┴──────┬───────┴────────┬──────────┴──────────────┘
       │ HTTP           │ gRPC           │ HTTP
       ▼                ▼                ▼
┌──────────┐  ┌──────────────┐  ┌──────────────────────────────┐
│  Auth    │  │   Pricing    │  │   Ride / Booking / Payment   │
│  :3001   │  │   :3009      │  │   Driver / User / Wallet     │
│  PG      │  │   gRPC:50057 │  │   Notification / Review      │
└──────────┘  └──────────────┘  └──────────────────────────────┘
                    │ HTTP                    │ Events
                    ▼                         ▼
              ┌──────────┐          ┌──────────────────┐
              │    AI    │          │    RabbitMQ       │
              │  :8000   │          │  domain-events    │
              └──────────┘          └──────────────────┘
```

## Các Pattern chính

| Pattern | Service áp dụng | Mục đích |
|---------|-----------------|---------|
| **Outbox Pattern** | Payment, Wallet | Đảm bảo at-least-once delivery cho events |
| **State Machine** | Ride Service | Kiểm soát vòng đời chuyến đi |
| **Idempotency Key** | Payment, Wallet | Tránh xử lý trùng callback |
| **FIFO Debt Settlement** | Wallet Service | Tất toán công nợ theo thứ tự |
| **T+24h Hold** | Wallet Service | Giữ thu nhập trước khi rút |
| **Geospatial Index** | Driver + API Gateway | Tìm tài xế gần nhất O(log M) |
| **WebRTC P2P** | Gateway + Client | Cuộc gọi trực tiếp tài xế↔khách |
| **gRPC Bridge** | API Gateway | HTTP→gRPC cho Pricing, Driver |
