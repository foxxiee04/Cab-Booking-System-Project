# CHƯƠNG 1: TỔNG QUAN HỆ THỐNG CAB BOOKING

---

## 1.1. Giới Thiệu Đề Tài

### 1.1.1. Bối Cảnh và Tính Cấp Thiết

Trong bối cảnh chuyển đổi số và sự phát triển mạnh mẽ của các ứng dụng di động, ngành vận tải hành khách đã chứng kiến những thay đổi đáng kể với sự xuất hiện của các nền tảng đặt xe trực tuyến (ride-hailing platforms). Các ứng dụng như Uber, Grab, và Be đã thay đổi hoàn toàn cách thức người dùng tiếp cận dịch vụ taxi truyền thống.

Từ góc độ kỹ thuật, việc xây dựng một hệ thống đặt xe thời gian thực (real-time cab booking system) đặt ra nhiều thách thức kiến trúc phần mềm phức tạp:
- **Xử lý thời gian thực**: Cập nhật vị trí GPS, trạng thái chuyến đi liên tục
- **Scalability**: Hỗ trợ hàng nghìn request đồng thời trong giờ cao điểm
- **Reliability**: Đảm bảo tính nhất quán dữ liệu giữa các thành phần phân tán
- **Low Latency**: Thời gian phản hồi nhanh để đảm bảo trải nghiệm người dùng

### 1.1.2. Mục Tiêu Nghiên Cứu

**Mục tiêu tổng quát:**
Thiết kế và triển khai một hệ thống đặt xe taxi thời gian thực, áp dụng kiến trúc Microservices kết hợp Domain-Driven Design, phù hợp với quy mô và yêu cầu của khóa luận tốt nghiệp.

**Mục tiêu cụ thể:**
1. Phân tích và thiết kế domain theo phương pháp Domain-Driven Design (DDD)
2. Xây dựng kiến trúc Microservices với các service độc lập
3. Triển khai hệ thống trên Docker Swarm cluster
4. Tích hợp module AI dưới dạng service độc lập
5. Đảm bảo khả năng real-time thông qua WebSocket và message broker

### 1.1.3. Phạm Vi Đề Tài

**Trong phạm vi:**
- Thiết kế kiến trúc hệ thống hoàn chỉnh
- Xây dựng 6 microservices core
- Triển khai trên môi trường Docker Swarm (VirtualBox + CentOS)
- Tích hợp AI service cơ bản (driver matching, ETA prediction)
- Xây dựng prototype đầy đủ tính năng cơ bản

**Ngoài phạm vi:**
- Tích hợp cổng thanh toán thực tế (VNPay/MoMo/ZaloPay) ở mức production
- Triển khai production-ready với Kubernetes
- Xây dựng ứng dụng mobile native
- Tối ưu hóa machine learning models

---

## 1.2. Kiến Trúc Tổng Thể (Big Picture)

