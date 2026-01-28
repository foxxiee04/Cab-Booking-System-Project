<div align="center">

# 🚖 CAB BOOKING SYSTEM
### Hệ Thống Đặt Xe Taxi Trực Tuyến

[![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Docker](https://img.shields.io/badge/Docker-24.0-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3.12-FF6600?style=for-the-badge&logo=rabbitmq&logoColor=white)](https://www.rabbitmq.com/)

**Ứng dụng đặt xe theo mô hình Microservices với khả năng mở rộng cao**

[Tính năng](#-tính-năng-chính) • [Kiến trúc](#️-kiến-trúc-hệ-thống) • [Cài đặt](#-cài-đặt-nhanh) • [API Docs](#-api-endpoints) • [Sơ đồ luồng](#-các-luồng-hoạt-động-chính)

</div>

---

## 📋 Mục lục

- [🎯 Tổng quan hệ thống](#-tổng-quan-hệ-thống)
- [✨ Tính năng chính](#-tính-năng-chính)
- [🏗️ Kiến trúc hệ thống](#️-kiến-trúc-hệ-thống)
- [🛠️ Công nghệ sử dụng](#️-công-nghệ-sử-dụng)
- [🔄 Các luồng hoạt động chính](#-các-luồng-hoạt-động-chính)
- [🚀 Cài đặt nhanh](#-cài-đặt-nhanh)
- [📡 API Endpoints](#-api-endpoints)
- [💾 Database Schema](#-database-schema)
- [🧪 Testing](#-testing)
- [📊 Monitoring](#-monitoring)
- [📞 Liên hệ](#-liên-hệ)

---

## 🎯 Tổng quan hệ thống

**Cab Booking System** là nền tảng đặt xe trực tuyến được xây dựng trên kiến trúc **Microservices**, kết nối khách hàng với tài xế taxi theo thời gian thực. Hệ thống được thiết kế để xử lý hàng ngàn yêu cầu đồng thời với độ trễ thấp.

### 🎯 Mục tiêu dự án

| Mục tiêu | Mô tả |
|----------|-------|
| **📱 Trải nghiệm người dùng** | Giao diện trực quan, đặt xe nhanh chóng trong < 30 giây |
| **⚡ Hiệu suất cao** | Xử lý 1000+ requests/giây với độ trễ < 200ms |
| **🔒 Bảo mật** | JWT authentication, mã hóa dữ liệu nhạy cảm |
| **🚀 Khả năng mở rộng** | Scale độc lập từng service theo nhu cầu |
| **📊 Giám sát** | Real-time monitoring với Prometheus & Grafana |

### 💡 Điểm nổi bật

```
✨ Realtime Tracking       → Theo dõi vị trí tài xế với độ chính xác cao
🗺️ Google Maps Integration → Định vị, tính toán tuyến đường tối ưu
💰 Dynamic Pricing         → Giá linh hoạt theo cung cầu (surge pricing)
🔔 Push Notifications      → Thông báo tức thời qua Socket.IO
💳 Multi-Payment           → Tiền mặt, Thẻ ngân hàng, Ví điện tử
⭐ Rating System           → Đánh giá 2 chiều (khách ↔ tài xế)
🤖 AI Matching             → Thuật toán tìm tài xế tối ưu
📊 Analytics Dashboard     → Thống kê chi tiết cho admin
```

---

## ✨ Tính năng chính

<table>
<tr>
<td width="33%" valign="top">

### 👥 Khách hàng

- ✅ Đăng ký/Đăng nhập
- 🗺️ Chọn điểm đón/đến trên bản đồ
- 🚗 3 loại xe (Economy/Comfort/Premium)
- 💰 Xem giá ước tính trước
- 📍 Tracking tài xế realtime
- 💳 Đa phương thức thanh toán
- ⭐ Đánh giá tài xế
- 📜 Lịch sử chuyến đi
- 🎫 Mã giảm giá

</td>
<td width="33%" valign="top">

### 🚖 Tài xế

- 📝 Đăng ký với GPLX
- ✅ Xét duyệt hồ sơ
- 🟢 Bật/tắt trạng thái online
- 🔔 Nhận thông báo chuyến mới
- 📍 GPS tracking tự động
- 🗺️ Dẫn đường đến khách
- 💵 Theo dõi thu nhập
- ⭐ Xem rating cá nhân
- 📊 Báo cáo hàng ngày

</td>
<td width="33%" valign="top">

### 👨‍💼 Admin

- 👥 Quản lý user/driver
- ✅ Duyệt tài xế mới
- 📊 Dashboard thống kê
- 🗺️ Giám sát realtime
- 💰 Cấu hình bảng giá
- 🔥 Thiết lập surge pricing
- 📈 Báo cáo doanh thu
- 🚫 Khóa/mở khóa tài khoản
- 🛠️ Quản lý hệ thống

</td>
</tr>
</table>

---

## 🏗️ Kiến trúc hệ thống

### 📐 Sơ đồ kiến trúc tổng quan

```mermaid
graph TB
    subgraph Client["🌐 CLIENT LAYER"]
        CA["📱 Customer App<br/>(Next.js)<br/>:4000"]
        DA["🚗 Driver App<br/>(Next.js)<br/>:4001"]
        AA["👨‍💼 Admin Dashboard<br/>(Next.js)<br/>:4002"]
    end

    subgraph Gateway["🚪 API GATEWAY LAYER"]
        GW["API Gateway<br/>Express.js<br/>:3000<br/>━━━━━━━━━<br/>✓ Authentication<br/>✓ Rate Limiting<br/>✓ Load Balancing"]
    end

    subgraph Core["🎯 CORE SERVICES"]
        AS["🔐 Auth Service<br/>:3001<br/>JWT & OAuth"]
        US["👤 User Service<br/>:3007<br/>Profile Mgmt"]
        DS["🧑‍✈️ Driver Service<br/>:3003<br/>Driver Mgmt"]
    end

    subgraph Business["💼 BUSINESS SERVICES"]
        BS["📋 Booking Service<br/>:3008<br/>Order Creation"]
        RS["🚕 Ride Service<br/>:3002<br/>Trip Lifecycle"]
        PS["💰 Pricing Service<br/>:3009<br/>Dynamic Pricing"]
        PY["💳 Payment Service<br/>:3004<br/>Transactions"]
    end

    subgraph Support["🛠️ SUPPORT SERVICES"]
        NS["🔔 Notification<br/>:3005<br/>Socket.IO"]
        RV["⭐ Review Service<br/>:3010<br/>Ratings"]
        AI["🤖 AI Service<br/>:3006<br/>ML Matching"]
    end

    subgraph Data["💾 DATA LAYER"]
        PG[("🐘 PostgreSQL<br/>━━━━━━━<br/>7 Databases")]
        MG[("🍃 MongoDB<br/>━━━━━━━<br/>3 Databases")]
        RD[("⚡ Redis<br/>━━━━━━━<br/>Cache & Geo")]
        MQ["🐰 RabbitMQ<br/>━━━━━━━<br/>Message Queue"]
    end

    subgraph Monitor["📊 MONITORING"]
        PR["📈 Prometheus"]
        GR["📊 Grafana"]
        LK["📝 Loki"]
    end

    CA --> GW
    DA --> GW
    AA --> GW

    GW --> AS
    GW --> US
    GW --> DS
    GW --> BS
    GW --> RS
    GW --> PS
    GW --> PY
    GW --> NS
    GW --> RV
    GW --> AI

    AS -.-> PG
    US -.-> PG
    DS -.-> PG
    DS -.-> RD
    BS -.-> PG
    RS -.-> PG
    PS -.-> RD
    PY -.-> PG
    NS -.-> MG
    RV -.-> MG

    AS -.-> MQ
    BS -.-> MQ
    RS -.-> MQ
    NS -.-> MQ

    AS -.-> PR
    RS -.-> PR
    DS -.-> PR
    PR -.-> GR
    NS -.-> LK
    LK -.-> GR

    classDef clientStyle fill:#e1f5ff,stroke:#0288d1,stroke-width:2px
    classDef gatewayStyle fill:#fff3e0,stroke:#f57c00,stroke-width:3px
    classDef coreStyle fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef businessStyle fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    classDef supportStyle fill:#fff9c4,stroke:#f9a825,stroke-width:2px
    classDef dataStyle fill:#ffebee,stroke:#c62828,stroke-width:2px
    classDef monitorStyle fill:#e0f2f1,stroke:#00796b,stroke-width:2px

    class CA,DA,AA clientStyle
    class GW gatewayStyle
    class AS,US,DS coreStyle
    class BS,RS,PS,PY businessStyle
    class NS,RV,AI supportStyle
    class PG,MG,RD,MQ dataStyle
    class PR,GR,LK monitorStyle
```

### 🔧 Chi tiết các Microservices

<table>
<tr>
<th width="20%">Service</th>
<th width="15%">Port</th>
<th width="35%">Chức năng</th>
<th width="15%">Database</th>
<th width="15%">Tech Stack</th>
</tr>

<tr>
<td><b>🚪 API Gateway</b></td>
<td><code>3000</code></td>
<td>
• Cổng vào duy nhất<br/>
• JWT verification<br/>
• Rate limiting<br/>
• Request routing
</td>
<td>-</td>
<td>Express.js<br/>TypeScript</td>
</tr>

<tr>
<td><b>🔐 Auth Service</b></td>
<td><code>3001</code></td>
<td>
• Đăng ký/Đăng nhập<br/>
• JWT generation<br/>
• Refresh tokens<br/>
• Password hashing
</td>
<td>PostgreSQL<br/>(auth_db)</td>
<td>Express.js<br/>Prisma<br/>bcrypt</td>
</tr>

<tr>
<td><b>👤 User Service</b></td>
<td><code>3007</code></td>
<td>
• Quản lý hồ sơ<br/>
• Upload avatar<br/>
• Cập nhật thông tin<br/>
• User preferences
</td>
<td>PostgreSQL<br/>(user_db)</td>
<td>Express.js<br/>Prisma<br/>AWS S3</td>
</tr>

<tr>
<td><b>🧑‍✈️ Driver Service</b></td>
<td><code>3003</code></td>
<td>
• Đăng ký tài xế<br/>
• Quản lý hồ sơ GPLX<br/>
• Tracking GPS realtime<br/>
• Trạng thái online/offline
</td>
<td>PostgreSQL<br/>(driver_db)<br/>+Redis (geo)</td>
<td>Express.js<br/>Prisma<br/>Redis<br/>GEORADIUS</td>
</tr>

<tr>
<td><b>📋 Booking Service</b></td>
<td><code>3008</code></td>
<td>
• Tạo đơn đặt xe<br/>
• Xác nhận booking<br/>
• Hủy booking<br/>
• Lịch sử đặt xe
</td>
<td>PostgreSQL<br/>(booking_db)</td>
<td>Express.js<br/>Prisma<br/>RabbitMQ</td>
</tr>

<tr>
<td><b>🚕 Ride Service</b></td>
<td><code>3002</code></td>
<td>
• Vòng đời chuyến đi<br/>
• Matching driver<br/>
• Tracking progress<br/>
• Hoàn thành chuyến
</td>
<td>PostgreSQL<br/>(ride_db)</td>
<td>Express.js<br/>Prisma<br/>Socket.IO<br/>RabbitMQ</td>
</tr>

<tr>
<td><b>💰 Pricing Service</b></td>
<td><code>3009</code></td>
<td>
• Tính giá ước tính<br/>
• Surge pricing<br/>
• Bảng giá động<br/>
• Distance calculation
</td>
<td>Redis</td>
<td>Express.js<br/>Redis<br/>Haversine</td>
</tr>

<tr>
<td><b>💳 Payment Service</b></td>
<td><code>3004</code></td>
<td>
• Xử lý thanh toán<br/>
• Multi-payment methods<br/>
• Ví điện tử<br/>
• Commission split
</td>
<td>PostgreSQL<br/>(payment_db)</td>
<td>Express.js<br/>Prisma<br/>Stripe API</td>
</tr>

<tr>
<td><b>🔔 Notification</b></td>
<td><code>3005</code></td>
<td>
• Push notifications<br/>
• Realtime events<br/>
• Socket.IO connections<br/>
• SMS/Email queue
</td>
<td>MongoDB<br/>(notification_db)</td>
<td>Express.js<br/>Socket.IO<br/>Mongoose<br/>Twilio</td>
</tr>

<tr>
<td><b>⭐ Review Service</b></td>
<td><code>3010</code></td>
<td>
• Đánh giá chuyến đi<br/>
• Rating aggregation<br/>
• Top drivers<br/>
• Comment moderation
</td>
<td>MongoDB<br/>(review_db)</td>
<td>Express.js<br/>Mongoose</td>
</tr>

<tr>
<td><b>🤖 AI Service</b></td>
<td><code>3006</code></td>
<td>
• ML driver matching<br/>
• Demand prediction<br/>
• Route optimization<br/>
• Fraud detection
</td>
<td>-</td>
<td>FastAPI<br/>Python<br/>TensorFlow<br/>scikit-learn</td>
</tr>

</table>

### 🔄 Communication Pattern

```mermaid
graph LR
    A[Client] -->|HTTP/REST| B[API Gateway]
    B -->|HTTP| C[Microservices]
    C -->|Async Events| D[RabbitMQ]
    D -->|Consume| C
    C -->|Store| E[Databases]
    C -->|Cache| F[Redis]
    C -->|Realtime| G[Socket.IO]
    G -->|WebSocket| A
    
    style A fill:#e1f5ff
    style B fill:#fff3e0
    style C fill:#e8f5e9
    style D fill:#ffebee
    style E fill:#f3e5f5
    style F fill:#ffebee
    style G fill:#fff9c4
```

**Pattern chính:**
- **Synchronous**: HTTP/REST cho request-response
- **Asynchronous**: RabbitMQ cho event-driven communication
- **Realtime**: Socket.IO cho live updates
- **Cache**: Redis cho high-performance reads

---

## 🛠️ Công nghệ sử dụng

<table>
<tr>
<td width="50%" valign="top">

### 🖥️ Backend Technologies

```yaml
Runtime & Language:
  - Node.js: 18.x LTS
  - TypeScript: 5.3
  - Python: 3.11 (AI Service)

Frameworks:
  - Express.js: 4.18
  - FastAPI: 0.104 (Python)
  - Socket.IO: 4.7

ORM/ODM:
  - Prisma: 5.7 (PostgreSQL)
  - Mongoose: 8.0 (MongoDB)

Authentication:
  - JWT: jsonwebtoken
  - bcrypt: Password hashing
  - Passport.js: OAuth strategies

Validation:
  - Zod: Schema validation
  - class-validator
```

</td>
<td width="50%" valign="top">

### 🌐 Frontend Technologies

```yaml
Framework:
  - Next.js: 14 (App Router)
  - React: 18
  - TypeScript: 5.3

Styling:
  - Tailwind CSS: 3.4
  - shadcn/ui: Components
  - Framer Motion: Animations

State Management:
  - Zustand: 4.4
  - TanStack Query: Server state
  - Context API

Maps & Location:
  - Google Maps API
  - @react-google-maps/api
  - Geolocation API

Real-time:
  - Socket.IO Client: 4.7
```

</td>
</tr>

<tr>
<td width="50%" valign="top">

### 💾 Databases & Cache

```yaml
Relational Database:
  - PostgreSQL: 16
  - Total: 7 databases
    • auth_db
    • user_db  
    • driver_db
    • booking_db
    • ride_db
    • payment_db
    • pricing_db

NoSQL Database:
  - MongoDB: 7
  - Total: 3 databases
    • notification_db
    • review_db
    • analytics_db

In-Memory:
  - Redis: 7
  - Use cases:
    • Geospatial queries
    • Session cache
    • Rate limiting
    • Pub/Sub
```

</td>
<td width="50%" valign="top">

### 🔧 DevOps & Infrastructure

```yaml
Containerization:
  - Docker: 24.0
  - Docker Compose: 2.23

Message Queue:
  - RabbitMQ: 3.12
  - Exchanges: topic, direct

Monitoring:
  - Prometheus: Metrics
  - Grafana: Dashboards
  - Loki: Log aggregation
  - Alertmanager: Alerts

CI/CD:
  - GitHub Actions
  - Docker Registry

Admin Tools:
  - pgAdmin: PostgreSQL GUI
  - Mongo Express: MongoDB GUI
  - RedisInsight: Redis GUI
```

</td>
</tr>

<tr>
<td colspan="2">

### 📦 Key Libraries & Tools

| Category | Libraries |
|----------|-----------|
| **API Client** | axios, fetch |
| **Date & Time** | date-fns, dayjs |
| **Validation** | zod, yup, joi |
| **Testing** | Jest, Vitest, Playwright, Supertest |
| **Code Quality** | ESLint, Prettier, Husky |
| **Documentation** | Swagger/OpenAPI, Postman |
| **File Upload** | multer, AWS S3 SDK |
| **Email** | nodemailer, SendGrid |
| **SMS** | Twilio |
| **Payment** | Stripe SDK |
| **AI/ML** | TensorFlow, scikit-learn, pandas |

</td>
</tr>
</table>

---

## 🔄 Các luồng hoạt động chính

> Các sơ đồ được tối ưu để hiển thị đẹp trên GitHub

### 🔐 Flow 1: Authentication (Đăng ký & Đăng nhập)

```mermaid
sequenceDiagram
    autonumber
    actor U as 👤 User
    participant FE as 📱 Frontend
    participant GW as 🚪 Gateway
    participant AS as 🔐 Auth Service
    participant DB as 💾 PostgreSQL

    Note over U,DB: ĐĂNG KÝ TÀI KHOẢN
    
    U->>FE: Nhập email, password, phone
    FE->>GW: POST /api/auth/register
    GW->>AS: Forward request
    AS->>DB: Kiểm tra email tồn tại?
    
    alt ❌ Email đã tồn tại
        DB-->>AS: Email found
        AS-->>FE: 409 Conflict
        FE-->>U: "Email đã được đăng ký"
    else ✅ Email mới
        DB-->>AS: Email available
        AS->>AS: Hash password (bcrypt)
        AS->>DB: INSERT user
        AS->>AS: Generate JWT tokens
        AS->>DB: Save refresh_token
        AS-->>FE: 201 Created + tokens
        FE-->>U: ✅ "Đăng ký thành công!"
    end

    Note over U,DB: ĐĂNG NHẬP

    U->>FE: Nhập email + password
    FE->>GW: POST /api/auth/login
    GW->>AS: Forward request
    AS->>DB: SELECT * FROM users WHERE email
    
    alt ❌ Không tìm thấy
        DB-->>AS: No user found
        AS-->>FE: 401 Unauthorized
        FE-->>U: "Email hoặc mật khẩu sai"
    else ✅ Tìm thấy user
        DB-->>AS: Return user data
        AS->>AS: Compare password hash
        
        alt ❌ Sai mật khẩu
            AS-->>FE: 401 Unauthorized
            FE-->>U: "Email hoặc mật khẩu sai"
        else ✅ Đúng mật khẩu
            AS->>AS: Generate new tokens
            AS->>DB: UPDATE refresh_token
            AS-->>FE: 200 OK + tokens
            FE->>FE: Store tokens in localStorage
            FE-->>U: ✅ Redirect to dashboard
        end
    end
```

**Giải thích:**
- **Access Token**: JWT ngắn hạn (15 phút), chứa userId, role
- **Refresh Token**: JWT dài hạn (7 ngày), dùng để lấy access token mới
- **bcrypt**: Thuật toán hash password với salt, không thể reverse

---

### 🚗 Flow 2: Driver Registration (Tài xế đăng ký)

```mermaid
sequenceDiagram
    autonumber
    actor D as 🚗 Driver
    participant FE as 📱 Frontend
    participant GW as 🚪 Gateway
    participant DS as 🧑‍✈️ Driver Service
    participant DB as 💾 PostgreSQL
    participant NS as 🔔 Notification
    actor A as 👨‍💼 Admin

    Note over D,A: BƯỚC 1: TẠO TÀI KHOẢN (Như user bình thường)
    
    D->>FE: Đăng ký với role=DRIVER
    FE->>GW: POST /api/auth/register
    Note over GW: (Auth flow như trên)
    GW-->>FE: ✅ Tài khoản created

    Note over D,A: BƯỚC 2: NỘP HỒ SƠ TÀI XẾ
    
    D->>FE: Upload form:<br/>- Vehicle info<br/>- License number<br/>- License photo<br/>- Vehicle photos
    FE->>GW: POST /api/drivers/register
    GW->>DS: Forward request
    
    DS->>DS: Validate:<br/>✓ License not expired<br/>✓ Plate number format<br/>✓ Required documents
    
    DS->>DB: INSERT INTO drivers<br/>status = 'PENDING'
    DS->>NS: Emit event: driver.registered
    NS-->>D: 🔔 "Hồ sơ đang xét duyệt"
    NS-->>A: 🔔 "Tài xế mới đăng ký"
    DS-->>FE: 201 Created
    FE-->>D: ✅ "Đã nộp hồ sơ"

    Note over D,A: BƯỚC 3: ADMIN DUYỆT

    A->>FE: Xem danh sách PENDING
    FE->>GW: GET /api/admin/drivers?status=PENDING
    GW->>DS: Forward
    DS->>DB: SELECT * WHERE status='PENDING'
    DB-->>DS: List of pending drivers
    DS-->>FE: Return list
    FE-->>A: 📋 Hiển thị danh sách

    A->>FE: Click "Duyệt" cho driver_id=123
    FE->>GW: PUT /api/admin/drivers/123/approve
    GW->>DS: Forward
    DS->>DB: UPDATE drivers<br/>SET status='APPROVED'
    DS->>NS: Emit: driver.approved
    NS-->>D: 🎉 "Tài khoản đã được duyệt!"
    DS-->>FE: 200 OK
    FE-->>A: ✅ "Đã duyệt"

    Note over D,A: BƯỚC 4: TÀI XẾ ONLINE

    D->>FE: Toggle "Sẵn sàng nhận chuyến"
    FE->>GW: POST /api/drivers/online
    GW->>DS: Forward
    DS->>DB: UPDATE availability='ONLINE'
    DS->>DS: Start GPS tracking
    DS-->>FE: 200 OK
    FE-->>D: 🟢 "Đang online"
```

**Các trạng thái driver:**
- `PENDING`: Chờ duyệt
- `APPROVED`: Đã duyệt, có thể online
- `REJECTED`: Bị từ chối
- `SUSPENDED`: Bị tạm khóa

---

### 📋 Flow 3: Booking & Matching (Đặt xe & Ghép tài xế)

```mermaid
sequenceDiagram
    autonumber
    actor C as 👤 Customer
    participant FE as 📱 Frontend
    participant GW as 🚪 Gateway
    participant BS as 📋 Booking
    participant PS as 💰 Pricing
    participant RS as 🚕 Ride
    participant DS as 🧑‍✈️ Driver
    participant RD as ⚡ Redis
    participant MQ as 🐰 RabbitMQ
    participant NS as 🔔 Notification
    actor D as 🚗 Driver

    Note over C,D: GIAI ĐOẠN 1: XEM GIÁ ƯỚC TÍNH

    C->>FE: Chọn pickup + dropoff trên map
    FE->>GW: POST /api/pricing/estimate
    GW->>PS: Calculate fare
    PS->>PS: Distance = haversine(pickup, dropoff)
    PS->>RD: GET surge_multiplier
    RD-->>PS: surge = 1.5x (rush hour)
    PS->>PS: fare = (base + distance×rate) × surge
    PS-->>FE: 💰 estimatedFare: 50,000đ
    FE-->>C: Hiển thị giá

    Note over C,D: GIAI ĐOẠN 2: TẠO BOOKING

    C->>FE: Chọn vehicle: ECONOMY<br/>Payment: CASH<br/>Click "Đặt xe"
    FE->>GW: POST /api/bookings
    GW->>BS: Create booking
    BS->>PS: Get final price
    PS-->>BS: fare: 50,000đ
    BS->>DB: INSERT booking (PENDING)
    BS-->>FE: bookingId: B123
    FE-->>C: ⏳ "Đang tìm tài xế..."

    Note over C,D: GIAI ĐOẠN 3: XÁC NHẬN & TÌM TÀI XẾ

    C->>FE: Click "Xác nhận"
    FE->>GW: POST /api/bookings/B123/confirm
    GW->>BS: Confirm booking
    BS->>DB: UPDATE status='CONFIRMED'
    BS->>MQ: Publish: booking.confirmed
    
    MQ->>RS: Consume event
    RS->>DB: INSERT ride (FINDING_DRIVER)
    RS->>DS: Find drivers(pickup, 5km, ECONOMY)
    DS->>RD: GEORADIUS pickup_location 5km
    RD-->>DS: [driver1, driver2, ..., driver5]
    DS->>DB: Filter: ONLINE + rating>4.0
    DB-->>DS: Top 5 drivers
    DS-->>RS: driver_list
    
    RS->>NS: Notify drivers
    NS-->>D: 🔔 "Chuyến mới!<br/>Pickup: 2km<br/>Fare: 50k"

    Note over C,D: GIAI ĐOẠN 4: TÀI XẾ NHẬN CHUYẾN

    D->>FE: Click "Nhận chuyến"
    FE->>GW: POST /api/rides/R123/accept
    GW->>RS: Assign driver
    RS->>DB: UPDATE ride:<br/>status='ASSIGNED'<br/>driverId=D1
    RS->>DS: Set driver BUSY
    DS->>DB: UPDATE availability='BUSY'
    RS->>NS: Notify customer
    NS-->>C: ✅ "Tìm thấy tài xế!<br/>Tên: Nguyễn A<br/>ETA: 5 phút"
    NS-->>D: ✅ "Đã nhận chuyến"
```

**Thuật toán matching:**
1. GEORADIUS tìm trong bán kính 5km
2. Filter: ONLINE, đúng vehicle type, rating > 4.0
3. Sort: khoảng cách gần nhất, rating cao nhất
4. Gửi cho top 5 drivers
5. First come, first served

---

### 🛣️ Flow 4: Trip Progress (Chuyến đi diễn ra)

```mermaid
stateDiagram-v2
    [*] --> FINDING_DRIVER: Khách đặt xe
    
    FINDING_DRIVER --> ASSIGNED: Tìm thấy tài xế
    FINDING_DRIVER --> CANCELLED: Timeout/No driver
    
    ASSIGNED --> PICKING_UP: Tài xế chấp nhận
    ASSIGNED --> CANCELLED: Khách hủy
    
    PICKING_UP --> IN_PROGRESS: Đã đón khách
    PICKING_UP --> CANCELLED: Hủy chuyến
    
    IN_PROGRESS --> COMPLETED: Đến nơi
    IN_PROGRESS --> CANCELLED: Hủy khẩn cấp
    
    COMPLETED --> [*]: Thanh toán
    CANCELLED --> [*]: Phí hủy (nếu có)
    
    note right of FINDING_DRIVER
        ⏱️ Timeout: 2 phút
        🔍 Tìm 5 tài xế gần nhất
    end note
    
    note right of PICKING_UP
        📍 GPS tracking mỗi 5s
        🕐 ETA realtime
    end note
    
    note right of IN_PROGRESS
        📍 GPS tracking mỗi 10s
        📏 Tính km thực tế
        💰 Cập nhật giá
    end note
```

**Chi tiết realtime tracking:**

```mermaid
sequenceDiagram
    participant D as 🚗 Driver App
    participant DS as 🧑‍✈️ Driver Service
    participant RD as ⚡ Redis
    participant NS as 🔔 Notification
    participant C as 👤 Customer App

    Note over D,C: GPS TRACKING LOOP (Mỗi 5-10 giây)

    loop Every 5-10 seconds
        D->>DS: POST /api/drivers/location<br/>{lat, lng, heading, speed}
        DS->>RD: GEOADD drivers:geo lat lng driverId
        DS->>RD: SET driver:D1:location {lat,lng}
        DS->>NS: Emit: driver.location.updated
        NS->>C: Push via Socket.IO
        C->>C: Update marker on map
    end

    Note over D,C: TÍNH TOÁN KHOẢNG CÁCH

    DS->>DS: distance += haversine(oldPos, newPos)
    DS->>RD: INCRBYFLOAT ride:R123:distance 0.25
    DS->>PS: Calculate updated fare
    PS-->>DS: newFare
    DS->>NS: Emit: ride.fare.updated
    NS->>C: 💰 Update fare display
```

---

### 💳 Flow 5: Payment (Thanh toán)

```mermaid
sequenceDiagram
    autonumber
    actor C as 👤 Customer
    participant FE as 📱 Frontend
    participant GW as 🚪 Gateway
    participant PY as 💳 Payment
    participant PS as 💰 Pricing
    participant BK as 🏦 Bank/Gateway
    participant DB as 💾 PostgreSQL
    participant NS as 🔔 Notification
    actor D as 🚗 Driver

    Note over C,D: HOÀN THÀNH CHUYẾN & TÍNH GIÁ

    D->>FE: Click "Kết thúc chuyến"
    Note over FE,PY: (Ride complete flow)
    
    PY->>PS: Calculate final fare
    PS->>PS: fare = (base + km×rate + time×rate) × surge
    PS-->>PY: totalAmount: 72,500đ
    PY->>DB: INSERT payment (PENDING)
    PY->>NS: Notify customer
    NS->>C: 💰 "Tổng tiền: 72,500đ"

    Note over C,D: OPTION 1: TIỀN MẶT

    C->>FE: Select: CASH
    FE->>GW: POST /api/payments/P123/pay
    GW->>PY: method=CASH
    PY->>DB: UPDATE status='COMPLETED'
    PY->>PY: Split commission:<br/>Platform: 14,500đ (20%)<br/>Driver: 58,000đ (80%)
    PY->>DB: INSERT commission
    PY->>NS: Notify both
    NS->>C: ✅ "Vui lòng trả tiền cho tài xế"
    NS->>D: 💵 "Khách trả mặt: 72,500đ<br/>Bạn nhận: 58,000đ"

    Note over C,D: OPTION 2: THẺ NGÂN HÀNG

    C->>FE: Select: CARD + cardToken
    FE->>GW: POST /api/payments/P123/pay
    GW->>PY: method=CARD
    PY->>DB: UPDATE status='PROCESSING'
    PY->>BK: Charge card: 72,500đ
    
    alt ✅ Thành công
        BK-->>PY: Success + transactionId
        PY->>DB: UPDATE status='COMPLETED'<br/>txnId=TX123
        PY->>PY: Split commission
        PY->>NS: Notify
        NS->>C: ✅ "Thanh toán thành công!"
        NS->>D: 💰 "Đã nhận: 58,000đ"
    else ❌ Thất bại
        BK-->>PY: Failed: Insufficient funds
        PY->>DB: UPDATE status='FAILED'
        PY->>NS: Notify
        NS->>C: ❌ "Thanh toán thất bại<br/>Vui lòng thử lại"
    end

    Note over C,D: OPTION 3: VÍ ĐIỆN TỬ

    C->>FE: Select: WALLET
    FE->>GW: POST /api/payments/P123/pay
    GW->>PY: method=WALLET
    PY->>DB: SELECT balance FROM wallets
    
    alt ✅ Đủ tiền
        PY->>DB: BEGIN TRANSACTION
        PY->>DB: UPDATE wallets SET balance -= 72500
        PY->>DB: INSERT wallet_transactions
        PY->>DB: UPDATE payments status='COMPLETED'
        PY->>DB: COMMIT
        PY->>PY: Split commission
        PY->>NS: Notify
        NS->>C: ✅ "Đã trừ 72,500đ<br/>Còn lại: 150,000đ"
        NS->>D: 💰 "Đã nhận: 58,000đ"
    else ❌ Không đủ
        PY->>DB: ROLLBACK
        PY->>NS: Notify
        NS->>C: ❌ "Số dư không đủ<br/>Vui lòng nạp tiền"
    end
```

**Công thức tính giá:**

```
Base fare (Economy)    : 15,000đ
Distance charge        : 8.5km × 5,000đ/km = 42,500đ
Time charge            : 22 min × 500đ/min  = 11,000đ
                         ─────────────────────────
Subtotal               : 68,500đ
Surge multiplier (1.06): 68,500đ × 1.06     = 72,610đ
                         ─────────────────────────
Final (rounded)        : 72,500đ

Commission split:
  Platform (20%)       : 14,500đ
  Driver (80%)         : 58,000đ
```

---

### ⭐ Flow 6: Review & Rating (Đánh giá)

```mermaid
sequenceDiagram
    autonumber
    actor C as 👤 Customer
    actor D as 🚗 Driver
    participant FE as 📱 Frontend
    participant GW as 🚪 Gateway
    participant RV as ⭐ Review Service
    participant DS as 🧑‍✈️ Driver Service
    participant US as 👤 User Service
    participant DB as 💾 MongoDB
    participant NS as 🔔 Notification

    Note over C,NS: KHÁCH ĐÁNH GIÁ TÀI XẾ

    C->>FE: Chọn ⭐⭐⭐⭐⭐ (5 sao)<br/>Comment: "Tài xế lịch sự"
    FE->>GW: POST /api/reviews
    GW->>RV: Create review
    
    RV->>DB: Check if already reviewed?
    
    alt ❌ Đã đánh giá
        DB-->>RV: Review exists
        RV-->>FE: 409 Conflict
        FE-->>C: "Bạn đã đánh giá chuyến này"
    else ✅ Chưa đánh giá
        RV->>DB: INSERT review document
        RV->>DB: GET current rating aggregate
        DB-->>RV: {avg: 4.5, count: 20}
        
        RV->>RV: Calculate new average:<br/>(4.5×20 + 5) / 21 = 4.52
        
        RV->>DB: UPDATE rating_aggregate
        RV->>DS: Update driver.rating = 4.52
        DS->>DB: UPDATE drivers table
        
        RV->>NS: Emit: review.created
        NS-->>D: 🔔 "Đánh giá mới: ⭐⭐⭐⭐⭐"
        NS-->>C: ✅ "Cảm ơn đánh giá!"
    end

    Note over C,NS: TÀI XẾ ĐÁNH GIÁ KHÁCH

    D->>FE: Đánh giá: ⭐⭐⭐⭐ (4 sao)
    FE->>GW: POST /api/reviews
    GW->>RV: Create review
    RV->>DB: INSERT review
    RV->>RV: Calculate customer rating
    RV->>US: Update customer.rating
    RV->>NS: Notify
    NS-->>C: ⭐ "Tài xế đã đánh giá: 4 sao"

    Note over C,NS: XEM TOP TÀI XẾ

    C->>FE: Click "Top drivers"
    FE->>GW: GET /api/reviews/top-drivers?limit=10
    GW->>RV: Get top rated
    RV->>DB: SELECT aggregates<br/>ORDER BY average DESC<br/>LIMIT 10
    DB-->>RV: Top 10 list
    RV->>DS: Get driver details
    DS-->>RV: Names, photos, stats
    RV-->>FE: Return list
    FE-->>C: 🏆 Display leaderboard
```

**Rating system benefits:**
- **Quality control**: Tài xế rating thấp có thể bị khóa
- **Trust building**: Khách tin tưởng hơn khi chọn tài xế
- **Incentive**: Tài xế cố gắng để có rating cao
- **Data**: Phân tích để cải thiện dịch vụ

---

## 🚀 Cài đặt nhanh

### 📋 Yêu cầu hệ thống

```bash
✅ Node.js   >= 18.0.0
✅ Docker    >= 24.0.0
✅ Docker Compose >= 2.20.0
✅ Git       >= 2.30.0
```

### 🔧 Bước 1: Clone repository

```bash
git clone https://github.com/your-username/cab-booking-system.git
cd cab-booking-system
```

### ⚙️ Bước 2: Cấu hình môi trường

Tạo file `.env` từ template:

```bash
cp .env.example .env
```

Cập nhật các biến quan trọng:

```env
# ============ Security (PHẢI ĐỔI!) ============
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars
INTERNAL_SERVICE_TOKEN=your-internal-service-token-change-in-production

# ============ Databases ============
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres123
POSTGRES_DB=cab_booking

MONGO_USER=admin
MONGO_PASSWORD=admin123

# ============ Message Queue ============
RABBITMQ_USER=guest
RABBITMQ_PASS=guest

# ============ Google Maps API ============
# Lấy tại: https://console.cloud.google.com/apis/credentials
# Enable: Maps JavaScript API, Geocoding API, Distance Matrix API, Places API
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here

# ============ Admin Tools ============
PGADMIN_EMAIL=admin@cabbooking.local
PGADMIN_PASSWORD=admin123

GRAFANA_PASSWORD=admin123

# ============ Frontend URLs (Development) ============
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
NEXT_PUBLIC_CUSTOMER_APP_URL=http://localhost:4000
NEXT_PUBLIC_DRIVER_APP_URL=http://localhost:4001
NEXT_PUBLIC_ADMIN_APP_URL=http://localhost:4002

# ============ CORS ============
CORS_ORIGIN=http://localhost:4000,http://localhost:4001,http://localhost:4002
```

### 🐳 Bước 3: Khởi động hệ thống

```bash
# Khởi động tất cả services (14 containers)
docker-compose up -d

# Xem logs realtime
docker-compose logs -f

# Kiểm tra trạng thái
docker-compose ps
```

**Output mong đợi:**

```
NAME                     STATUS        PORTS
cab-api-gateway          Up           0.0.0.0:3000->3000/tcp
cab-auth-service         Up           3001/tcp
cab-user-service         Up           3007/tcp
cab-driver-service       Up           3003/tcp
cab-booking-service      Up           3008/tcp
cab-ride-service         Up           3002/tcp
cab-pricing-service      Up           3009/tcp
cab-payment-service      Up           3004/tcp
cab-notification-service Up           3005/tcp
cab-review-service       Up           3010/tcp
cab-ai-service           Up           3006/tcp
cab-postgresql           Up           5432/tcp
cab-mongodb              Up           27017/tcp
cab-redis                Up           6379/tcp
cab-rabbitmq             Up           5672/tcp, 15672/tcp
```

### 🌐 Bước 4: Truy cập ứng dụng

<table>
<tr>
<th>Ứng dụng</th>
<th>URL</th>
<th>Mô tả</th>
<th>Credentials</th>
</tr>
<tr>
<td>🚪 <b>API Gateway</b></td>
<td><a href="http://localhost:3000">localhost:3000</a></td>
<td>REST API chính</td>
<td>JWT token</td>
</tr>
<tr>
<td>📱 <b>Customer App</b></td>
<td><a href="http://localhost:4000">localhost:4000</a></td>
<td>Ứng dụng khách hàng</td>
<td>Đăng ký mới</td>
</tr>
<tr>
<td>🚗 <b>Driver App</b></td>
<td><a href="http://localhost:4001">localhost:4001</a></td>
<td>Ứng dụng tài xế</td>
<td>Đăng ký với GPLX</td>
</tr>
<tr>
<td>👨‍💼 <b>Admin Dashboard</b></td>
<td><a href="http://localhost:4002">localhost:4002</a></td>
<td>Trang quản trị</td>
<td>admin@cab.com / admin123</td>
</tr>
<tr>
<td colspan="4" style="background:#f5f5f5"><b>🛠️ ADMIN TOOLS</b></td>
</tr>
<tr>
<td>🐘 <b>pgAdmin</b></td>
<td><a href="http://localhost:5050">localhost:5050</a></td>
<td>PostgreSQL GUI</td>
<td>admin@cab.local / admin123</td>
</tr>
<tr>
<td>🍃 <b>Mongo Express</b></td>
<td><a href="http://localhost:8081">localhost:8081</a></td>
<td>MongoDB GUI</td>
<td>admin / admin123</td>
</tr>
<tr>
<td>🐰 <b>RabbitMQ</b></td>
<td><a href="http://localhost:15672">localhost:15672</a></td>
<td>Message Queue UI</td>
<td>guest / guest</td>
</tr>
<tr>
<td>📈 <b>Prometheus</b></td>
<td><a href="http://localhost:9090">localhost:9090</a></td>
<td>Metrics collector</td>
<td>-</td>
</tr>
<tr>
<td>📊 <b>Grafana</b></td>
<td><a href="http://localhost:3030">localhost:3030</a></td>
<td>Monitoring dashboard</td>
<td>admin / admin123</td>
</tr>
</table>

### ✅ Bước 5: Verify Health

```bash
# Kiểm tra API Gateway
curl http://localhost:3000/health

# Kiểm tra tất cả services
curl http://localhost:3000/health/all

# Kết quả mong đợi
{
  "status": "healthy",
  "services": {
    "auth": "up",
    "user": "up",
    "driver": "up",
    "booking": "up",
    "ride": "up",
    ...
  }
}
```

### 🧪 Bước 6: Test API

**Sử dụng Postman Collection:**

```bash
# Import file vào Postman
docs/postman-collection.json

# Hoặc test bằng curl
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test@123",
    "phone": "0901234567"
  }'
```

### 🛑 Dừng hệ thống

```bash
# Dừng tất cả services
docker-compose down

# Dừng và xóa volumes (dữ liệu sẽ mất)
docker-compose down -v

# Xóa images
docker-compose down --rmi all
```

---

## 📡 API Endpoints

### 🔐 Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/auth/register` | Đăng ký tài khoản | ❌ |
| `POST` | `/api/auth/login` | Đăng nhập | ❌ |
| `POST` | `/api/auth/refresh` | Làm mới token | ✅ |
| `POST` | `/api/auth/logout` | Đăng xuất | ✅ |
| `GET` | `/api/auth/me` | Lấy thông tin user | ✅ |

### 👤 Users

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/users/:id` | Lấy hồ sơ user | ✅ |
| `PUT` | `/api/users/:id` | Cập nhật hồ sơ | ✅ |
| `POST` | `/api/users/:id/avatar` | Upload avatar | ✅ |
| `GET` | `/api/users/:id/rides` | Lịch sử chuyến đi | ✅ |

### 🚗 Drivers

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| `POST` | `/api/drivers/register` | Đăng ký tài xế | ✅ | USER |
| `GET` | `/api/drivers/:id` | Thông tin tài xế | ✅ | ANY |
| `PUT` | `/api/drivers/:id` | Cập nhật thông tin | ✅ | DRIVER |
| `POST` | `/api/drivers/online` | Bật chế độ online | ✅ | DRIVER |
| `POST` | `/api/drivers/offline` | Tắt chế độ online | ✅ | DRIVER |
| `POST` | `/api/drivers/location` | Cập nhật vị trí | ✅ | DRIVER |
| `GET` | `/api/drivers/nearby` | Tài xế gần đây | ✅ | ANY |

### 📋 Bookings

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| `POST` | `/api/bookings` | Tạo booking | ✅ | CUSTOMER |
| `GET` | `/api/bookings/:id` | Chi tiết booking | ✅ | ANY |
| `POST` | `/api/bookings/:id/confirm` | Xác nhận đặt xe | ✅ | CUSTOMER |
| `POST` | `/api/bookings/:id/cancel` | Hủy booking | ✅ | CUSTOMER |
| `GET` | `/api/bookings` | Danh sách bookings | ✅ | ANY |

### 🚕 Rides

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| `GET` | `/api/rides` | Danh sách rides | ✅ | ANY |
| `GET` | `/api/rides/:id` | Chi tiết ride | ✅ | ANY |
| `POST` | `/api/rides/:id/accept` | Nhận chuyến | ✅ | DRIVER |
| `POST` | `/api/rides/:id/start-pickup` | Bắt đầu đón | ✅ | DRIVER |
| `POST` | `/api/rides/:id/start-trip` | Bắt đầu chuyến | ✅ | DRIVER |
| `POST` | `/api/rides/:id/complete` | Hoàn thành | ✅ | DRIVER |
| `POST` | `/api/rides/:id/cancel` | Hủy chuyến | ✅ | ANY |
| `GET` | `/api/rides/active` | Chuyến đang đi | ✅ | ANY |

### 💰 Pricing

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/pricing/estimate` | Ước tính giá | ✅ |
| `GET` | `/api/pricing/rates` | Bảng giá | ❌ |
| `GET` | `/api/pricing/surge` | Hệ số surge | ❌ |
| `PUT` | `/api/pricing/rates` | Cập nhật giá | ✅ (ADMIN) |

### 💳 Payments

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| `GET` | `/api/payments/:id` | Chi tiết payment | ✅ | ANY |
| `POST` | `/api/payments/:id/pay` | Thanh toán | ✅ | CUSTOMER |
| `POST` | `/api/payments/wallet/topup` | Nạp ví | ✅ | ANY |
| `GET` | `/api/payments/wallet/balance` | Số dư ví | ✅ | ANY |
| `GET` | `/api/payments/history` | Lịch sử GD | ✅ | ANY |

### ⭐ Reviews

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/reviews` | Tạo đánh giá | ✅ |
| `GET` | `/api/reviews/:id` | Chi tiết review | ✅ |
| `GET` | `/api/reviews/ride/:rideId` | Reviews của ride | ✅ |
| `GET` | `/api/reviews/driver/:driverId` | Reviews của driver | ✅ |
| `GET` | `/api/reviews/top-drivers` | Top tài xế | ❌ |

### 👨‍💼 Admin

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| `GET` | `/api/admin/stats` | Thống kê tổng quan | ✅ | ADMIN |
| `GET` | `/api/admin/users` | Danh sách users | ✅ | ADMIN |
| `GET` | `/api/admin/drivers` | Danh sách drivers | ✅ | ADMIN |
| `PUT` | `/api/admin/drivers/:id/approve` | Duyệt tài xế | ✅ | ADMIN |
| `PUT` | `/api/admin/drivers/:id/reject` | Từ chối tài xế | ✅ | ADMIN |
| `PUT` | `/api/admin/users/:id/suspend` | Khóa user | ✅ | ADMIN |
| `GET` | `/api/admin/rides/live` | Chuyến đang chạy | ✅ | ADMIN |

**Request Example:**

```bash
# Đăng ký
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@example.com",
    "password": "Pass@123",
    "phone": "0901234567",
    "role": "CUSTOMER"
  }'

# Đăng nhập
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@example.com",
    "password": "Pass@123"
  }'

# Response
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": {
    "id": "123",
    "email": "customer@example.com",
    "role": "CUSTOMER"
  }
}

# Sử dụng token
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer eyJhbGc..."
```

---

## � Database Schema

### 🐘 PostgreSQL Databases (7 databases)

<details>
<summary><b>1. auth_db - Authentication</b></summary>

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('CUSTOMER', 'DRIVER', 'ADMIN')),
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETED')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Refresh tokens
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
```
</details>

<details>
<summary><b>2. user_db - User Profiles</b></summary>

```sql
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    date_of_birth DATE,
    address TEXT,
    rating DECIMAL(3,2) DEFAULT 5.0,
    total_rides INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
```
</details>

<details>
<summary><b>3. driver_db - Drivers</b></summary>

```sql
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL,
    
    -- Vehicle info
    vehicle_type VARCHAR(20) NOT NULL CHECK (vehicle_type IN ('ECONOMY', 'COMFORT', 'PREMIUM')),
    vehicle_brand VARCHAR(50),
    vehicle_model VARCHAR(50),
    vehicle_plate VARCHAR(20) UNIQUE NOT NULL,
    vehicle_color VARCHAR(30),
    vehicle_year INTEGER,
    
    -- License info
    license_number VARCHAR(50) UNIQUE NOT NULL,
    license_expiry DATE NOT NULL,
    license_photo_url TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED')),
    availability VARCHAR(20) DEFAULT 'OFFLINE' CHECK (availability IN ('ONLINE', 'BUSY', 'OFFLINE')),
    
    -- Stats
    rating DECIMAL(3,2) DEFAULT 5.0,
    total_rides INTEGER DEFAULT 0,
    total_earnings DECIMAL(12,2) DEFAULT 0,
    
    -- Location (cached from Redis)
    last_lat DECIMAL(10,8),
    last_lng DECIMAL(11,8),
    last_location_update TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_drivers_user_id ON drivers(user_id);
CREATE INDEX idx_drivers_status ON drivers(status);
CREATE INDEX idx_drivers_availability ON drivers(availability);
CREATE INDEX idx_drivers_vehicle_type ON drivers(vehicle_type);
```
</details>

<details>
<summary><b>4. booking_db - Bookings</b></summary>

```sql
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    
    -- Pickup
    pickup_lat DECIMAL(10,8) NOT NULL,
    pickup_lng DECIMAL(11,8) NOT NULL,
    pickup_address TEXT NOT NULL,
    
    -- Dropoff
    dropoff_lat DECIMAL(10,8) NOT NULL,
    dropoff_lng DECIMAL(11,8) NOT NULL,
    dropoff_address TEXT NOT NULL,
    
    -- Booking details
    vehicle_type VARCHAR(20) NOT NULL,
    estimated_distance DECIMAL(8,2),
    estimated_duration INTEGER,
    estimated_fare DECIMAL(10,2),
    
    payment_method VARCHAR(20) CHECK (payment_method IN ('CASH', 'CARD', 'WALLET')),
    notes TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED')),
    cancellation_reason TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_created_at ON bookings(created_at DESC);
```
</details>

<details>
<summary><b>5. ride_db - Rides</b></summary>

```sql
CREATE TABLE rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID UNIQUE NOT NULL,
    customer_id UUID NOT NULL,
    driver_id UUID,
    
    -- Locations (from booking)
    pickup_lat DECIMAL(10,8) NOT NULL,
    pickup_lng DECIMAL(11,8) NOT NULL,
    pickup_address TEXT NOT NULL,
    dropoff_lat DECIMAL(10,8) NOT NULL,
    dropoff_lng DECIMAL(11,8) NOT NULL,
    dropoff_address TEXT NOT NULL,
    
    -- Ride details
    vehicle_type VARCHAR(20) NOT NULL,
    estimated_fare DECIMAL(10,2),
    final_fare DECIMAL(10,2),
    actual_distance DECIMAL(8,2),
    actual_duration INTEGER,
    
    payment_method VARCHAR(20),
    
    -- Status
    status VARCHAR(30) DEFAULT 'FINDING_DRIVER' CHECK (status IN (
        'FINDING_DRIVER',
        'ASSIGNED',
        'PICKING_UP',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED'
    )),
    
    -- Timestamps
    finding_driver_at TIMESTAMP DEFAULT NOW(),
    assigned_at TIMESTAMP,
    pickup_started_at TIMESTAMP,
    trip_started_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    
    cancellation_reason TEXT,
    cancelled_by VARCHAR(20),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rides_customer_id ON rides(customer_id);
CREATE INDEX idx_rides_driver_id ON rides(driver_id);
CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_rides_created_at ON rides(created_at DESC);
```
</details>

<details>
<summary><b>6. payment_db - Payments</b></summary>

```sql
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID UNIQUE NOT NULL,
    customer_id UUID NOT NULL,
    driver_id UUID NOT NULL,
    
    -- Amount
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'VND',
    
    -- Payment method
    method VARCHAR(20) NOT NULL CHECK (method IN ('CASH', 'CARD', 'WALLET')),
    
    -- Card payment
    card_token VARCHAR(255),
    transaction_id VARCHAR(255),
    
    -- Status
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED')),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    failed_at TIMESTAMP,
    error_message TEXT
);

CREATE TABLE commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID UNIQUE NOT NULL REFERENCES payments(id),
    ride_id UUID NOT NULL,
    
    total_amount DECIMAL(10,2) NOT NULL,
    platform_fee DECIMAL(10,2) NOT NULL,
    platform_percentage DECIMAL(5,2) DEFAULT 20.0,
    driver_earnings DECIMAL(10,2) NOT NULL,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payments_ride_id ON payments(ride_id);
CREATE INDEX idx_payments_customer_id ON payments(customer_id);
CREATE INDEX idx_payments_status ON payments(status);
```
</details>

<details>
<summary><b>7. pricing_db - Pricing (Optional, mostly in Redis)</b></summary>

```sql
CREATE TABLE pricing_rates (
    id SERIAL PRIMARY KEY,
    vehicle_type VARCHAR(20) UNIQUE NOT NULL,
    base_fare DECIMAL(10,2) NOT NULL,
    per_km_rate DECIMAL(10,2) NOT NULL,
    per_minute_rate DECIMAL(10,2) NOT NULL,
    minimum_fare DECIMAL(10,2) NOT NULL,
    booking_fee DECIMAL(10,2) DEFAULT 0,
    cancellation_fee DECIMAL(10,2) DEFAULT 0,
    
    effective_from TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO pricing_rates (vehicle_type, base_fare, per_km_rate, per_minute_rate, minimum_fare) VALUES
('ECONOMY', 15000, 5000, 500, 20000),
('COMFORT', 20000, 8000, 800, 30000),
('PREMIUM', 30000, 12000, 1200, 50000);
```
</details>

### 🍃 MongoDB Databases (3 databases)

<details>
<summary><b>1. notification_db</b></summary>

```javascript
// Collection: notifications
{
  _id: ObjectId,
  userId: String,
  type: String, // 'RIDE_ASSIGNED', 'DRIVER_ARRIVED', 'TRIP_STARTED', etc.
  title: String,
  message: String,
  data: {
    rideId: String,
    driverId: String,
    // ... other relevant data
  },
  status: String, // 'SENT', 'DELIVERED', 'READ'
  channels: [String], // ['PUSH', 'SMS', 'EMAIL', 'SOCKET']
  sentAt: Date,
  deliveredAt: Date,
  readAt: Date,
  createdAt: Date
}

// Indexes
db.notifications.createIndex({ userId: 1, createdAt: -1 });
db.notifications.createIndex({ status: 1 });
db.notifications.createIndex({ type: 1 });
```
</details>

<details>
<summary><b>2. review_db</b></summary>

```javascript
// Collection: reviews
{
  _id: ObjectId,
  rideId: String,
  
  // Reviewer
  reviewerId: String,
  reviewerType: String, // 'CUSTOMER' | 'DRIVER'
  
  // Reviewee
  revieweeId: String,
  revieweeType: String, // 'CUSTOMER' | 'DRIVER'
  
  // Rating
  rating: Number, // 1-5
  comment: String,
  
  // Tags
  tags: [String], // ['friendly', 'clean_car', 'safe_driving', etc.]
  
  // Moderation
  isVisible: Boolean,
  moderationStatus: String, // 'PENDING', 'APPROVED', 'REJECTED'
  
  createdAt: Date,
  updatedAt: Date
}

// Collection: rating_aggregates
{
  _id: ObjectId,
  entityId: String, // userId or driverId
  entityType: String, // 'CUSTOMER' | 'DRIVER'
  
  totalReviews: Number,
  averageRating: Number,
  
  // Rating distribution
  ratings: {
    5: Number,
    4: Number,
    3: Number,
    2: Number,
    1: Number
  },
  
  lastUpdated: Date
}

// Indexes
db.reviews.createIndex({ rideId: 1 });
db.reviews.createIndex({ revieweeId: 1, revieweeType: 1 });
db.rating_aggregates.createIndex({ entityId: 1, entityType: 1 }, { unique: true });
```
</details>

<details>
<summary><b>3. analytics_db (Optional)</b></summary>

```javascript
// Collection: ride_events
{
  _id: ObjectId,
  rideId: String,
  eventType: String,
  eventData: Object,
  timestamp: Date
}

// Collection: driver_sessions
{
  _id: ObjectId,
  driverId: String,
  startTime: Date,
  endTime: Date,
  totalOnlineMinutes: Number,
  totalRides: Number,
  totalEarnings: Number
}

// Indexes
db.ride_events.createIndex({ rideId: 1, timestamp: -1 });
db.driver_sessions.createIndex({ driverId: 1, startTime: -1 });
```
</details>

### ⚡ Redis Keys Structure

```bash
# Driver locations (Geospatial)
drivers:geo:online             # GEOADD for storing lat/lng
                                # GEORADIUS for finding nearby

# Driver status
driver:{id}:status             # STRING: 'ONLINE', 'BUSY', 'OFFLINE'
driver:{id}:location           # HASH: {lat, lng, heading, speed, timestamp}

# Ride tracking
ride:{id}:status               # STRING
ride:{id}:distance             # STRING (float)
ride:{id}:duration             # STRING (seconds)
ride:{id}:fare                 # STRING (float)

# Pricing
pricing:surge                  # HASH: {ECONOMY: 1.5, COMFORT: 1.3, ...}
pricing:rates:{vehicleType}    # HASH: {base, perKm, perMin}

# Session/Cache
session:{userId}               # STRING (JWT token)
cache:user:{userId}            # HASH (user profile)
cache:driver:{driverId}        # HASH (driver info)

# Rate limiting
ratelimit:{ip}                 # STRING with TTL
ratelimit:api:{userId}         # STRING with TTL

# Pub/Sub channels
location:updates               # Channel for broadcasting location updates
ride:events                    # Channel for ride status changes
```

---

## 🧪 Testing

### Unit Tests

```bash
# Run all unit tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Integration Tests

```bash
# Start test database
docker-compose -f docker-compose.test.yml up -d

# Run integration tests
npm run test:integration

# Cleanup
docker-compose -f docker-compose.test.yml down -v
```

### E2E Tests (Playwright)

```bash
# Install browsers
npx playwright install

# Run E2E tests
npm run test:e2e

# Run in UI mode
npm run test:e2e:ui

# Generate report
npm run test:e2e:report
```

### Load Testing (k6)

```bash
# Install k6
brew install k6  # macOS
# or download from https://k6.io

# Run load test
k6 run tests/load/booking-flow.js

# With custom VUs and duration
k6 run --vus 100 --duration 30s tests/load/booking-flow.js
```

---

## 📊 Monitoring

### 📈 Prometheus Metrics

Truy cập: http://localhost:9090

**Available metrics:**

```
# HTTP metrics
http_requests_total
http_request_duration_seconds
http_requests_in_progress

# Business metrics
bookings_created_total
rides_completed_total
payments_processed_total
active_drivers_gauge
active_rides_gauge

# System metrics
nodejs_heap_size_used_bytes
nodejs_heap_size_total_bytes
process_cpu_seconds_total
```

### 📊 Grafana Dashboards

Truy cập: http://localhost:3030 (admin / admin123)

**Pre-configured dashboards:**

1. **System Overview**
   - Total users, drivers, rides
   - Revenue today
   - Active rides
   - Average rating

2. **Service Health**
   - Request rate
   - Error rate
   - Response time (p50, p95, p99)
   - Service availability

3. **Business Metrics**
   - Bookings per hour
   - Completion rate
   - Cancellation rate
   - Payment success rate
   - Average fare

4. **Driver Metrics**
   - Online drivers
   - Utilization rate
   - Average earnings
   - Top performers

---

## 📞 Liên hệ

- 📧 Email: your-email@example.com
- 🐙 GitHub: [your-username](https://github.com/your-username)
- 💼 LinkedIn: [Your Name](https://linkedin.com/in/your-profile)

---

## 📄 License

Dự án này được phát triển cho mục đích học tập. Vui lòng không sử dụng cho mục đích thương mại mà không có sự cho phép.

---

<div align="center">

**⭐ Nếu thấy hữu ích, hãy cho dự án một star! ⭐**

Made with ❤️ by [Your Name]

[⬆ Về đầu trang](#-cab-booking-system)

</div>



