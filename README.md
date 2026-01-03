# Cab Booking System

A comprehensive microservices-based cab booking platform built with Domain-Driven Design (DDD) principles, event-driven architecture, and deployed on Docker Swarm.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              API Gateway                                │
│                    (Authentication, Rate Limiting, Routing)             │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
    ┌─────────────┬──────────────┬────┴────┬──────────────┬─────────────┐
    │             │              │         │              │             │
    ▼             ▼              ▼         ▼              ▼             ▼
┌───────┐   ┌─────────┐   ┌──────────┐ ┌─────────┐ ┌────────────┐ ┌────────┐
│ Auth  │   │  Ride   │   │  Driver  │ │ Payment │ │Notification│ │   AI   │
│Service│   │ Service │   │ Service  │ │ Service │ │  Service   │ │Service │
└───┬───┘   └────┬────┘   └────┬─────┘ └────┬────┘ └─────┬──────┘ └───┬────┘
    │            │             │            │            │            │
    ▼            ▼             ▼            ▼            ▼            ▼
┌────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌─────────┐
│MongoDB │  │PostgreSQL│  │MongoDB  │  │PostgreSQL│  │ Redis   │  │  Redis  │
│(Users) │  │ (Rides)  │  │(Drivers)│  │(Payments)│  │ Pub/Sub │  │  (Geo)  │
└────────┘  └──────────┘  └─────────┘  └──────────┘  └─────────┘  └─────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │          RabbitMQ                 │
                    │   (Event Bus - Domain Events)     │
                    └───────────────────────────────────┘
```
## 🚀 Tech Stack

### Backend Services
- **Node.js 20.x** + **TypeScript 5.x** - Runtime & Language
- **Express.js 4.x** - Web Framework
- **Prisma ORM** - PostgreSQL Database Access
- **Mongoose** - MongoDB ODM
- **FastAPI (Python)** - AI Service

### Databases
- **PostgreSQL 16** - Rides, Payments (Transactional)
- **MongoDB 7** - Users, Drivers (Document Store)
- **Redis 7** - Cache, Geo-location, Pub/Sub

### Messaging & Real-time
- **RabbitMQ 3.12** - Event Bus (Topic Exchange)
- **Socket.IO 4.x** - Real-time Notifications

### Infrastructure
- **Docker** & **Docker Compose** - Containerization
- **Docker Swarm** - Orchestration
- **Prometheus** + **Grafana** - Monitoring

## 📁 Project Structure

```
cab-booking-system/
├── services/
│   ├── api-gateway/         # Route requests, auth, rate limiting
│   ├── auth-service/        # User authentication, JWT, RBAC
│   ├── ride-service/        # Ride lifecycle (state machine)
│   ├── driver-service/      # Driver management, GPS tracking
│   ├── payment-service/     # Fare calculation, payments (Saga)
│   ├── notification-service/# Socket.IO real-time notifications
│   └── ai-service/          # ML-powered matching, pricing
├── shared/
│   └── types/               # Shared TypeScript types
├── docs/                    # Documentation
├── scripts/                 # Deployment scripts
├── monitoring/              # Prometheus config
├── docker-compose.yml       # Development environment
├── docker-stack.yml         # Production Swarm deployment
└── package.json             # Monorepo root
```

## 🛠️ Development Setup

### Prerequisites
- Node.js 20.x
- Docker & Docker Compose
- Python 3.11 (for AI service)

### Quick Start

```bash
# Clone repository
git clone <repository-url>
cd Cab-Booking-System-Project

# Install dependencies
npm install

# Start infrastructure (databases, message broker)
docker-compose up -d postgres mongodb redis rabbitmq

# Run database migrations
cd services/ride-service && npx prisma migrate dev
cd ../payment-service && npx prisma migrate dev

# Start all services (in separate terminals)
cd services/auth-service && npm run dev
cd services/ride-service && npm run dev
cd services/driver-service && npm run dev
cd services/payment-service && npm run dev
cd services/notification-service && npm run dev
cd services/ai-service && uvicorn app.main:app --reload --port 3006
cd services/api-gateway && npm run dev
```

### Using Docker Compose (Recommended)

```bash
# Create local environment file (required)
# Windows (PowerShell): Copy-Item .env.example .env
# macOS/Linux (bash):  cp .env.example .env

# Build and start all services
docker-compose up --build

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

## 🌐 API Endpoints

### Gateway (Port 3000)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Gateway health check |
| GET | `/health/services` | All services health |

### Auth Service
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/refresh` | Refresh token |
| POST | `/api/auth/logout` | User logout |
| GET | `/api/auth/me` | Get current user |

### Ride Service
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rides` | Create new ride |
| GET | `/api/rides/:id` | Get ride details |
| POST | `/api/rides/:id/accept` | Driver accepts ride |
| POST | `/api/rides/:id/start` | Start ride |
| POST | `/api/rides/:id/complete` | Complete ride |
| POST | `/api/rides/:id/cancel` | Cancel ride |

### Driver Service
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/drivers/register` | Register as driver |
| POST | `/api/drivers/online` | Go online |
| POST | `/api/drivers/offline` | Go offline |
| PUT | `/api/drivers/location` | Update GPS location |
| GET | `/api/drivers/nearby` | Find nearby drivers |

### AI Service
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/ride/estimate` | Estimate ride (distance, fare) |
| POST | `/api/ai/match/drivers` | AI driver matching |
| POST | `/api/ai/surge/pricing` | Get surge pricing |

## 🔄 Event-Driven Architecture

### Domain Events Flow
```
Customer requests ride
        │
        ▼
  [ride.created] ──► Driver Service (find nearby drivers)
        │
        ▼
  [ride.assigned] ──► Notification Service (notify customer & driver)
        │
        ▼
  [ride.accepted] ──► Notification Service (send ETA)
        │
        ▼
  [ride.started] ──► Notification Service (ride tracking)
        │
        ▼
  [ride.completed] ──► Payment Service (calculate fare)
        │
        ▼
  [payment.completed] ──► Notification Service (receipt)
```

## 🐳 Docker Swarm Deployment

### VirtualBox Setup (CentOS)

1. Create 3 VMs (1 Manager, 2 Workers)
2. Run setup script on all nodes:

```bash
# On ALL nodes
./scripts/setup-swarm.sh install

# On MANAGER node
./scripts/setup-swarm.sh init-manager

# On WORKER nodes (use token from manager)
./scripts/setup-swarm.sh join-worker <token> <manager-ip>

# Build and push images (on build machine)
REGISTRY=<your-registry> ./scripts/build-images.sh

# Deploy stack (on manager)
./scripts/setup-swarm.sh deploy
```

### Scaling Services

```bash
# Scale ride service to 5 replicas
docker service scale cab-booking_ride-service=5

# Check service status
docker stack services cab-booking
```

## 📊 Monitoring

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3100 (admin/admin)
- **RabbitMQ Management**: http://localhost:15672 (rabbit/rabbit123)

## 📚 Documentation

Detailed documentation available in `/docs`:
- [System Overview](docs/00-system-overview.md)
- [DDD Analysis](docs/01-ddd-analysis.md)
- [Microservices Architecture](docs/02-microservices-architecture.md)
- [Business Flows](docs/03-business-flows.md)
- [Deployment Architecture](docs/06-deployment-architecture.md)

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
```

## 📝 License

This project is developed as part of a Bachelor's thesis (Khóa luận tốt nghiệp).