### 1.2.1. High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                  CLIENTS                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐                  │
│   │  Customer    │    │   Driver     │    │      Admin       │                  │
│   │   Web App    │    │   Web App    │    │    Dashboard     │                  │
│   │  (Next.js)   │    │  (Next.js)   │    │   (Next.js)      │                  │
│   └──────┬───────┘    └──────┬───────┘    └────────┬─────────┘                  │
│          │                   │                     │                            │
│          └───────────────────┼─────────────────────┘                            │
│                              │                                                  │
│                              ▼                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                           API GATEWAY                                           │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                     Express Gateway (Node.js/TypeScript)                  │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │  │
│  │  │ JWT Auth    │ │  Routing    │ │Rate Limiting│ │   Load Balancing    │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                         MICROSERVICES LAYER                                     │
│                                                                                 │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐    │
│   │    AUTH     │  │    RIDE     │  │   DRIVER    │  │      PAYMENT        │    │
│   │   SERVICE   │  │   SERVICE   │  │   SERVICE   │  │      SERVICE        │    │
│   │             │  │             │  │             │  │                     │    │
│   │  • Register │  │  • Create   │  │  • Profile  │  │  • Fare Calc        │    │
│   │  • Login    │  │  • Assign   │  │  • GPS      │  │  • Transaction      │    │
│   │  • JWT      │  │  • State    │  │  • Status   │  │  • Saga Pattern     │    │
│   │  • RBAC     │  │  • Machine  │  │  • Matching │  │                     │    │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘    │
│          │                │                │                    │               │
│   ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────────┴──────────┐    │
│   │  MongoDB    │  │ PostgreSQL  │  │   Redis     │  │     PostgreSQL      │    │
│   │  (Users)    │  │  (Rides)    │  │   (Geo)     │  │     (Payments)      │    │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘    │
│                                                                                 │
│   ┌─────────────┐  ┌─────────────────────────────────────────────────────────┐  │
│   │NOTIFICATION │  │                     AI SERVICE                          │  │
│   │   SERVICE   │  │                    (FastAPI)                            │  │
│   │             │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐    │  │
│   │  • Push     │  │  │   Driver    │ │     ETA     │ │     Surge       │    │  │
│   │  • WebSocket│  │  │  Matching   │ │  Prediction │ │    Pricing      │    │  │
│   │  • Email    │  │  └─────────────┘ └─────────────┘ └─────────────────┘    │  │
│   └──────┬──────┘  └─────────────────────────────────────────────────────────┘  │
│          │                                                                      │
│   ┌──────┴──────┐                                                               │
│   │   Redis     │                                                               │
│   │  (Pub/Sub)  │                                                               │
│   └─────────────┘                                                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                           MESSAGE BROKER                                        │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                            RabbitMQ                                      │  │
│  │                                                                           │  │
│  │   Events: RideCreated | RideAssigned | PaymentCompleted | DriverUpdated   │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                          INFRASTRUCTURE                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐     │
│  │   Docker    │  │ Prometheus  │  │   Grafana   │  │    GitHub Actions   │     │
│  │   Swarm     │  │  (Metrics)  │  │ (Dashboard) │  │      (CI/CD)        │     │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2.2. Các Thành Phần Chính

| Thành phần | Mô tả | Công nghệ |
|------------|-------|-----------|
| **Client Layer** | Giao diện người dùng cho 3 nhóm: Customer, Driver, Admin | React.js, Next.js |
| **API Gateway** | Entry point duy nhất, xác thực, routing | Kong / Express Gateway |
| **Auth Service** | Quản lý danh tính, phân quyền | Node.js, MongoDB, JWT |
| **Ride Service** | Quản lý vòng đời chuyến đi | Node.js, PostgreSQL |
| **Driver Service** | Quản lý tài xế, vị trí GPS | Node.js, MongoDB, Redis (Geo) |
| **Payment Service** | Xử lý thanh toán, tính cước | Node.js, PostgreSQL |
| **Notification Service** | Thông báo real-time | Node.js, Socket.IO, Redis |
| **AI Service** | Driver matching, ETA, Surge pricing | Python, FastAPI |
| **Message Broker** | Event-driven communication | RabbitMQ |
| **Infrastructure** | Container orchestration, monitoring | Docker Swarm, Prometheus, Grafana |

---

## 1.3. Stakeholders và Actors

### 1.3.1. Định Nghĩa Actors

