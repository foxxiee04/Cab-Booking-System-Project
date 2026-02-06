# 🚕 Cab Booking System - Full Stack Microservices

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.2-blue)](https://reactjs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/Tests-108%2F108%20Passing-brightgreen)](tests/)

Hệ thống đặt xe taxi hoàn chỉnh với **kiến trúc microservices** (Backend) + **React frontend apps** (Customer, Driver, Admin). Xây dựng bằng **Node.js, TypeScript, Express, React, PostgreSQL, MongoDB, Redis, RabbitMQ, Docker, FastAPI và Machine Learning**.

---

## 📋 Mục lục

- [Tổng quan hệ thống](#-tổng-quan-hệ-thống)
- [Kiến trúc](#-kiến-trúc-hệ-thống)
- [Tech Stack](#-tech-stack)
- [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
- [Services & Ports](#-services--ports)
- [Cài đặt & Chạy](#-cài-đặt--chạy)
- [Frontend Apps](#-frontend-applications)
- [Backend Services](#-backend-services)
- [Databases](#-databases)
- [Luồng nghiệp vụ](#-luồng-nghiệp-vụ)
- [Testing](#-testing)
- [Scripts](#-scripts)
- [Deployment](#-deployment)

---

## 🎯 Tổng quan hệ thống

Cab Booking System là nền tảng đặt xe taxi với 3 ứng dụng frontend và 11 microservices backend:

### Frontend Applications
- **Customer App** (React) - Đặt xe, theo dõi chuyến đi
- **Driver App** (React) - Nhận chuyến, điều hướng
- **Admin Dashboard** (React) - Quản lý hệ thống

### Backend Services
- **10 Node.js Microservices** - Business logic
- **1 Python AI Service** - Machine Learning predictions

### Infrastructure
- **PostgreSQL** - Persistent data (7 databases)
- **MongoDB** - Document store (notifications, reviews)
- **Redis** - Cache, geo-indexing, surge pricing
- **RabbitMQ** - Event-driven messaging

---

## 🏗 Kiến trúc hệ thống

```mermaid
graph TB
    subgraph "Frontend Layer"
        CA[Customer App<br/>Port 4000]
        DA[Driver App<br/>Port 4001]
        AA[Admin Dashboard<br/>Port 4002]
    end

    subgraph "API Layer"
        GW[API Gateway<br/>Port 3000<br/>Auth Middleware]
        WS[WebSocket Server<br/>Socket.IO]
    end

    subgraph "Microservices Layer"
        AUTH[Auth Service<br/>Port 3001]
        USER[User Service<br/>Port 3007]
        DRIVER[Driver Service<br/>Port 3003]
        BOOKING[Booking Service<br/>Port 3008]
        RIDE[Ride Service<br/>Port 3002]
        PAYMENT[Payment Service<br/>Port 3004]
        PRICING[Pricing Service<br/>Port 3009]
        NOTIF[Notification Service<br/>Port 3005]
        REVIEW[Review Service<br/>Port 3010]
        AI[AI Service<br/>Port 8000]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL<br/>Port 5433)]
        MG[(MongoDB<br/>Port 27017)]
        RD[(Redis<br/>Port 6379)]
        MQ[RabbitMQ<br/>Port 5672]
    end

    CA -->|HTTP/WS| GW
    DA -->|HTTP/WS| GW
    AA -->|HTTP| GW

    GW --> AUTH
    GW --> USER
    GW --> DRIVER
    GW --> BOOKING
    GW --> RIDE
    GW --> PAYMENT
    GW --> PRICING
    GW --> NOTIF
    GW --> REVIEW

    WS -.Real-time Updates.-> CA
    WS -.Real-time Updates.-> DA

    AUTH --> PG
    USER --> PG
    DRIVER --> PG
    DRIVER --> RD
    BOOKING --> PG
    RIDE --> PG
    PAYMENT --> PG
    NOTIF --> MG
    REVIEW --> MG
    PRICING --> RD
    PRICING --> AI

    BOOKING -.Events.-> MQ
    RIDE -.Events.-> MQ
    PAYMENT -.Events.-> MQ
    
    MQ -.Consume.-> NOTIF
    MQ -.Consume.-> PAYMENT

    style CA fill:#4CAF50
    style DA fill:#2196F3
    style AA fill:#FF9800
    style GW fill:#9C27B0
    style AI fill:#F44336
```

---

## 💻 Tech Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.2 | UI Framework |
| TypeScript | 4.9+ | Type Safety |
| Redux Toolkit | 1.9 | State Management |
| Material-UI | 5.15 | UI Components |
| Leaflet | 1.9 | Maps (OpenStreetMap) |
| Socket.IO Client | 4.6 | Real-time Communication |
| Axios | 1.6 | HTTP Client |
| React Router | 6.20 | Routing |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20.x | Runtime |
| TypeScript | 5.3 | Language |
| Express | 4.18 | Web Framework |
| Prisma | 5.x | ORM (PostgreSQL) |
| Socket.IO | 4.7 | WebSocket |
| JWT | 9.0 | Authentication |
| RabbitMQ | 3.12 | Message Queue |

### AI/ML
| Technology | Version | Purpose |
|-----------|---------|---------|
| Python | 3.10 | AI Runtime |
| FastAPI | 0.104 | API Framework |
| Scikit-learn | 1.3 | ML Models |
| Pandas | 2.1 | Data Processing |
| NumPy | 1.26 | Numerical Computing |

### Databases
| Database | Version | Purpose |
|----------|---------|---------|
| PostgreSQL | 16 | Primary Data Store |
| MongoDB | 7 | Document Store |
| Redis | 7 | Cache & Geo-indexing |

### DevOps
| Tool | Purpose |
|------|---------|
| Docker | Containerization |
| Docker Compose | Local Development |
| GitHub Actions | CI/CD |

---

## 📁 Cấu trúc thư mục

```
Cab-Booking-System-Project/
├── 📱 apps/                          # Frontend Applications
│   ├── customer-app/                 # Customer React App (Port 4000)
│   │   ├── src/
│   │   │   ├── api/                  # API integration
│   │   │   ├── components/           # React components
│   │   │   ├── pages/                # Page components
│   │   │   ├── store/                # Redux store
│   │   │   └── socket/               # Socket.IO client
│   │   ├── public/
│   │   ├── package.json
│   │   └── .env.development
│   ├── driver-app/                   # Driver React App (Port 4001)
│   │   └── (similar structure)
│   ├── admin-dashboard/              # Admin React App (Port 4002)
│   │   └── (similar structure)
│   └── SETUP-GUIDE.md
│
├── 🔧 services/                      # Backend Microservices
│   ├── api-gateway/                  # API Gateway (Port 3000)
│   │   ├── src/
│   │   │   ├── middleware/           # Auth, rate limit
│   │   │   ├── routes/               # Route definitions
│   │   │   ├── socket/               # WebSocket handlers
│   │   │   └── index.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── auth-service/                 # Auth Service (Port 3001)
│   │   ├── src/
│   │   ├── prisma/                   # Prisma schema
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── user-service/                 # User Service (Port 3007)
│   ├── ride-service/                 # Ride Service (Port 3002)
│   ├── driver-service/               # Driver Service (Port 3003)
│   ├── payment-service/              # Payment Service (Port 3004)
│   ├── notification-service/         # Notification Service (Port 3005)
│   ├── booking-service/              # Booking Service (Port 3008)
│   ├── pricing-service/              # Pricing Service (Port 3009)
│   ├── review-service/               # Review Service (Port 3010)
│   └── ai-service/                   # AI Service (Port 8000 - Python)
│       ├── app/
│       ├── training/
│       ├── requirements.txt
│       └── Dockerfile
│
├── 📦 shared/                        # Shared Libraries
│   ├── api-client/                   # HTTP client cho frontend
│   ├── types/                        # TypeScript types
│   ├── utils/                        # Utility functions
│   ├── package.json
│   └── README.md
│
├── 🗄️ scripts/                       # Operational Scripts
│   ├── rebuild-system.sh/bat         # Complete rebuild
│   ├── init-db.sql                   # Database initialization
│   ├── seed-data-fixed.sql           # Sample data
│   ├── full-backend-test.ps1         # Integration tests
│   └── clear-db.sh/bat               # Reset databases
│
├── 🔐 env/                           # Environment configs
│   ├── auth.env
│   ├── booking.env
│   └── ...
│
├── 📊 tests/                         # Test Reports
│   └── comprehensive-test-report.txt # 108/108 tests passing
│
├── docker-compose.yml                # Development setup
├── docker-compose.prod.yml           # Production setup
├── .gitignore                        # Git ignore rules
├── .env.example                      # Environment template
├── package.json                      # Root package
└── README.md                         # This file
```

---

## 🌐 Services & Ports

### Frontend Applications
| App | Port | URL | Description |
|-----|------|-----|-------------|
| **Customer App** | 4000 | http://localhost:4000 | Customer booking interface |
| **Driver App** | 4001 | http://localhost:4001 | Driver dashboard |
| **Admin Dashboard** | 4002 | http://localhost:4002 | Admin panel |

### Backend Services
| Service | Port | URL | Database | Description |
|---------|------|-----|----------|-------------|
| **API Gateway** | 3000 | http://localhost:3000 | - | Entry point, auth middleware, Socket.IO |
| **Auth Service** | 3001 | http://localhost:3001 | PostgreSQL | Login, register, JWT, refresh tokens |
| **Ride Service** | 3002 | http://localhost:3002 | PostgreSQL | Ride management, state machine |
| **Driver Service** | 3003 | http://localhost:3003 | PostgreSQL + Redis | Driver profiles, location, status |
| **Payment Service** | 3004 | http://localhost:3004 | PostgreSQL | Payment processing, outbox pattern |
| **Notification Service** | 3005 | http://localhost:3005 | MongoDB + Redis | Push notifications, in-app messages |
| **User Service** | 3007 | http://localhost:3007 | PostgreSQL | User profiles, preferences |
| **Booking Service** | 3008 | http://localhost:3008 | PostgreSQL | Booking creation, confirmation |
| **Pricing Service** | 3009 | http://localhost:3009 | Redis | Fare estimation, surge pricing |
| **Review Service** | 3010 | http://localhost:3010 | MongoDB | Ratings & reviews |
| **AI Service** | 8000 | http://localhost:8000 | - | ETA & surge prediction (ML) |

### Infrastructure
| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5433 | 7 separate databases |
| MongoDB | 27017 | notification_db, review_db |
| Redis | 6379 | Cache, geo-indexing, surge data |
| RabbitMQ | 5672 | Event bus |
| RabbitMQ Management | 15672 | Management UI |

---

## 🚀 Cài đặt & Chạy

### Prerequisites
- **Docker** & **Docker Compose** (required)
- **Node.js** 20.x (for local development)
- **Git**

### Quick Start (với Docker - Recommended)

```bash
# 1. Clone repository
git clone <repository-url>
cd Cab-Booking-System-Project

# 2. Copy environment file
cp .env.example .env

# 3. Build và khởi động toàn bộ backend
docker-compose build
docker-compose up -d

# 4. Chờ services khởi động (30-60s)
docker-compose ps

# 5. Kiểm tra health
curl http://localhost:3000/health

# 6. Khởi động frontend apps (trong terminal riêng)
# Customer App
cd apps/customer-app
npm install
npm start   # → http://localhost:4000

# Driver App (terminal mới)
cd apps/driver-app
npm install
npm start   # → http://localhost:4001

# Admin Dashboard (terminal mới)
cd apps/admin-dashboard
npm install
npm start   # → http://localhost:4002
```

### Complete System Rebuild

```bash
# Windows
.\scripts\rebuild-system.bat

# Linux/Mac
./scripts/rebuild-system.sh
```

Script này sẽ:
1. ✅ Stop và xóa containers/volumes
2. ✅ Build Docker images
3. ✅ Khởi tạo databases
4. ✅ Apply Prisma migrations
5. ✅ Seed sample data
6. ✅ Start tất cả services

### Verify System

```bash
# Check all containers
docker-compose ps

# Test API Gateway
curl http://localhost:3000/health

# Test services health
curl http://localhost:3000/health/services

# View logs
docker-compose logs -f api-gateway
docker-compose logs -f ride-service
```

---

## 📱 Frontend Applications

### Customer App (Port 4000)
**Features:**
- 🔐 Login / Register
- 📍 Interactive map (OpenStreetMap)
- 📍 Location search & selection
- 💰 Fare estimation with surge pricing
- 🚗 Request rides
- 📡 Real-time driver tracking
- 📜 Ride history
- ⭐ Rate drivers
- 💳 Multiple payment methods (Cash, MoMo, Visa)

**Documentation:** [apps/customer-app/README.md](apps/customer-app/README.md)

### Driver App (Port 4001)

**Documentation:** [apps/customer-app/README.md](apps/customer-app/README.md)

### Driver App (Port 4001)
**Features:**
- 🔐 Driver login
- 🟢 Go online/offline
- 📍 GPS location tracking (auto-update every 15s)
- 🚗 Accept/reject rides
- 🗺️ Navigation to pickup/dropoff
- 📊 Earnings tracking
- ⭐ View ratings
- 📜 Ride history

**Documentation:** [apps/driver-app/README.md](apps/driver-app/README.md)

### Admin Dashboard (Port 4002)
**Features:**
- 📊 System analytics & KPIs
- 👥 User management
- 🚗 Driver management
- 🚖 Ride monitoring
- 💰 Revenue reports
- 🗺️ Live map with all drivers
- 📧 Notification management
- ⚙️ System configuration

**Documentation:** [apps/admin-dashboard/README.md](apps/admin-dashboard/README.md)

---

## 🔧 Backend Services

### API Gateway (Port 3000)
**Responsibilities:**
- Central entry point for all client requests
- JWT authentication middleware
- Request routing to microservices
- WebSocket server for real-time updates
- Rate limiting
- CORS handling

**Tech:** Node.js, Express, Socket.IO, Redis  
**Database:** None (stateless)

### Auth Service (Port 3001)
**Responsibilities:**
- User registration (customer, driver, admin)
- Login with JWT tokens
- Refresh token rotation
- Password hashing (bcrypt)
- Token validation
- Event publishing (user.created)

**Tech:** Node.js, Express, Prisma  
**Database:** PostgreSQL (auth_db)  
**Tables:** users, refresh_tokens

### Ride Service (Port 3002)
**Responsibilities:**
- Create rides from bookings
- Driver assignment (with retry logic)
- Ride state machine (created → assigned → accepted → pickup → started → completed)
- Real-time ride updates via Socket.IO
- Ride history
- Cancel rides

**Tech:** Node.js, Express, Prisma, Socket.IO  
**Database:** PostgreSQL (ride_db)  
**Tables:** rides, ride_transitions  
**Events:** ride.created, ride.completed, ride.cancelled

### Driver Service (Port 3003)
**Responsibilities:**
- Driver registration & profiles
- Vehicle information
- Online/offline status
- Real-time GPS location tracking
- Geo-indexing with Redis (GEOADD/GEORADIUS)
- Find nearby drivers
- Driver availability management

**Tech:** Node.js, Express, Prisma, Redis  
**Database:** PostgreSQL (driver_db) + Redis (geo-index)  
**Tables:** drivers, vehicles  
**Events:** driver.location.updated, driver.status.changed

### Payment Service (Port 3004)
**Responsibilities:**
- Process payments for completed rides
- Payment methods (Cash, Card, MoMo)
- Outbox pattern for event publishing
- Payment history
- Refund processing

**Tech:** Node.js, Express, Prisma  
**Database:** PostgreSQL (payment_db)  
**Tables:** payments, payment_outbox  
**Events:** payment.completed, payment.failed, payment.refunded

### Notification Service (Port 3005)
**Responsibilities:**
- Send notifications to users/drivers
- In-app notifications
- Push notifications (FCM ready)
- Email notifications (SMTP ready)
- Notification history
- Mark as read

**Tech:** Node.js, Express, MongoDB, Redis  
**Database:** MongoDB (notification_db)  
**Collections:** notifications

### User Service (Port 3007)
**Responsibilities:**
- User profile management
- Update personal information
- Avatar upload
- Preferences
- Get user by ID

**Tech:** Node.js, Express, Prisma  
**Database:** PostgreSQL (user_db)  
**Tables:** users

### Booking Service (Port 3008)
**Responsibilities:**
- Create booking requests
- Confirm bookings
- Cancel bookings
- Booking status tracking
- Customer booking history

**Tech:** Node.js, Express, Prisma  
**Database:** PostgreSQL (booking_db)  
**Tables:** bookings  
**Events:** booking.created, booking.confirmed, booking.cancelled

### Pricing Service (Port 3009)
**Responsibilities:**
- Calculate fare estimates
- Distance/duration from OSRM
- Base fare + per km/minute rates
- Surge pricing (dynamic multiplier)
- AI-powered ETA predictions
- Pricing rules management

**Tech:** Node.js, Express, Redis  
**Database:** Redis (surge multipliers)  
**Integration:** OSRM API, AI Service

### Review Service (Port 3010)
**Responsibilities:**
- Submit ride reviews
- Rating system (1-5 stars)
- Comments
- Driver average ratings
- Review history

**Tech:** Node.js, Express, MongoDB  
**Database:** MongoDB (review_db)  
**Collections:** reviews

### AI Service (Port 8000)
**Responsibilities:**
- Predict ride ETA using ML model
- Predict surge multiplier
- Model training scripts
- Feature engineering
- Model serving via REST API

**Tech:** Python, FastAPI, Scikit-learn, Pandas, NumPy  
**Model:** Random Forest / Gradient Boosting  
**Endpoints:** `/api/predict`, `/api/health`, `/api/stats`

---

## 🗄️ Databases

### PostgreSQL (Port 5433)
**7 Separate Databases** (đảm bảo isolation giữa services):

| Database | Service | Tables |
|----------|---------|--------|
| auth_db | Auth Service | users, refresh_tokens |
| user_db | User Service | users |
| driver_db | Driver Service | drivers, vehicles |
| booking_db | Booking Service | bookings |
| ride_db | Ride Service | rides, ride_transitions |
| payment_db | Payment Service | payments, payment_outbox |
| pricing_db | *(Unused)* | *(Config stored in Redis)* |

**Credentials:**
- Username: `postgres`
- Password: `postgres123`
- Connection: `postgresql://postgres:postgres123@localhost:5433/<db_name>`

### MongoDB (Port 27017)
**2 Databases:**

| Database | Service | Collections |
|----------|---------|-------------|
| notification_db | Notification Service | notifications |
| review_db | Review Service | reviews |

**Credentials:**
- Username: `admin`
- Password: `admin123`
- Connection: `mongodb://admin:admin123@localhost:27017`

**Note:** MongoDB collections được tạo tự động khi có data đầu tiên được insert.

### Redis (Port 6379)
**Use Cases:**
- Driver geo-indexing (GEOADD, GEORADIUS)
- Surge pricing multipliers
- Session cache
- Rate limiting counters

---

## 🔄 Luồng nghiệp vụ

### 1. Customer Đặt Xe (Booking Flow)

```mermaid
sequenceDiagram
    participant C as Customer App
    participant GW as API Gateway
    participant A as Auth Service
    participant P as Pricing Service
    participant B as Booking Service
    participant R as Ride Service
    participant D as Driver Service
    participant MQ as RabbitMQ
    participant N as Notification

    C->>GW: POST /api/auth/login
    GW->>A: Validate credentials
    A-->>GW: JWT tokens
    GW-->>C: Access token + refresh token

    C->>GW: POST /api/pricing/estimate
    GW->>P: Calculate fare
    P->>P: Get distance from OSRM
    P->>P: Apply surge multiplier
    P-->>C: Fare estimate

    C->>GW: POST /api/bookings
    GW->>B: Create booking
    B->>MQ: Publish booking.created
    B-->>C: Booking created

    C->>GW: POST /api/bookings/:id/confirm
    GW->>B: Confirm booking
    B-->>C: Booking confirmed

    MQ->>R: Consume booking.created
    R->>R: Create ride
    R->>D: Find nearby drivers
    D-->>R: Available drivers
    R->>D: Assign driver
    R->>MQ: Publish ride.created
    MQ->>N: Send notification to driver
```

### 2. Driver Nhận Chuyến (Ride Acceptance Flow)

```mermaid
sequenceDiagram
    participant D as Driver App
    participant GW as API Gateway
    participant R as Ride Service
    participant WS as WebSocket
    participant C as Customer App

    WS-->>D: ride.assigned event
    D->>GW: POST /api/rides/:id/accept
    GW->>R: Driver accepts ride
    R->>R: Update state: assigned → accepted
    R->>WS: Emit ride.accepted
    WS-->>C: Notify customer

    D->>GW: POST /api/rides/:id/pickup
    R->>R: Update state: accepted → pickup
    WS-->>C: Driver arrived

    D->>GW: POST /api/rides/:id/start
    R->>R: Update state: pickup → started  
    WS-->>C: Ride started

    D->>GW: POST /api/rides/:id/complete
    R->>R: Update state: started → completed
    R->>MQ: Publish ride.completed
    WS-->>C: Ride completed
```

### 3. Thanh Toán (Payment Flow)

```mermaid
sequenceDiagram
    participant R as Ride Service
    participant MQ as RabbitMQ
    participant P as Payment Service
    participant C as Customer App

    R->>MQ: Publish ride.completed
    MQ->>P: Consume ride.completed
    P->>P: Calculate final fare
    P->>P: Process payment
    P->>P: Insert to payment_outbox
    P->>MQ: Publish payment.completed
    MQ->>N: Notify customer
    C->>API: GET /api/payments/ride/:id
    API-->>C: Payment receipt
```

---

## 🧪 Testing

### Test Results: **108/108 Tests Passing ✅** (100%)

**Test Report:** [tests/comprehensive-test-report.txt](tests/comprehensive-test-report.txt)

### Test Coverage by Service

| Category | Tests | Status |
|----------|-------|--------|
| **Health Checks** | 5 | ✅ All Pass |
| **Auth Service** | 9 | ✅ All Pass |
| **User Service** | 2 | ✅ All Pass |
| **Driver Service** | 9 | ✅ All Pass |
| **Pricing Service** | 4 | ✅ All Pass |
| **Booking Service** | 6 | ✅ All Pass |
| **Ride Service (Full Lifecycle)** | 11 | ✅ All Pass |
| **Payment Service** | 3 | ✅ All Pass |
| **AI Service** | 2 | ✅ All Pass |
| **Integration Tests** | 57 | ✅ All Pass |
| **Total** | **108** | **✅ 100%** |

### Run Tests

```bash
# Backend integration tests
cd scripts
./full-backend-test.ps1      # Windows
./full-backend-test.sh        # Linux/Mac

# Frontend unit tests
cd apps/customer-app
npm test

cd apps/driver-app  
npm test

cd apps/admin-dashboard
npm test

# Shared library tests
cd shared
npm test
```

---

## 📜 Scripts

### Development Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| **rebuild-system** | Complete system rebuild | `./scripts/rebuild-system.sh` |
| **clear-db** | Reset all databases | `./scripts/clear-db.sh` |
| **init-db.sql** | Initialize PostgreSQL DBs | Đã auto-run trong Docker |
| **seed-data-fixed.sql** | Insert sample data | `docker exec -i cab-postgres psql ...` |
| **verify-system** | Check environment | `./scripts/verify-system.sh` |
| **full-backend-test** | Run all integration tests | `./scripts/full-backend-test.ps1` |
| **smoke-test** | Quick health check | `./scripts/smoke-test.sh` |
| **sync-schemas** | Sync Prisma schemas | `./scripts/sync-schemas.sh` |

### Docker Commands

```bash
# Start all services
docker-compose up -d

# Stop all services  
docker-compose down

# View logs
docker-compose logs -f [service-name]

# Rebuild specific service
docker-compose build --no-cache [service-name]

# Restart service
docker-compose restart [service-name]

# Check service status
docker-compose ps

# Execute command in container
docker exec -it cab-postgres psql -U postgres
docker exec -it cab-mongodb mongosh -u admin -p admin123

# Remove volumes (⚠️ deletes data)
docker-compose down -v
```

---

## 🚀 Deployment

### Production Deployment (Docker Swarm)

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-stack.yml cab-booking

# Check services
docker stack services cab-booking

# Scale service
docker service scale cab-booking_ride-service=3

# Update service
docker service update --image cab-ride-service:v2 cab-booking_ride-service

# Remove stack
docker stack rm cab-booking
```

### Environment Variables

**Backend (.env):**
```bash
# Databases
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<strong-password>
MONGO_USER=admin
MONGO_PASSWORD=<strong-password>
RABBITMQ_USER=guest
RABBITMQ_PASS=<strong-password>

# Security
JWT_SECRET=<min-32-characters>
INTERNAL_SERVICE_TOKEN=<service-to-service-token>

# External APIs
OSRM_BASE_URL=http://router.project-osrm.org
```

**Frontend (.env.development):**
```bash
# Customer App
PORT=4000
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_SOCKET_URL=http://localhost:3000

# Driver App
PORT=4001
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_SOCKET_URL=http://localhost:3000

# Admin Dashboard  
PORT=4002
REACT_APP_API_URL=http://localhost:3000/api
```

---

## 📚 Documentation Links

### Frontend
- [Customer App Guide](apps/customer-app/README.md)
- [Driver App Guide](apps/driver-app/README.md)
- [Admin Dashboard Guide](apps/admin-dashboard/README.md)
- [Frontend Development Guide](FRONTEND-DEVELOPMENT-GUIDE.txt)

### Backend
- [Shared Library](shared/README.md)
- [Database Reset Guide](scripts/DATABASE_RESET.md)
- [Backend Test Report](tests/comprehensive-test-report.txt)

### Setup
- [Apps Setup Guide](apps/SETUP-GUIDE.md)

---

## 🔐 Security

### Authentication Flow
1. User logs in → Auth Service validates credentials
2. Auth Service issues JWT access token (15min) + refresh token (7 days)
3. Client stores tokens (localStorage/AsyncStorage)
4. Client sends access token in Authorization header
5. API Gateway validates JWT on every request
6. When access token expires, client uses refresh token to get new access token
7. Refresh tokens are rotated on each use

### Security Best Practices
- ✅ All passwords hashed with bcrypt
- ✅ JWT tokens with short expiration
- ✅ Refresh token rotation
- ✅ Rate limiting on API Gateway
- ✅ CORS properly configured
- ✅ Helmet.js for security headers
- ✅ Environment variables for secrets
- ✅ Database isolation per service
- ✅ Internal service authentication

---

## 🐛 Troubleshooting

### Backend không khởi động

```bash
# Check logs
docker-compose logs -f

# Check database connections
docker exec -it cab-postgres psql -U postgres -c "\l"
docker exec -it cab-mongodb mongosh -u admin -p admin123 --eval "show dbs"

# Rebuild từ đầu
docker-compose down -v
./scripts/rebuild-system.sh
```

### Frontend không kết nối được Backend

```bash
# Verify backend running
curl http://localhost:3000/health

# Check CORS settings in API Gateway
# Check env variables in frontend apps
cat apps/customer-app/.env.development
```

### MongoDB không có collections

MongoDB chỉ tạo database/collections khi có data. Đây là hành vi bình thường. Chạy một vài thao tác để tạo data:
- Gửi notification → notification_db xuất hiện
- Submit review → review_db xuất hiện

### Port đã được sử dụng

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3000
kill -9 <PID>
```

---

## 🤝 Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---


