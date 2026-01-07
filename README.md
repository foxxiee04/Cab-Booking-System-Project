# Cab Booking System (KLTN2025)

Hệ thống đặt xe theo kiến trúc microservices, hướng domain (DDD-lite) và event-driven (RabbitMQ). Repo được tổ chức dạng monorepo (npm workspaces) gồm backend services, frontend apps và shared packages.

## Tổng quan kiến trúc

- API Gateway: auth middleware, rate limiting, route/proxy sang các services
- Event bus: RabbitMQ (domain events)
- Realtime: Notification Service + Socket.IO
- Datastores:
  - MongoDB: Auth/Driver
  - PostgreSQL + Prisma: Ride/Payment
  - Redis: cache/geo/pubsub

## Cấu trúc repo

```
.
├── services/                 # Backend microservices
├── frontend/                 # Next.js apps (customer/driver/admin)
├── shared/                   # Shared TS package(s)
├── scripts/                  # Helper scripts (Swarm, smoke test, init DB)
├── monitoring/               # Prometheus config
├── docker-compose.yml
├── docker-stack.yml
└── package.json              # Root (npm workspaces)
```

Ghi chú: `docs/` là tài liệu nội bộ và đang được ignore bởi `.gitignore`.

## Yêu cầu môi trường

- Node.js 20+
- Docker + Docker Compose
- Python 3.11+ (chỉ cần khi chạy AI service locally)

## Cài đặt

```bash
npm install
```

Tạo file môi trường:

```bash
# PowerShell
Copy-Item .env.example .env
```

Điền các biến bắt buộc trong `.env` (xem `docker-compose.yml` để biết danh sách).

## Chạy bằng Docker Compose (khuyến nghị)

```bash
npm run docker:build
npm run docker:up

# logs
npm run docker:logs

# stop
npm run docker:down
```

## Chạy local (dev)

Chạy từng service (mở nhiều terminal):

```bash
npm run dev:auth
npm run dev:ride
npm run dev:driver
npm run dev:payment
npm run dev:notification
npm run dev:gateway

# AI service
npm run dev:ai
```

Chạy frontend:

```bash
npm run dev:frontend:customer
npm run dev:frontend:driver
npm run dev:frontend:admin
```

## Prisma notes (Ride/Payment)

Vì monorepo, Prisma Client của Ride và Payment được generate vào thư mục riêng để tránh ghi đè lẫn nhau:

- Ride: `services/ride-service/src/generated/prisma-client`
- Payment: `services/payment-service/src/generated/prisma-client`

## Testing

```bash
# chạy toàn repo
npm test

# chạy riêng từng workspace
npm run test:auth
npm run test:ride

# coverage
npm run test:coverage
```

## Monitoring (Docker)

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3100
- RabbitMQ Management: http://localhost:15672

## License

MIT