```
┌─────────────────────────────────────────────────────────────────┐
│                        SYSTEM ACTORS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│   │  CUSTOMER   │     │   DRIVER    │     │    ADMIN    │       │
│   │             │     │             │     │             │       │
│   │ • Đặt xe    │     │ • Nhận      │     │ • Quản lý   │       │
│   │ • Theo dõi  │     │   chuyến    │     │   người     │       │
│   │ • Thanh     │     │ • Cập nhật  │     │   dùng      │       │
│   │   toán      │     │   vị trí    │     │ • Báo cáo   │       │
│   │ • Đánh giá  │     │ • Online/   │     │ • Cấu hình  │       │
│   │             │     │   Offline   │     │   hệ thống  │       │
│   └─────────────┘     └─────────────┘     └─────────────┘       │
│                                                                 │
│   ┌───────────────────────────────────────────────────────────┐ │
│   │                    EXTERNAL SYSTEMS                       │ │
│   │                                                           │ │
│   │  • Map Provider (OpenStreetMap/Google Maps)               │ │
│   │  • Payment Gateway (Mô phỏng)                             │ │
│   │  • SMS/Email Provider (Mô phỏng)                          │ │
│   └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3.2. Use Case Overview

**Customer Use Cases:**
| UC ID | Use Case | Mô tả |
|-------|----------|-------|
| UC-C01 | Đăng ký tài khoản | Customer tạo tài khoản mới |
| UC-C02 | Đăng nhập | Customer đăng nhập hệ thống |
| UC-C03 | Đặt xe | Customer tạo yêu cầu đặt xe |
| UC-C04 | Theo dõi chuyến đi | Customer xem vị trí tài xế real-time |
| UC-C05 | Hủy chuyến | Customer hủy chuyến đi |
| UC-C06 | Thanh toán | Customer thanh toán sau chuyến đi |
| UC-C07 | Đánh giá tài xế | Customer đánh giá và review tài xế |
| UC-C08 | Xem lịch sử | Customer xem lịch sử chuyến đi |

**Driver Use Cases:**
| UC ID | Use Case | Mô tả |
|-------|----------|-------|
| UC-D01 | Đăng ký tài xế | Driver đăng ký làm tài xế |
| UC-D02 | Bật/Tắt trạng thái | Driver online/offline |
| UC-D03 | Nhận yêu cầu | Driver nhận thông báo có chuyến mới |
| UC-D04 | Chấp nhận/Từ chối | Driver quyết định nhận chuyến |
| UC-D05 | Cập nhật vị trí | Driver gửi GPS liên tục |
| UC-D06 | Hoàn thành chuyến | Driver xác nhận kết thúc chuyến |
| UC-D07 | Xem thu nhập | Driver xem báo cáo thu nhập |

**Admin Use Cases:**
| UC ID | Use Case | Mô tả |
|-------|----------|-------|
| UC-A01 | Quản lý user | Admin CRUD người dùng |
| UC-A02 | Quản lý driver | Admin duyệt/khóa tài xế |
| UC-A03 | Xem dashboard | Admin xem thống kê tổng quan |
| UC-A04 | Cấu hình giá | Admin thiết lập bảng giá |
| UC-A05 | Xem báo cáo | Admin xuất báo cáo |

---

## 1.4. Yêu Cầu Chức Năng

### 1.4.1. Functional Requirements

```
┌────────────────────────────────────────────────────────────────┐
│                  FUNCTIONAL REQUIREMENTS                       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  FR-1: USER MANAGEMENT                                         │
│  ├── FR-1.1: Đăng ký với email/phone                           │
│  ├── FR-1.2: Đăng nhập với credentials                         │
│  ├── FR-1.3: Quản lý profile                                   │
│  ├── FR-1.4: Phân quyền theo role                              │
│  └── FR-1.5: Refresh token mechanism                           │
│                                                                │
│  FR-2: RIDE MANAGEMENT                                         │
│  ├── FR-2.1: Tạo yêu cầu đặt xe                                │
│  ├── FR-2.2: Tự động matching driver                           │
│  ├── FR-2.3: Real-time tracking                                │
│  ├── FR-2.4: State management (Pending→Completed)              │
│  └── FR-2.5: Hủy chuyến với policy                             │
│                                                                │
│  FR-3: DRIVER MANAGEMENT                                       │
│  ├── FR-3.1: Driver registration & verification                │
│  ├── FR-3.2: Online/Offline status                             │
│  ├── FR-3.3: GPS location tracking                             │
│  ├── FR-3.4: Accept/Reject rides                               │
│  └── FR-3.5: Availability management                           │
│                                                                │
│  FR-4: PAYMENT                                                 │
│  ├── FR-4.1: Fare calculation                                  │
│  ├── FR-4.2: Multiple payment methods (mock)                   │
│  ├── FR-4.3: Transaction history                               │
│  └── FR-4.4: Refund processing                                 │
│                                                                │
│  FR-5: NOTIFICATION                                            │
│  ├── FR-5.1: Push notification                                 │
│  ├── FR-5.2: In-app notification                               │
│  └── FR-5.3: Email/SMS notification (mock)                     │
│                                                                │
│  FR-6: AI FEATURES                                             │
│  ├── FR-6.1: Intelligent driver matching                       │
│  ├── FR-6.2: ETA prediction                                    │
│  └── FR-6.3: Dynamic pricing (surge)                           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 1.4.2. Non-Functional Requirements

