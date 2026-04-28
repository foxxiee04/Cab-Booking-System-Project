# Cab Booking System

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose%20%7C%20Swarm-blue)](https://www.docker.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-AI_Service-teal)](https://fastapi.tiangolo.com/)
[![gRPC](https://img.shields.io/badge/gRPC-Internal_RPC-orange)](https://grpc.io/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-Event_Bus-FF6600)](https://www.rabbitmq.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-black)](https://socket.io/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748)](https://www.prisma.io/)

Hệ thống đặt xe công nghệ xây dựng theo kiến trúc microservices, phục vụ ba nhóm người dùng: khách hàng, tài xế và quản trị viên. Hệ thống gồm ba ứng dụng React SPA, mười một microservice Node.js/TypeScript, một AI service FastAPI/Python, hạ tầng dữ liệu đa mô hình (PostgreSQL, MongoDB, Redis, RabbitMQ) và pipeline CI/CD trên GitHub Actions.

Tài liệu này mô tả toàn diện bài toán, mục tiêu thiết kế, kiến trúc hệ thống, các pattern kỹ thuật cốt lõi, luồng nghiệp vụ chi tiết, mô hình dữ liệu, cách triển khai và vận hành.

---

## Mục lục

- [1. Thiết kế kiến trúc hệ thống](#1-thiết-kế-kiến-trúc-hệ-thống)
- [2. Kiến trúc tổng thể](#2-kiến-trúc-tổng-thể)
- [3. Các luồng nghiệp vụ chính](#3-các-luồng-nghiệp-vụ-chính)
- [4. Mô hình dữ liệu và tích hợp](#4-mô-hình-dữ-liệu-và-tích-hợp)
- [5. Cấu trúc thư mục](#5-cấu-trúc-thư-mục)
- [6. Cổng dịch vụ và môi trường chạy](#6-cổng-dịch-vụ-và-môi-trường-chạy)
- [7. Hướng dẫn cài đặt và khởi động](#7-hướng-dẫn-cài-đặt-và-khởi-động)
- [8. Kiểm thử và CI/CD](#8-kiểm-thử-và-cicd)
- [9. Giám sát và vận hành](#9-giám-sát-và-vận-hành)
- [10. Hướng phát triển tiếp theo](#10-hướng-phát-triển-tiếp-theo)

---

## 1. Thiết kế kiến trúc hệ thống

### 1.1 Mục tiêu thiết kế

Hệ thống được xây dựng nhằm cung cấp một ứng dụng đặt xe trực tuyến hoàn chỉnh, tương tự mô hình hoạt động của Grab hoặc Gojek, với trọng tâm là kết nối khách hàng và tài xế theo thời gian thực. Việc lựa chọn kiến trúc microservices xuất phát từ các mục tiêu thiết kế sau:

- **Kết nối nhanh** giữa khách hàng và tài xế gần nhất, sử dụng geospatial indexing và thuật toán scoring đa tiêu chí.
- **Ước lượng chi phí chính xác** dựa trên khoảng cách thực tế (OSRM), thời gian di chuyển và hệ số surge động.
- **Cập nhật trạng thái thời gian thực** qua Socket.IO cho cả khách hàng và tài xế trong suốt vòng đời chuyến đi.
- **Thanh toán đáng tin cậy** tích hợp MoMo và VNPay với idempotency, xử lý IPN callback nhiều lần.
- **Ví tài xế chuẩn fintech** với ký quỹ, giữ thu nhập T+24h, tất toán công nợ FIFO.
- **Tách biệt miền nghiệp vụ** rõ ràng — mỗi service sở hữu database riêng, không phụ thuộc schema chéo.
- **Khả năng mở rộng ngang** thông qua Docker Swarm, Redis Adapter cho Socket.IO cluster.
- **AI tùy chọn** — mọi lời gọi AI đều có timeout 150ms và fallback hoàn chỉnh, hệ thống hoạt động bình thường khi AI không khả dụng.

Nếu toàn bộ hệ thống được xây dựng theo kiến trúc nguyên khối, các vấn đề thường gặp là khó mở rộng, khó cô lập lỗi, khó tối ưu theo từng miền nghiệp vụ và khó triển khai độc lập từng thành phần. Vì vậy, dự án lựa chọn kiến trúc microservices kết hợp ba cơ chế giao tiếp: HTTP đồng bộ, gRPC độ trễ thấp và RabbitMQ bất đồng bộ.

### 1.2 Yêu cầu kỹ thuật

| Hạng mục | Lựa chọn | Lý do |
|---------|---------|-------|
| Frontend | React 18, Redux Toolkit | Quản lý state phức tạp (chuyến đi, ví, realtime) |
| Backend services | Node.js 20, Express.js, TypeScript | Hiệu năng I/O cao, type safety |
| AI service | Python 3.11, FastAPI | Ecosystem ML (scikit-learn, sentence-transformers) |
| Giao tiếp sync | gRPC (protocol buffers) | Độ trễ thấp cho Pricing ↔ Driver lookup |
| Giao tiếp async | RabbitMQ topic exchange | Loose coupling cho ride lifecycle, payment |
| Realtime | Socket.IO + Redis Adapter | Cluster-aware WebSocket broadcast |
| CSDL quan hệ | PostgreSQL 15 (port 5433) | ACID cho tài chính, ride state machine |
| CSDL document | MongoDB | Notification, review — schema linh hoạt |
| Cache & Geo | Redis | `GEOADD`/`GEORADIUS` O(log M) tìm tài xế |
| ORM | Prisma | Migration, type-safe queries cho 7 PostgreSQL DB |
| Xác thực | JWT (HS256) + Refresh Token | Stateless auth, revoke qua DB |
| Triển khai | Docker Compose, Docker Swarm | Local dev → production scaling |
| CI/CD | GitHub Actions | Quality gate: unit → contract → integration → build |

### 1.3 Chức năng chính

#### Khách hàng

- Đăng ký, đăng nhập qua số điện thoại + OTP, đặt lại mật khẩu.
- Xem giá ước tính (có surge, AI-assisted ETA) trước khi xác nhận đặt xe.
- Theo dõi vị trí tài xế trên bản đồ real-time trong suốt chuyến đi.
- Thanh toán tiền mặt, MoMo hoặc VNPay; nhận thông báo xác nhận.
- Chat và gọi điện thoại trực tiếp với tài xế qua WebRTC trong chuyến.
- Xem lịch sử chuyến đi, đánh giá tài xế sau mỗi chuyến.
- Sử dụng voucher/mã giảm giá.
- Trò chuyện với trợ lý AI chatbot hỗ trợ (RAG-based).

#### Tài xế

- Đăng ký, upload hồ sơ phương tiện và bằng lái; chờ quản trị duyệt.
- Bật/tắt trạng thái sẵn sàng nhận chuyến (ONLINE/OFFLINE).
- Nhận offer chuyến đi, xem thông tin khách hàng và điểm đón trên bản đồ.
- Cập nhật trạng thái lần lượt: đến đón → đã đón → hoàn thành.
- Nạp tiền ký quỹ kích hoạt ví; xem số dư, thu nhập, lịch sử giao dịch.
- Yêu cầu rút tiền về tài khoản ngân hàng.
- Chat và gọi điện với khách hàng trong chuyến.

#### Quản trị viên

- Dashboard tổng quan: số chuyến, doanh thu, tài xế hoạt động, người dùng mới.
- Duyệt/từ chối/tạm ngưng hồ sơ tài xế.
- Quản lý ví thương nhân (merchant balance, ledger).
- Duyệt yêu cầu rút tiền của tài xế.
- Xem và ẩn đánh giá vi phạm chính sách.

### 1.4 Phân rã microservices

| Service | Bounded Context | Trách nhiệm |
|---------|----------------|-------------|
| API Gateway | Infrastructure | Entry point, JWT auth, proxy, Socket.IO hub, driver matching |
| Auth Service | Identity | Đăng ký, đăng nhập, OTP, JWT, refresh token |
| User Service | User Profile | Hồ sơ người dùng mở rộng (tên, avatar) |
| Driver Service | Driver Domain | Hồ sơ tài xế, trạng thái, vị trí địa lý |
| Ride Service | Ride Domain | Vòng đời chuyến đi, state machine, chat |
| Booking Service | Booking Domain | Tạo booking, xem giá, chuyển sang ride |
| Payment Service | Payment Domain | Thanh toán, IPN, hoa hồng, voucher |
| Wallet Service | Wallet Domain | Ví tài xế fintech, T+24h, FIFO debt |
| Pricing Service | Pricing Domain | Tính giá, surge, gọi AI |
| Notification Service | Notification | Email, SMS, push — event-driven |
| Review Service | Review Domain | Đánh giá hai chiều, rating |
| AI Service | AI/ML | ETA, surge, accept prob, wait time, RAG chatbot |

---

## 2. Kiến trúc tổng thể

### 2.1 Lớp kiến trúc

Hệ thống được tổ chức thành bốn lớp rõ ràng:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                            │
│    Customer App (:4000)   Driver App (:4001)   Admin (:4002)        │
│              React 18 + Redux Toolkit + Socket.IO client            │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTP + WebSocket
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          GATEWAY LAYER                               │
│                    API Gateway (:3000)                               │
│   JWT Verify  │  HTTP Proxy  │  Rate Limit  │  Address Normalize    │
│   Socket.IO Hub (Redis Adapter)  │  Driver Matching Engine           │
│   RabbitMQ Consumer  │  gRPC Bridge Client                          │
└────┬────────────┬─────────────┬────────────────┬────────────────────┘
     │ HTTP       │ gRPC        │ HTTP           │ WebSocket
     ▼            ▼             ▼                ▼
┌──────────┐  ┌──────────┐  ┌─────────────────────────────────────┐
│  Auth    │  │ Pricing  │  │     BUSINESS SERVICES LAYER          │
│  :3001   │  │  :3009   │  │  Ride  Driver  Booking  Payment      │
│  gRPC    │  │ gRPC:    │  │  Wallet  User  Notification  Review  │
│  :50051  │  │ :50057   │  │  (mỗi service: HTTP + DB riêng)     │
└──────────┘  └─────┬────┘  └─────────────────────────────────────┘
                    │ HTTP (timeout 150ms)
                    ▼
             ┌──────────┐
             │    AI    │
             │  :8000   │ FastAPI/Python
             └──────────┘
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA & INFRA LAYER                            │
│  PostgreSQL:5433  MongoDB:27017  Redis:6379  RabbitMQ:5672          │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Sơ đồ kiến trúc hệ thống (Block Diagram)

```mermaid
graph TB
    subgraph Frontend ["Frontend (React SPAs)"]
        Customer["Customer App\n:4000"]
        Driver["Driver App\n:4001"]
        Admin["Admin Dashboard\n:4002"]
    end

    subgraph Gateway ["Gateway Layer"]
        APIGW["API Gateway :3000\nAuth · Proxy · Socket.IO\nMatching Engine"]
    end

    subgraph BusinessServices ["Business Services"]
        Auth["Auth :3001\ngRPC :50051"]
        User["User :3007\ngRPC :50052"]
        Booking["Booking :3008\ngRPC :50053"]
        Ride["Ride :3002\ngRPC :50054"]
        DriverSvc["Driver :3003\ngRPC :50055"]
        Payment["Payment :3004\ngRPC :50056"]
        Pricing["Pricing :3009\ngRPC :50057"]
        Wallet["Wallet :3006"]
        Notification["Notification :3005"]
        Review["Review :3010"]
    end

    subgraph AILayer ["AI Layer"]
        AI["AI Service :8000\nFastAPI · scikit-learn\nRAG Chatbot"]
    end

    subgraph DataLayer ["Data & Infra"]
        PG[("PostgreSQL :5433\n7 databases")]
        Mongo[("MongoDB :27017\n2 databases")]
        Redis[("Redis :6379\nGeo · Cache · Pub/Sub")]
        Rabbit["RabbitMQ :5672\ndomain-events exchange"]
    end

    Customer & Driver & Admin --> APIGW

    APIGW -- "HTTP proxy" --> Auth & User & Ride & DriverSvc
    APIGW -- "HTTP proxy" --> Booking & Payment & Wallet & Notification & Review
    APIGW -- "gRPC bridge" --> Pricing
    APIGW -- "gRPC" --> DriverSvc

    Pricing -- "HTTP 150ms\nfallback" --> AI

    Auth & User & Ride & DriverSvc --> PG
    Booking & Payment & Wallet --> PG
    Notification --> Mongo
    Review --> Mongo
    DriverSvc & Pricing --> Redis
    APIGW -- "Socket.IO\nRedis Adapter" --> Redis

    Ride & Booking -- "publish" --> Rabbit
    Payment & Wallet -- "publish\n(Outbox)" --> Rabbit
    Rabbit -- "consume" --> APIGW & Notification & Wallet & Review
```

### 2.3 Cơ chế giao tiếp giữa các service

Hệ thống dùng ba cơ chế giao tiếp khác nhau tùy theo yêu cầu về độ trễ và coupling:

#### HTTP Proxy (qua API Gateway)

Tất cả request từ client đi qua API Gateway → proxy đến service tương ứng. Gateway inject ba header xác thực sau khi verify JWT:
```
x-user-id:    <uuid>     # Auth User.id
x-user-role:  CUSTOMER|DRIVER|ADMIN
x-user-email: <email>
```
Downstream services **tin tưởng** các header này mà không re-verify JWT.

#### gRPC (Internal Low-Latency)

Dùng cho các lời gọi đồng bộ yêu cầu độ trễ thấp giữa các service nội bộ:

| Client | gRPC Server | RPC Method | Mục đích |
|--------|-----------|-----------|---------|
| API Gateway | Driver Service :50055 | `GetDriverById` | Lấy thông tin tài xế để hiển thị |
| API Gateway | Pricing Service :50057 | `EstimateFare` | Tính giá (tránh JSON overhead) |
| Booking Service | Pricing Service :50057 | `EstimateFare` | Giá ước tính khi tạo booking |
| Ride Service | Pricing Service :50057 | `EstimateFare` | Giá cuối khi hoàn thành chuyến |
| * | Auth Service :50051 | `ValidateUser` | Xác minh userId nội bộ |

#### RabbitMQ Topic Exchange (`domain-events`)

Dùng cho các luồng bất đồng bộ, loose coupling:

| Publisher | Event Key | Consumers |
|---------|----------|----------|
| Ride Service | `ride.created` | API Gateway (trigger matching) |
| Ride Service | `ride.offered` | API Gateway (Socket.IO → driver) |
| Ride Service | `ride.assigned` | API Gateway, Notification |
| Ride Service | `ride.completed` | **Payment Service** (tính tiền) |
| Ride Service | `ride.cancelled` | Payment (refund), Notification |
| Booking Service | `booking.confirmed` | Ride Service (tạo ride) |
| Payment Service | `payment.completed` | **Wallet Service** (credit ví), Notification |
| Payment Service | `refund.completed` | Wallet Service |
| Wallet Service | `wallet.topup.completed` | Notification |
| Auth Service | `user.registered` | User Service (tạo profile) |
| Driver Service | `driver.approved` | Wallet Service (tạo ví), Notification |
| Review Service | `driver.rating_updated` | Driver Service (cập nhật rating) |

#### Socket.IO Realtime

API Gateway là **Socket.IO hub duy nhất** trong hệ thống. Redis Adapter đảm bảo events được phân phối đúng khi scale ngang:

```
Tài xế / Khách hàng kết nối → authenticate(token) → join room: userId, rideId
Gateway phát events:
  ride:status_update     → cả driver lẫn customer trong rideId room
  ride:driver_location   → customer theo dõi vị trí tài xế
  ride:offer             → driver nhận offer chuyến mới
  call:incoming          → WebRTC incoming call signal
  call:offer/answer/ice  → WebRTC relay P2P negotiation
  ride:chat_message      → tin nhắn chat hai chiều
```

### 2.4 Các pattern kỹ thuật cốt lõi

| Pattern | Service áp dụng | Vấn đề giải quyết |
|---------|----------------|------------------|
| **State Machine** | Ride Service | Kiểm soát chuyển trạng thái hợp lệ cho chuyến đi |
| **Outbox Pattern** | Payment, Wallet | Đảm bảo at-least-once delivery cho events dù RabbitMQ tạm ngắt |
| **Idempotency Key** | Payment | IPN callback gọi nhiều lần → không xử lý trùng |
| **Geospatial Index** | Driver + Gateway | Redis `GEOADD`/`GEORADIUS` — tìm tài xế O(log M) |
| **T+24h Pending Hold** | Wallet Service | Giữ thu nhập trước khi rút, phòng tranh chấp |
| **FIFO Debt Settlement** | Wallet Service | Ưu tiên trả nợ cũ nhất trước khi credit số dư |
| **Security Deposit** | Wallet Service | Ký quỹ 300.000đ bắt buộc để kích hoạt ví |
| **WebRTC P2P** | Gateway + Client | Cuộc gọi thoại trực tiếp tài xế↔khách qua ICE relay |
| **gRPC Bridge** | API Gateway | HTTP→gRPC cho Pricing và Driver lookup |
| **AI Fallback** | Pricing Service | Timeout 150ms → fallback về rule-based surge |
| **Database-per-Service** | Tất cả | Không chia sẻ schema — mỗi service sở hữu database riêng |

### 2.5 Sơ đồ triển khai và vận hành

```mermaid
flowchart LR
    Dev[Developer\npush/PR] --> Git[GitHub Repository]
    Git --> CI[GitHub Actions]

    subgraph QualityGate ["Quality Gate (parallel jobs)"]
        Unit[test-unit\nPostgres + Redis + Mongo + Rabbit]
        Contract[test-contract\nDriver ↔ Ride boundary]
        Integration[test-integration\nDocker-backed full stack]
        AITest[test-ai\npytest FastAPI]
    end

    CI --> QualityGate
    QualityGate --> Build[Build Docker Images\n& Push to Registry]
    Build --> Runtime["Docker Compose (dev)\nDocker Swarm (prod)"]
    Runtime --> Users[Customer · Driver · Admin]
```

### 2.6 Bảng tóm tắt thành phần

| Thành phần | Vai trò chính | Công nghệ |
|-----------|-------------|----------|
| Customer / Driver / Admin App | Giao diện SPA, realtime updates | React 18, Redux Toolkit, Socket.IO |
| API Gateway | Entry point, matching engine, realtime hub | Node.js, Express, Socket.IO, ioredis |
| Auth Service | Đăng ký, đăng nhập, JWT, OTP | Node.js, Prisma, bcryptjs |
| User Service | Hồ sơ người dùng mở rộng | Node.js, Prisma |
| Driver Service | Tài xế, vị trí địa lý, trạng thái | Node.js, Prisma, Redis |
| Ride Service | Vòng đời chuyến đi, state machine, chat | Node.js, Prisma, RabbitMQ |
| Booking Service | Tạo booking, xem giá trước đặt | Node.js, Prisma |
| Payment Service | Thanh toán MoMo/VNPay, IPN, hoa hồng | Node.js, Prisma, Outbox Pattern |
| Wallet Service | Ví tài xế fintech (T+24h, FIFO debt) | Node.js, Prisma |
| Pricing Service | Tính giá, surge, tích hợp AI | Node.js, Redis, gRPC |
| Notification Service | Email, SMS, push — event-driven | Node.js, MongoDB |
| Review Service | Đánh giá hai chiều, rating | Node.js, MongoDB |
| AI Service | ETA/surge ML, accept prob, wait time, RAG chatbot | Python, FastAPI, scikit-learn, FAISS |
| PostgreSQL | CSDL quan hệ — 7 database độc lập | PostgreSQL 15 |
| MongoDB | CSDL document — notification, review | MongoDB 7 |
| Redis | Cache, geospatial, Socket.IO adapter | Redis 7 |
| RabbitMQ | Event bus bất đồng bộ | RabbitMQ 3.13 |

---

## 3. Các luồng nghiệp vụ chính

### 3.1 Luồng đặt xe và ghép tài xế

Đây là luồng phức tạp nhất, phối hợp sáu service và ba cơ chế giao tiếp khác nhau.

```mermaid
sequenceDiagram
    participant C as Customer App
    participant G as API Gateway
    participant B as Booking Service
    participant P as Pricing Service
    participant AI as AI Service
    participant MQ as RabbitMQ
    participant R as Ride Service
    participant D as Driver Service
    participant Redis as Redis Geo Index
    participant DA as Driver App

    C->>G: POST /api/bookings\n{pickup, dropoff, vehicleType}
    G->>B: Forward request
    B->>P: gRPC EstimateFare\n{pickupLat/Lng, dropoffLat/Lng, type}
    P->>AI: POST /api/predict\n{distance_km, time_of_day, day_type}\n[timeout 150ms]
    alt AI available
        AI-->>P: {eta_minutes, price_multiplier, insights}
    else AI timeout / error
        P-->>P: Dùng surge từ Redis hoặc 1.0
    end
    P-->>B: {fare, distance, duration, surge}
    B-->>G: {bookingId, estimatedFare}
    G-->>C: Hiển thị giá ước tính + ETA

    C->>G: POST /api/bookings/:id/confirm
    G->>B: Confirm booking
    B->>MQ: Publish booking.confirmed
    MQ->>R: [Consumer] Tạo Ride mới (status=CREATED)
    R->>MQ: Publish ride.created
    MQ->>G: [Consumer] Kích hoạt matching engine

    loop Vòng matching (tối đa 3 vòng)
        G->>Redis: GEORADIUS drivers:geo:online\nround1: 2km / round2: 3km / round3: 5km
        Redis-->>G: Danh sách driverId gần nhất
        G->>D: gRPC GetDriverById (batch)
        D-->>G: {rating, acceptRate, cancelRate, idleTime}
        Note over G: Score = 0.40×distance + 0.25×rating\n+ 0.15×idleTime + 0.15×acceptRate - 0.05×cancelRate
        G->>R: Cập nhật offeredDriverIds
        R->>MQ: Publish ride.offered
        MQ->>G: [Consumer] Socket.IO → DA
        G-->>DA: Emit ride:offer {rideId, fare, pickup, dropoff}

        alt Tài xế chấp nhận trong 30s
            DA->>G: POST /api/rides/:id/accept
            G->>R: Driver accept
            R->>MQ: Publish ride.assigned
            MQ->>G: Socket.IO → C
            G-->>C: Emit ride:status_update (ASSIGNED)\n+ thông tin tài xế
        else Timeout / từ chối
            Note over G: reassignAttempts++\ndriverId → rejectedDriverIds\nChuyển vòng tiếp theo
        end
    end
```

**Giải thích:**
- API Gateway giữ vai trò **Matching Engine** — không phải Ride Service hay Driver Service.
- Geospatial index trong Redis cho phép tìm tài xế gần nhất với độ phức tạp O(log M) thay vì full table scan.
- Ba vòng bán kính mở rộng (2→3→5 km) đảm bảo tìm được tài xế kể cả khi mật độ thấp.
- AI Service cung cấp `price_multiplier` và `recommended_driver_radius_km` để tinh chỉnh cả giá lẫn chiến lược tìm kiếm.

### 3.2 Thuật toán điều phối tài xế (Driver Matching)

```mermaid
flowchart TD
    Start([ride.created event]) --> R1
    
    subgraph Round1 ["Vòng 1: radius=2km, max=1 tài xế"]
        R1[GEORADIUS 2km\nLấy tài xế online] --> Score1[Tính điểm scoring\nFilter APPROVED + ONLINE]
        Score1 --> Offer1[Gửi offer cho tài xế điểm cao nhất]
        Offer1 --> Wait1{Chờ 30s}
        Wait1 -->|Accept| Assigned([ASSIGNED ✅])
        Wait1 -->|Reject / Timeout| R2
    end
    
    subgraph Round2 ["Vòng 2: radius=3km, max=3 tài xế"]
        R2[GEORADIUS 3km\nLoại rejected IDs] --> Score2[Tính điểm, chọn top 3]
        Score2 --> Offer2[Gửi offer đồng thời 3 tài xế]
        Offer2 --> Wait2{Chờ 30s\nFirst-accept-wins}
        Wait2 -->|Accept| Assigned
        Wait2 -->|All reject / Timeout| R3
    end
    
    subgraph Round3 ["Vòng 3: radius=5km, max=5 tài xế"]
        R3[GEORADIUS 5km\nLoại rejected IDs] --> Score3[Tính điểm, chọn top 5]
        Score3 --> Offer3[Broadcast 5 tài xế]
        Offer3 --> Wait3{Chờ 30s}
        Wait3 -->|Accept| Assigned
        Wait3 -->|All fail| NoDriver([ride.no_driver_found\nThông báo khách hàng ❌])
    end
```

**Công thức tính điểm:**

```
score = 0.40 × (1 − normalizedDistance)  # Khoảng cách: càng gần càng tốt
      + 0.25 × normalizedRating           # Rating trung bình (0–5 sao)
      + 0.15 × normalizedIdleTime         # Thời gian chờ (ưu tiên chờ lâu)
      + 0.15 × acceptanceRate             # Tỷ lệ chấp nhận lịch sử
      − 0.05 × cancelRate                 # Trừ điểm tỷ lệ hủy
```

Nếu `MATCHING_AI_ADJUSTMENT_ENABLED=true`, xác suất chấp nhận từ AI Service điều chỉnh score (timeout 150ms, fallback về score gốc).

### 3.3 Luồng thực hiện chuyến đi (State Machine)

Ride Service enforce toàn bộ chuyển trạng thái qua state machine. Mọi cập nhật status đều phải qua hàm `transition()` — không update trực tiếp field `status`.

```mermaid
stateDiagram-v2
    [*] --> CREATED: customer tạo ride
    CREATED --> FINDING_DRIVER: booking.confirmed
    FINDING_DRIVER --> OFFERED: matching chọn tài xế
    OFFERED --> ASSIGNED: driver accept
    OFFERED --> FINDING_DRIVER: timeout / reject
    ASSIGNED --> ACCEPTED: driver xác nhận
    ACCEPTED --> PICKING_UP: driver báo đang đến
    PICKING_UP --> IN_PROGRESS: driver đón được khách
    IN_PROGRESS --> COMPLETED: driver hoàn thành
    CREATED --> CANCELLED: khách hủy sớm
    FINDING_DRIVER --> CANCELLED: không tìm được tài xế
    OFFERED --> CANCELLED: khách hủy
    ASSIGNED --> CANCELLED: khách / tài xế hủy
    ACCEPTED --> CANCELLED
    PICKING_UP --> CANCELLED
    COMPLETED --> [*]
    CANCELLED --> [*]
```

```mermaid
sequenceDiagram
    participant DA as Driver App
    participant G as API Gateway
    participant R as Ride Service
    participant MQ as RabbitMQ
    participant CA as Customer App

    DA->>G: POST /api/rides/:id/arrived\n(tài xế đến điểm đón)
    G->>R: Transition → PICKING_UP
    R->>MQ: Publish ride.picking_up
    MQ->>G: Socket.IO event
    G-->>CA: Emit ride:status_update (PICKING_UP)

    DA->>G: POST /api/rides/:id/start\n(đã đón được khách)
    G->>R: Transition → IN_PROGRESS
    R->>MQ: Publish ride.started
    G-->>CA: Emit ride:status_update (IN_PROGRESS)

    loop Mỗi ~5 giây (khi IN_PROGRESS)
        DA->>G: PUT /api/driver/me/location {lat, lng}
        G->>Redis: GEOADD drivers:geo:online
        G-->>CA: Emit ride:driver_location {lat, lng}
    end

    DA->>G: POST /api/rides/:id/complete
    G->>R: Transition → COMPLETED
    R->>MQ: Publish ride.completed
    MQ->>G: Socket.IO event
    MQ->>PaymentService: Trigger thanh toán
    G-->>CA: Emit ride:status_update (COMPLETED)
```

### 3.4 Luồng thanh toán — MoMo/VNPay và Idempotency

Đây là luồng fintech phức tạp nhất, đảm bảo thanh toán đúng kể cả khi IPN callback gọi nhiều lần.

```mermaid
sequenceDiagram
    participant R as Ride Service
    participant MQ as RabbitMQ
    participant Pay as Payment Service
    participant DB as payment_db
    participant MoMo as MoMo/VNPay Gateway
    participant Wallet as Wallet Service
    participant N as Notification Service

    R->>MQ: Publish ride.completed {rideId, fare, method}
    MQ->>Pay: [Consumer] Xử lý thanh toán

    Pay->>DB: INSERT Fare {baseFare, distanceFare, timeFare, surge, total}
    
    alt Thanh toán CASH
        Pay->>DB: INSERT Payment {status=COMPLETED, method=CASH, idempotencyKey}
        Pay->>DB: INSERT DriverEarnings {driverCollected=true, cashDebt=platformFee}
        Pay->>DB: INSERT OutboxEvent {type="driver.earnings.settled"}
    else Thanh toán MOMO / VNPAY
        Pay->>DB: INSERT Payment {status=PENDING, idempotencyKey}
        Pay->>MoMo: POST /create-payment-link {orderId, amount, redirectUrl}
        MoMo-->>Pay: {payUrl, orderId}
        Pay-->>Customer: Redirect đến trang thanh toán MoMo/VNPay
        
        MoMo->>Pay: POST /api/payment/momo/ipn\n{orderId, resultCode, amount}\n[Có thể gọi nhiều lần]
        
        alt idempotencyKey chưa xử lý
            Pay->>DB: UPDATE Payment {status=COMPLETED}
            Pay->>DB: INSERT DriverEarnings {driverCollected=false}
            Pay->>DB: INSERT OutboxEvent {type="payment.completed"}
        else idempotencyKey đã tồn tại
            Pay-->>MoMo: 200 OK (bỏ qua, tránh xử lý trùng)
        end
    end

    Note over Pay,DB: Outbox Worker (polling 1s)
    DB->>MQ: Publish payment.completed / driver.earnings.settled
    MQ->>Wallet: Credit ví tài xế (PendingEarning T+24h)
    MQ->>N: Gửi thông báo xác nhận thanh toán
    N-->>Customer: Email + Push notification
```

**Outbox Pattern đảm bảo:** Kể cả khi RabbitMQ tạm thời ngắt kết nối, event không bao giờ mất — OutboxEvent được commit cùng DB transaction, Outbox Worker liên tục retry.

**Hoa hồng nền tảng:**
| Loại xe | Tỷ lệ | Công thức |
|---------|-------|----------|
| CAR_7 | 15% | platformFee = grossFare × 0.15 |
| CAR_4, SCOOTER | 18% | platformFee = grossFare × 0.18 |
| MOTORBIKE | 20% | platformFee = grossFare × 0.20 |

### 3.5 Luồng ví tài xế — Nạp tiền, Thu nhập, Rút tiền

```mermaid
sequenceDiagram
    participant DA as Driver App
    participant G as API Gateway
    participant Pay as Payment Service
    participant MoMo as MoMo Gateway
    participant MQ as RabbitMQ
    participant Wallet as Wallet Service

    Note over DA,Wallet: 1. KÝ QUỸ KÍCH HOẠT VÍ (bắt buộc 1 lần)
    DA->>G: POST /api/wallet/top-up/momo {amount: 300000}
    G->>Pay: Tạo top-up order (MoMo)
    Pay->>MoMo: Tạo link thanh toán
    MoMo-->>DA: Redirect trang MoMo
    DA->>MoMo: Thanh toán thành công
    MoMo->>Pay: IPN callback
    Pay->>MQ: Publish wallet.topup.completed
    MQ->>Wallet: CREDIT 300.000đ\nlockedBalance=300.000đ\nstatus=ACTIVE\ninitialActivationCompleted=true

    Note over DA,Wallet: 2. THU NHẬP SAU CHUYẾN ĐI (T+24h hold)
    MQ->>Wallet: driver.earnings.settled {netEarnings, rideId}
    Wallet->>Wallet: INSERT PendingEarning\n{amount, settleAt = now()+24h}
    Wallet->>Wallet: Nếu CASH ride:\nINSERT DebtRecord {platformFee, dueDate=now()+2d}

    Note over Wallet: 24h sau — Settlement Cron Job
    Wallet->>Wallet: Query PendingEarning WHERE settleAt <= now()
    
    alt Còn debt chưa trả
        Wallet->>Wallet: FIFO: Trả debt cũ nhất trước\nremaining debt -= amount
        Wallet->>Wallet: CREDIT phần còn lại vào availableBalance
    else Không có debt
        Wallet->>Wallet: CREDIT toàn bộ vào availableBalance
    end

    Note over DA,Wallet: 3. RÚT TIỀN VỀ NGÂN HÀNG
    DA->>G: POST /api/wallet/withdraw\n{amount, bankName, accountNumber}
    G->>Wallet: Kiểm tra availableBalance >= amount
    Wallet->>Wallet: INSERT WithdrawalRequest (PENDING)
    Wallet->>Wallet: DEBIT availableBalance

    Note over Wallet: Admin duyệt rút tiền
    Wallet->>Wallet: UPDATE WithdrawalRequest → COMPLETED
    Wallet->>MQ: Publish wallet.withdrawal.completed
```

**Công thức số dư:**
```
availableBalance = balance - lockedBalance - pendingBalance - debt

Ví dụ:
  balance         = 550.000đ
  lockedBalance   = 300.000đ  (ký quỹ cố định)
  pendingBalance  = 100.000đ  (chuyến hôm nay, chờ 24h)
  debt            =  18.000đ  (nợ phí hoa hồng chuyến CASH)
  ──────────────────────────
  availableBalance = 132.000đ (có thể rút)
```

### 3.6 Luồng đăng ký và duyệt tài xế

```mermaid
sequenceDiagram
    participant DA as Driver App
    participant G as API Gateway
    participant Auth as Auth Service
    participant DriverSvc as Driver Service
    participant MQ as RabbitMQ
    participant Wallet as Wallet Service
    participant Admin as Admin Dashboard

    DA->>G: POST /api/auth/register {phone, password, role: DRIVER}
    G->>Auth: Tạo User (role=DRIVER, status=ACTIVE)
    Auth->>MQ: Publish user.registered
    MQ->>UserService: Tạo UserProfile

    DA->>G: POST /api/driver/profile\n{vehicleType, plate, licenseClass,...}
    G->>DriverSvc: INSERT Driver {userId, status=PENDING, vehicleInfo, licenseInfo}

    Note over Admin: Admin xem danh sách PENDING
    Admin->>G: PATCH /api/admin/drivers/:id/approve
    G->>DriverSvc: UPDATE Driver {status=APPROVED, licenseVerified=true}
    DriverSvc->>MQ: Publish driver.approved {driverId, userId}
    MQ->>Wallet: INSERT DriverWallet {driverId, status=INACTIVE}
    MQ->>Notification: Gửi email/SMS chúc mừng tài xế

    Note over DA: Tài xế nạp ký quỹ 300.000đ → ví ACTIVE
    DA->>G: POST /api/driver/me/go-online
    G->>DriverSvc: Kiểm tra canAcceptRide (HTTP internal → Payment Service)
    DriverSvc->>G: OK — UPDATE status=ONLINE
    G->>Redis: GEOADD drivers:geo:online lng lat driverId
```

### 3.7 Chat và gọi điện WebRTC trong chuyến

Khi ride ở trạng thái ASSIGNED→COMPLETED, khách hàng và tài xế có thể chat và gọi điện P2P.

```mermaid
sequenceDiagram
    participant CA as Customer App
    participant G as API Gateway\n(Socket.IO Hub)
    participant DA as Driver App
    participant R as Ride Service

    Note over CA,DA: Chat

    CA->>G: Socket emit: ride:chat_send {rideId, message}
    G->>R: POST /api/rides/:id/chat {message, senderRole=CUSTOMER}
    R->>R: INSERT RideChatMessage
    R-->>G: Saved message
    G-->>DA: Emit ride:chat_message {senderId, message, timestamp}

    Note over CA,DA: Gọi điện WebRTC (P2P qua TURN/ICE)

    CA->>G: Socket emit: call:start {rideId, targetUserId}
    G-->>DA: Emit call:incoming {callerId, rideId}
    DA->>G: Socket emit: call:accept {rideId}
    G-->>CA: Emit call:accepted

    CA->>G: Socket emit: call:offer {rideId, sdp}
    G-->>DA: Relay call:offer {sdp}
    DA->>G: Socket emit: call:answer {rideId, sdp}
    G-->>CA: Relay call:answer {sdp}

    loop ICE Candidate exchange (P2P negotiation)
        CA->>G: call:ice-candidate {candidate}
        G-->>DA: Relay call:ice-candidate
        DA->>G: call:ice-candidate {candidate}
        G-->>CA: Relay call:ice-candidate
    end

    Note over CA,DA: Kết nối P2P thiết lập — Audio truyền trực tiếp\nkhông qua server

    CA->>G: Socket emit: call:end {rideId}
    G-->>DA: Emit call:ended
```

**Đặc điểm WebRTC:** Audio sau khi negotiate sẽ truyền **trực tiếp P2P** giữa hai thiết bị, API Gateway chỉ làm signaling relay. Điều này giảm tải băng thông server đáng kể.

### 3.8 AI tích hợp vào hệ thống

AI Service cung cấp ba model ML và một RAG chatbot, tất cả đều **optional** — có fallback hoàn chỉnh.

```mermaid
sequenceDiagram
    participant C as Customer App
    participant G as API Gateway
    participant P as Pricing Service
    participant AI as AI Service

    Note over P,AI: Model 1: ETA + Price Multiplier
    P->>AI: POST /api/predict\n{distance_km, time_of_day, day_type}\n[timeout: 150ms]
    AI-->>P: {eta_minutes: 24, price_multiplier: 1.12,\ndemand_level: MEDIUM, recommended_radius: 3km}
    
    Note over P: Fallback nếu AI timeout:
    Note over P: Dùng surge từ Redis hoặc 1.0

    Note over G,AI: Model 2: Accept Probability (trong Matching Engine)
    G->>AI: POST /api/predict/accept/batch\n{context: {fare, surge, zone, demand},\ndrivers: [{eta, acceptRate, cancelRate},...]}
    AI-->>G: {results: [{p_accept: 0.82}, {p_accept: 0.61},...]}
    
    Note over G: Điều chỉnh điểm matching:\nscore × p_accept_clamped

    Note over P,AI: Model 3: Wait Time Prediction
    P->>AI: POST /api/predict/wait-time\n{demand_level, avail_drivers, hour, surge}
    AI-->>P: {wait_time_minutes: 4.2, confidence: 0.86}

    Note over C,AI: RAG Chatbot (AI Customer Support)
    C->>G: POST /api/ai/chat\n{"Giá xe 4 chỗ bao nhiêu?"}
    G->>AI: Forward to /api/chat
    AI->>AI: Encode query → FAISS search\n→ Retrieve top-k chunks từ knowledge base\n→ [optional] Generate via LLM (Groq/OpenAI)
    AI-->>G: {answer: "Xe 4 chỗ: 24.000đ + 15.000đ/km...", sources: [...]}
    G-->>C: Response chatbot
```

**Ba model AI:**

| Model | Algorithm | Input | Output |
|-------|----------|-------|--------|
| ETA & Surge | Random Forest (multi-output) | distance, time, day | eta_minutes, price_multiplier |
| Accept Probability | Gradient Boosting Classifier | 15 features: eta, fare, zone, demand, driver stats | P(accept) per driver |
| Wait Time | Gradient Boosting Regressor (Huber) | 12 features: demand, supply, hour, accept_rate | wait_time_minutes [1–15] |
| RAG Chatbot | Sentence-Transformer + FAISS | User question (Vietnamese/English) | Contextual answer từ knowledge base |

### 3.9 Luồng đánh giá sau chuyến

```mermaid
sequenceDiagram
    participant CA as Customer App
    participant G as API Gateway
    participant Rev as Review Service
    participant MQ as RabbitMQ
    participant DriverSvc as Driver Service

    Note over CA,Rev: Cửa sổ đánh giá: 24h sau khi ride.completed

    CA->>G: POST /api/reviews\n{rideId, type: CUSTOMER_TO_DRIVER,\nrating: 5, comment, tags}
    G->>Rev: Kiểm tra: rideId hợp lệ, chưa review, trong cửa sổ 24h
    Rev->>Rev: INSERT review document
    Rev->>MQ: Publish driver.rating_updated {driverId, newAvg}
    MQ->>DriverSvc: UPDATE ratingAverage, ratingCount

    Note over DA,Rev: Tài xế đánh giá khách hàng (tùy chọn)
    DA->>G: POST /api/reviews\n{rideId, type: DRIVER_TO_CUSTOMER, rating: 4}
    G->>Rev: INSERT review
```

---

## 4. Mô hình dữ liệu và tích hợp

### 4.1 Phân tách database

Nguyên tắc **Database-per-Service** được áp dụng toàn bộ: không service nào ghi trực tiếp vào schema của service khác. Tích hợp chỉ xảy ra qua REST API, gRPC hoặc RabbitMQ events.

| DBMS | Database | Service | Schema cốt lõi |
|------|---------|---------|---------------|
| PostgreSQL | `auth_db` | Auth Service | User, RefreshToken, OtpRecord, AuditLog |
| PostgreSQL | `user_db` | User Service | UserProfile |
| PostgreSQL | `driver_db` | Driver Service | Driver (với vehicle, license, location) |
| PostgreSQL | `ride_db` | Ride Service | Ride, RideStateTransition, RideChatMessage |
| PostgreSQL | `booking_db` | Booking Service | Booking |
| PostgreSQL | `payment_db` | Payment Service | Fare, Payment, DriverEarnings, Voucher, OutboxEvent |
| PostgreSQL | `wallet_db` | Wallet Service | DriverWallet, PendingEarning, DebtRecord, WalletTransaction, MerchantLedger, MerchantBalance |
| MongoDB | `notification_db` | Notification Service | notifications, notification_templates |
| MongoDB | `review_db` | Review Service | reviews |

> PostgreSQL dùng port **5433** (không phải 5432 mặc định) để tránh xung đột khi cài local. Tất cả 7 PostgreSQL database chạy trong cùng một container.

### 4.2 Các thành phần frontend

| Ứng dụng | Vai trò | Port |
|---------|---------|------|
| Customer App | Đặt xe, theo dõi chuyến, thanh toán, đánh giá, AI chatbot | 4000 |
| Driver App | Nhận chuyến, cập nhật trạng thái, quản lý ví | 4001 |
| Admin Dashboard | Quản lý tài xế, vận hành, ví thương nhân | 4002 |

### 4.3 Các thành phần backend

| Service | Trách nhiệm | DB | HTTP | gRPC |
|---------|------------|-----|------|------|
| API Gateway | Entry point, matching, realtime | Redis | 3000 | — |
| Auth Service | Xác thực, JWT | auth_db | 3001 | 50051 |
| User Service | Hồ sơ người dùng | user_db | 3007 | 50052 |
| Booking Service | Tạo booking, xem giá | booking_db | 3008 | 50053 |
| Ride Service | State machine chuyến đi | ride_db | 3002 | 50054 |
| Driver Service | Tài xế, vị trí, geo | driver_db | 3003 | 50055 |
| Payment Service | Thanh toán, hoa hồng | payment_db | 3004 | 50056 |
| Pricing Service | Tính giá, surge, AI | Redis | 3009 | 50057 |
| Wallet Service | Ví tài xế fintech | wallet_db | 3006 | — |
| Notification Service | Email, SMS, push | notification_db | 3005 | — |
| Review Service | Đánh giá hai chiều | review_db | 3010 | — |
| AI Service | ML inference, RAG | File models | 8000 | — |

### 4.4 Hạ tầng dữ liệu

| Thành phần | Mục đích |
|-----------|---------|
| PostgreSQL :5433 | CSDL giao dịch cho 7 service (ACID) |
| MongoDB :27017 | Notification và review (document-based) |
| Redis :6379 | Geospatial index tài xế, surge cache, Socket.IO adapter, OTP TTL |
| RabbitMQ :5672 | `domain-events` topic exchange cho async events |

### 4.5 Các kiểu tích hợp giữa service

| Cơ chế | Khi nào dùng | Ví dụ |
|--------|-------------|-------|
| **HTTP proxy** (qua Gateway) | Request/response từ client | Mọi API call từ app |
| **gRPC** (internal) | Sync, low-latency, structured data | Pricing ↔ Gateway, Driver lookup |
| **RabbitMQ** (async) | Loose coupling, at-least-once | Ride lifecycle events, payment events |
| **Redis pub/sub** | Socket.IO cluster sync | Broadcast realtime event qua nhiều Gateway instance |
| **HTTP internal** (x-internal-token) | Service-to-service check | Driver canAcceptRide → Payment |
| **WebSocket** (Socket.IO) | Realtime push đến client | Vị trí tài xế, trạng thái chuyến, chat |

---

## 5. Cấu trúc thư mục

```text
Cab-Booking-System-Project/
├── apps/
│   ├── customer-app/          # React SPA — khách hàng (port 4000)
│   ├── driver-app/            # React SPA — tài xế (port 4001)
│   └── admin-dashboard/       # React SPA — quản trị (port 4002)
│
├── services/
│   ├── api-gateway/           # HTTP 3000 — entry point, matching, Socket.IO
│   ├── auth-service/          # HTTP 3001, gRPC 50051 — JWT, OTP
│   ├── user-service/          # HTTP 3007, gRPC 50052 — hồ sơ user
│   ├── booking-service/       # HTTP 3008, gRPC 50053 — booking
│   ├── ride-service/          # HTTP 3002, gRPC 50054 — state machine
│   ├── driver-service/        # HTTP 3003, gRPC 50055 — tài xế + geo
│   ├── payment-service/       # HTTP 3004, gRPC 50056 — MoMo/VNPay
│   ├── pricing-service/       # HTTP 3009, gRPC 50057 — tính giá
│   ├── wallet-service/        # HTTP 3006 — ví tài xế fintech
│   ├── notification-service/  # HTTP 3005 — email/SMS/push
│   ├── review-service/        # HTTP 3010 — đánh giá
│   └── ai-service/            # HTTP 8000 — FastAPI, ML, RAG
│       ├── app/
│       │   ├── api/           # FastAPI routes
│       │   ├── models/        # *.joblib trained models
│       │   ├── services/      # prediction_service, rag_service
│       │   └── data/knowledge/# Knowledge base files cho RAG
│       └── training/          # Scripts train model
│
├── shared/                    # Package dùng chung (@cab/shared)
│   ├── types/                 # TypeScript interfaces, enums
│   ├── grpc/                  # Protobuf definitions
│   └── utils/                 # Internal auth, request-context
│
├── docs/
│   ├── services/              # Tài liệu chi tiết từng service (12 files)
│   ├── bao-cao-kltn.md        # Báo cáo luận văn
│   └── luongthanhtoan.md      # Mô tả luồng thanh toán
│
├── scripts/
│   ├── reset-database.sh      # Reset toàn bộ DB + migrate + seed (Linux/Mac)
│   ├── reset-database.bat     # Reset toàn bộ DB + migrate + seed (Windows)
│   ├── seed-database.ts       # Seed dữ liệu mẫu cho toàn hệ thống
│   └── test-ai.mjs            # Test suite cho AI service
│
├── monitoring/                # Prometheus, Loki, Grafana configs
│   ├── prometheus.yml
│   └── loki-config.yml
│
├── .github/
│   ├── workflows/ci-cd.yml    # Pipeline CI/CD chính
│   └── docker/docker-compose.integration.yml
│
├── docker-compose.yml         # Local dev stack
├── docker-compose.prod.yml    # Production-oriented
├── docker-stack.yml           # Docker Swarm deployment
└── package.json               # Workspace root (npm workspaces)
```

**Ý nghĩa các thư mục:**
- `apps/` — Ba ứng dụng React độc lập, build riêng lẻ.
- `services/` — Mười một microservice Node.js và một AI service Python. Mỗi service là npm workspace riêng với `package.json`, `Dockerfile`, Prisma schema và migrations riêng.
- `shared/` — Package TypeScript dùng chung: types, gRPC proto files, internal auth helpers. Build trước khi build các service khác.
- `scripts/` — Automation: reset database, seed data, integration test runner.
- `monitoring/` — Stack giám sát (Prometheus, Grafana, Loki, Promtail, cAdvisor, Node Exporter).
- `.github/workflows/` — Pipeline CI/CD: test → build → push Docker image.

---

## 6. Cổng dịch vụ và môi trường chạy

### 6.1 Backend services

| Service | HTTP Port | gRPC Port | Database |
|---------|-----------|-----------|----------|
| API Gateway | **3000** | — | Redis |
| Auth Service | 3001 | **50051** | `auth_db` |
| Ride Service | 3002 | **50054** | `ride_db` |
| Driver Service | 3003 | **50055** | `driver_db` + Redis |
| Payment Service | 3004 | **50056** | `payment_db` |
| Notification Service | 3005 | — | `notification_db` |
| Wallet Service | 3006 | — | `wallet_db` |
| User Service | 3007 | **50052** | `user_db` |
| Booking Service | 3008 | **50053** | `booking_db` |
| Pricing Service | 3009 | **50057** | Redis (stateless) |
| Review Service | 3010 | — | `review_db` |
| AI Service | **8000** | — | File models |

### 6.2 Hạ tầng

| Thành phần | Port | Ghi chú |
|-----------|------|---------|
| PostgreSQL | **5433** | Container port 5432; tất cả 7 DB cùng instance |
| MongoDB | 27017 | Auth source: `admin` |
| Redis | 6379 | Geospatial, cache, Socket.IO adapter |
| RabbitMQ AMQP | 5672 | `domain-events` topic exchange |
| RabbitMQ Management UI | 15672 | `http://localhost:15672` |
| RabbitMQ Prometheus | 15692 | Metrics scrape |

### 6.3 Frontend apps (dev)

| App | Port |
|-----|------|
| Customer App | 4000 |
| Driver App | 4001 |
| Admin Dashboard | 4002 |

### 6.4 Monitoring (profile tùy chọn)

| Thành phần | Port |
|-----------|------|
| Prometheus | 9090 |
| Grafana | 3006 |
| Loki | 3100 |
| cAdvisor | 8081 |
| Node Exporter | 9100 |

### 6.5 Các file Docker Compose

| File | Mục đích |
|------|---------|
| `docker-compose.yml` | Chạy local/dev — build từ source code |
| `docker-compose.prod.yml` | Production — dùng image đã push lên registry |
| `.github/docker/docker-compose.integration.yml` | Hạ tầng cho integration tests trong CI |
| `docker-stack.yml` | Triển khai Docker Swarm (multi-node) |

---

## 7. Hướng dẫn cài đặt và khởi động

### 7.1 Yêu cầu môi trường

| Công cụ | Phiên bản | Ghi chú |
|---------|----------|---------|
| Docker | 24+ | Bắt buộc |
| Docker Compose | v2+ | Bắt buộc |
| Node.js | 20.x | Chỉ cần khi chạy service ngoài Docker |
| Python | 3.11 | Chỉ cần khi chạy AI service ngoài Docker |
| Git | — | |

### 7.2 Khởi động toàn bộ hệ thống bằng Docker

```bash
git clone <repository-url>
cd Cab-Booking-System-Project

# Cấu hình biến môi trường (copy từ mẫu)
cp .env.example .env
# Chỉnh sửa .env theo môi trường thực tế

# Build và khởi động
docker compose build
docker compose up -d

# Xem trạng thái
docker compose ps

# Kiểm tra health
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

### 7.3 Khởi động từng service riêng (development hot-reload)

```bash
# Build shared package trước (bắt buộc)
npm run build:shared

# Khởi động từng service
npm run dev:gateway       # API Gateway :3000
npm run dev:auth          # Auth Service :3001
npm run dev:ride          # Ride Service :3002
npm run dev:driver        # Driver Service :3003
npm run dev:payment       # Payment Service :3004
npm run dev:notification  # Notification Service :3005
npm run dev:wallet        # Wallet Service :3006
npm run dev:user          # User Service :3007
npm run dev:booking       # Booking Service :3008
npm run dev:pricing       # Pricing Service :3009
npm run dev:review        # Review Service :3010

# Frontend apps
npm run dev:customer      # Customer App :4000
npm run dev:driver-app    # Driver App :4001
npm run dev:admin         # Admin Dashboard :4002
npm run dev:frontends     # Tất cả frontend cùng lúc
```

### 7.4 Reset và seed dữ liệu

```bash
# Windows (PowerShell hoặc CMD)
scripts\reset-database.bat

# Linux / macOS / WSL
bash scripts/reset-database.sh

# Chỉ seed dữ liệu (sau khi DB đã tồn tại)
npm run db:seed
```

Script reset thực hiện theo thứ tự:
1. Drop và recreate toàn bộ PostgreSQL databases (7 databases bao gồm `wallet_db`)
2. Drop MongoDB databases (`notification_db`, `review_db`)
3. Chạy Prisma migration cho tất cả 7 service (bao gồm `wallet-service`)
4. Seed dữ liệu mẫu: 1 admin, 20 khách hàng, 40 tài xế, 10 bookings, 28 chuyến đi, vouchers

### 7.5 Xem OTP trong development

```bash
# OTP được print ra stdout (không gửi SMS thật)
docker logs cab-auth-service 2>&1 | grep OTP
```

### 7.6 Kết nối database trực tiếp

```
PostgreSQL:  postgresql://postgres:postgres@localhost:5433/<db_name>
MongoDB:     mongodb://mongo:mongo@localhost:27017/?authSource=admin
Redis:       redis://localhost:6379
RabbitMQ UI: http://localhost:15672  (guest/guest)
```

### 7.7 Prisma — Tạo migration mới cho một service

```bash
cd services/<service-name>
npx prisma migrate dev --name <tên_migration>
npx prisma generate        # Tái tạo Prisma Client
```

> **Lưu ý build context**: Các service `api-gateway`, `auth-service`, `driver-service`, `ride-service`, `pricing-service` cần build từ **root directory** (vì phụ thuộc `shared/`). Các service còn lại build từ thư mục service.

---

## 8. Kiểm thử và CI/CD

### 8.1 Các mức kiểm thử

| Nhóm | Lệnh | Mô tả |
|------|------|-------|
| Unit tests | `npm run test:unit` | Kiểm thử logic từng service (có mock DB) |
| Contract tests | `npm run test:contract` | Kiểm tra tương thích API boundary giữa Driver ↔ Ride |
| Integration tests | `npm run test:integration` | Full stack với PostgreSQL/MongoDB/Redis/RabbitMQ thật |
| Coverage | `npm run test:coverage` | Báo cáo coverage toàn bộ workspace |
| AI tests | `cd services/ai-service && pytest -q` | Test FastAPI endpoints và ML inference |
| AI test script | `node scripts/test-ai.mjs` | Test toàn bộ AI API: 33 test cases |
| Smoke tests | `npm run smoke:gateway` | Kiểm tra nhanh API Gateway khi stack đang chạy |

### 8.2 Pipeline CI/CD (GitHub Actions)

```mermaid
flowchart TD
    Push[Push / Pull Request] --> Install[Install Dependencies\nnpm ci + pip install]
    Install --> Shared[Build Shared Package\n@cab/shared]

    Shared --> Unit[Job: test-unit\nServices: Postgres + Mongo + Redis + Rabbit]
    Shared --> Contract[Job: test-contract\nDriver ↔ Ride Service boundary]
    Shared --> Integration[Job: test-integration\nDocker Compose full stack]
    Shared --> AI[Job: test-ai\npytest -q services/ai-service]

    Unit & Contract & Integration & AI --> Gate{Quality Gate\n4 jobs must pass}

    Gate -->|PR| Stop[No deploy on PR]
    Gate -->|non-PR branch| Build[Build Docker Images\ndocker buildx]
    Build --> Push2[Push to Docker Hub\n<registry>/<service>:<sha>]
    Push2 --> Deploy[Deploy to Docker Swarm\ndocker stack deploy]
```

**Chi tiết các job:**

- **test-unit**: Chạy với GitHub Actions Services (PostgreSQL, MongoDB, Redis, RabbitMQ). Build shared package trước, sau đó `npm run test:unit --runInBand`.
- **test-contract**: Kiểm tra tính tương thích API giữa các service có boundary quan trọng (Driver ↔ Ride).
- **test-integration**: Khởi động hạ tầng tích hợp qua file compose riêng trong `.github/docker/`, build backend artifacts, chạy integration test suite.
- **test-ai**: Cài Python dependencies, chạy `pytest -q` trong `services/ai-service`.
- **docker-build-and-push**: Chỉ chạy trên nhánh không phải PR, sau khi toàn bộ quality gate pass. Build và push Docker image của từng service với tag là commit SHA.

### 8.3 Chạy integration test tại local

```bash
# Khởi động hạ tầng tích hợp
docker compose -f .github/docker/docker-compose.integration.yml up -d

# Chạy integration tests
npm run test:integration

# Dọn dẹp
docker compose -f .github/docker/docker-compose.integration.yml down
```

---

## 9. Giám sát và vận hành

### 9.1 Stack monitoring

| Công cụ | Vai trò | Port |
|---------|---------|------|
| Prometheus | Thu thập metrics từ các service và infra | 9090 |
| Grafana | Dashboard quan sát metrics và logs | 3006 |
| Loki | Tập trung logs từ toàn bộ containers | 3100 |
| Promtail | Forward logs từ Docker containers → Loki | — |
| cAdvisor | Metrics tài nguyên CPU/Memory theo container | 8081 |
| Node Exporter | Metrics tài nguyên host (disk, network, CPU) | 9100 |

API Gateway expose `/metrics` endpoint (Prometheus format) gồm: request count, response time histogram, active WebSocket connections, matching queue length.

### 9.2 Bật monitoring

```bash
# Khởi động với monitoring profile
docker compose --profile monitoring up -d \
  prometheus grafana loki promtail cadvisor node-exporter

# Truy cập
open http://localhost:9090   # Prometheus
open http://localhost:3006   # Grafana (admin/admin)
open http://localhost:3100   # Loki
```

### 9.3 Health checks và readiness

```bash
# Tổng quan health của API Gateway
GET http://localhost:3000/health
# → {"status":"healthy","service":"api-gateway","timestamp":"..."}

# Kiểm tra tất cả downstream services
GET http://localhost:3000/ready
# → {"ready": true, "checks": {"auth": "ok", "ride": "ok", ...}}

# Health từng service
GET http://localhost:300{1-9}/health

# AI service health + model status
GET http://localhost:8000/health
GET http://localhost:8000/api/stats
# → {"model_loaded": true, "rag_ready": true, "accept_model_loaded": true}
```

### 9.4 Xem logs

```bash
# Logs real-time của tất cả service
docker compose logs -f

# Logs service cụ thể
docker compose logs -f api-gateway
docker compose logs -f ride-service

# Xem OTP (chỉ dev)
docker logs cab-auth-service 2>&1 | grep OTP

# Xem RabbitMQ queue
open http://localhost:15672  # Management UI
```

---

## 10. Hướng phát triển tiếp theo

### Kỹ thuật

- **Distributed Tracing**: Tích hợp OpenTelemetry để trace request xuyên suốt qua các service (hiện chỉ có correlation ID cơ bản).
- **Circuit Breaker**: Thêm Resilience4j/opossum để tránh cascade failure khi một service chậm.
- **Event Sourcing**: Ride Service hiện có `RideStateTransition` — có thể nâng lên event sourcing hoàn chỉnh cho audit và time-travel debug.
- **gRPC Streaming**: Cập nhật vị trí tài xế hiện qua WebSocket; gRPC bidirectional streaming có thể giảm overhead.
- **AI Retraining Pipeline**: Hiện dùng synthetic data; tích hợp MLflow để train lại định kỳ từ dữ liệu thực.

### Nghiệp vụ

- **Đặt xe trước (Scheduled Ride)**: Booking Service đã có `expiresAt` — có thể mở rộng cho đặt xe theo giờ hẹn.
- **Đa tài xế (Pooling)**: Chia sẻ chuyến đi nhiều khách cùng lộ trình.
- **Payment Provider thực**: Hiện đã tích hợp MoMo và VNPay qua IPN; cần cấu hình merchant account thật.
- **Chương trình thưởng**: IncentiveRule đã có schema — cần thêm UI admin và cron tính thưởng.
- **Rating nâng cao**: Phân tích sentiment từ comment; gắn cờ review vi phạm tự động.

### Vận hành

- **Kubernetes**: Chuyển từ Docker Swarm sang K8s cho production-grade orchestration.
- **Secret Management**: Tích hợp HashiCorp Vault hoặc AWS Secrets Manager thay vì `.env` files.
- **Multi-Region**: Redis Cluster, PostgreSQL replication, RabbitMQ Federation.
- **TLS Termination**: Nginx/Traefik reverse proxy với Let's Encrypt trước API Gateway.

---

## Kết luận

Cab Booking System giải quyết đồng thời ba lớp bài toán kỹ thuật điển hình trong hệ thống giao thông số quy mô lớn:

**Lớp real-time** — Socket.IO hub với Redis Adapter xử lý broadcast trạng thái chuyến đi, vị trí tài xế và WebRTC signaling với độ trễ thấp; gRPC đảm bảo lookup tài xế và tính giá sub-10ms.

**Lớp orchestration** — State machine enforce 9 trạng thái hợp lệ cho vòng đời chuyến đi; thuật toán matching 3 vòng bán kính với scoring đa tiêu chí và điều chỉnh AI tùy chọn; RabbitMQ Outbox Pattern đảm bảo không mất event kể cả khi broker tạm ngắt.

**Lớp fintech** — Ví tài xế với ký quỹ bắt buộc, giữ thu nhập T+24h, tất toán công nợ FIFO, sổ cái thương nhân song song; idempotency key chống xử lý trùng IPN callback từ MoMo và VNPay.

Mười hai service được phân rã theo Bounded Context của Domain-Driven Design — mỗi service sở hữu database riêng, giao tiếp qua hợp đồng rõ ràng, triển khai và scale độc lập. AI Service là optional hoàn toàn; hệ thống hoạt động bình thường khi không có AI nhờ fallback ở mọi điểm tích hợp.

Tài liệu chi tiết từng service: [`docs/services/`](docs/services/README.md)