| ID | Requirement | Mô tả | Metric |
|----|-------------|-------|--------|
| NFR-1 | **Performance** | Response time cho API calls | < 200ms (P95) |
| NFR-2 | **Availability** | Uptime của hệ thống | 99.5% |
| NFR-3 | **Scalability** | Horizontal scaling capability | 3-10 replicas per service |
| NFR-4 | **Security** | Data encryption, secure auth | JWT + HTTPS |
| NFR-5 | **Reliability** | Fault tolerance | Self-healing, retry mechanism |
| NFR-6 | **Real-time** | GPS update latency | < 1 second |
| NFR-7 | **Maintainability** | Code quality, documentation | Modular design |

---

## 1.5. Công Nghệ Sử Dụng

### 1.5.1. Technology Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                      TECHNOLOGY STACK                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  FRONTEND                                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  • React.js 18.x      - UI Framework                    │    │
│  │  • Next.js 14.x       - SSR/SSG Framework               │    │
│  │  • TypeScript 5.x     - Type Safety                     │    │
│  │  • Tailwind CSS       - Styling                         │    │
│  │  • Socket.IO Client   - WebSocket                       │    │
│  │  • Redux Toolkit      - State Management                │    │
│  │  • React Query        - Server State                    │    │
│  │  • Leaflet/Mapbox     - Maps                            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  BACKEND (Node.js Services)                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  • Node.js 20.x LTS   - Runtime                         │    │
│  │  • Express.js 4.x     - Web Framework                   │    │
│  │  • TypeScript 5.x     - Type Safety                     │    │
│  │  • Prisma/TypeORM     - ORM                             │    │
│  │  • Socket.IO          - WebSocket Server                │    │
│  │  • Bull/BullMQ        - Job Queue                       │    │
│  │  • Winston            - Logging                         │    │
│  │  • Joi/Zod            - Validation                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  BACKEND (AI Service)                                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  • Python 3.11+       - Runtime                         │    │
│  │  • FastAPI            - Web Framework                   │    │
│  │  • Pydantic           - Data Validation                 │    │
│  │  • Scikit-learn       - ML Library                      │    │
│  │  • NumPy/Pandas       - Data Processing                 │    │
│  │  • Uvicorn            - ASGI Server                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  DATABASES                                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  • PostgreSQL 15.x    - Relational (Rides, Payments)    │    │
│  │  • MongoDB 7.x        - Document (Users, Drivers)       │    │
│  │  • Redis 7.x          - Cache, Pub/Sub, Geo             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  MESSAGE BROKER                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  • RabbitMQ 3.12.x    - Message Queue                   │    │
│  │  • (Alternative: Kafka for high throughput)             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  INFRASTRUCTURE                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  • Docker 24.x        - Containerization                │    │
│  │  • Docker Swarm       - Orchestration                   │    │
│  │  • VirtualBox 7.x     - Virtualization                  │    │
│  │  • CentOS 10          - Operating System                │    │
│  │  • Nginx              - Reverse Proxy                   │    │
│  │  • Kong/Express GW    - API Gateway                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  MONITORING & CI/CD                                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  • Prometheus         - Metrics Collection              │    │
│  │  • Grafana            - Visualization                   │    │
│  │  • GitHub Actions     - CI/CD Pipeline                  │    │
│  │  • Docker Hub         - Container Registry              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.5.2. Lý Do Lựa Chọn Công Nghệ

| Công nghệ | Lý do lựa chọn |
|-----------|----------------|
| **Node.js** | - Event-driven, non-blocking I/O phù hợp real-time<br>- Ecosystem phong phú (npm)<br>- Dễ phát triển và maintain |
| **FastAPI** | - High performance (async)<br>- Auto-generate OpenAPI docs<br>- Native Python cho ML/AI |
| **PostgreSQL** | - ACID compliance cho transactions<br>- Mature và stable<br>- Tốt cho relational data (rides, payments) |
| **MongoDB** | - Flexible schema cho user profiles<br>- Horizontal scaling<br>- Document-based phù hợp với varied data |
| **Redis** | - In-memory, ultra-fast<br>- Geo commands cho location<br>- Pub/Sub cho real-time |
| **RabbitMQ** | - Reliable message delivery<br>- Supports multiple patterns<br>- Easier setup than Kafka |
| **Docker Swarm** | - Native Docker integration<br>- Simpler than Kubernetes<br>- Phù hợp quy mô khóa luận |
| **React.js** | - Component-based<br>- Large ecosystem<br>- Good performance với Virtual DOM |

---

## 1.6. Các Nguyên Tắc Thiết Kế

### 1.6.1. Architectural Principles

```
┌─────────────────────────────────────────────────────────────────┐
│                  ARCHITECTURAL PRINCIPLES                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. SEPARATION OF CONCERNS                                      │
│     ├── Mỗi service có một trách nhiệm rõ ràng                  │
│     ├── Frontend tách biệt với Backend                          │
│     └── Data layer độc lập với business logic                   │
│                                                                 │
│  2. LOOSE COUPLING                                              │
│     ├── Services giao tiếp qua API/Events                       │
│     ├── Không shared database                                   │
│     └── Contract-based communication                            │
│                                                                 │
│  3. HIGH COHESION                                               │
│     ├── Related functionality grouped together                  │
│     ├── Domain-driven boundaries                                │
│     └── Single bounded context per service                      │
│                                                                 │
│  4. STATELESS SERVICES                                          │
│     ├── No session state in service                             │
│     ├── State stored in database/cache                          │
│     └── Horizontal scaling enabled                              │
│                                                                 │
│  5. DATABASE PER SERVICE                                        │
│     ├── Each service owns its data                              │
│     ├── No direct database access across services               │
│     └── Data consistency via events                             │
│                                                                 │
│  6. DESIGN FOR FAILURE                                          │
│     ├── Retry mechanisms                                        │
│     ├── Circuit breaker pattern                                 │
│     ├── Graceful degradation                                    │
│     └── Self-healing capabilities                               │
│                                                                 │
│  7. OBSERVABLE SYSTEMS                                          │
│     ├── Centralized logging                                     │
│     ├── Metrics collection                                      │
│     └── Distributed tracing                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.6.2. Design Patterns Áp Dụng

| Pattern | Áp dụng | Mục đích |
|---------|---------|----------|
| **API Gateway** | Kong/Express Gateway | Single entry point, cross-cutting concerns |
| **Service Registry** | Docker Swarm DNS | Service discovery |
| **Circuit Breaker** | Node.js (opossum) | Fault tolerance |
| **Saga Pattern** | Payment Service | Distributed transactions |
| **Event Sourcing** | Ride lifecycle | Audit trail, state reconstruction |
| **CQRS** | Reporting | Separate read/write models |
| **Repository** | Data access | Abstract database operations |
| **Factory** | Object creation | Encapsulate complex construction |
| **Observer** | Event handling | Decouple event producers/consumers |

---

## 1.7. Kết Luận Chương

Chương 1 đã trình bày tổng quan về hệ thống Cab Booking, bao gồm:
- Bối cảnh và tính cấp thiết của đề tài
- Mục tiêu và phạm vi nghiên cứu
- Kiến trúc tổng thể (Big Picture)
- Các actors và use cases chính
- Yêu cầu chức năng và phi chức năng
- Stack công nghệ và lý do lựa chọn
- Các nguyên tắc thiết kế áp dụng

Các chương tiếp theo sẽ đi sâu vào phân tích Domain-Driven Design, thiết kế chi tiết từng microservice, và kiến trúc triển khai.

---

*Tiếp theo: [Chương 2 - Phân Tích Domain-Driven Design](./02-DDD-ANALYSIS.md)*
