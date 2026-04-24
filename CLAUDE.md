# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

### Development (from repo root)

```bash
# Start full system (Docker)
npm run docker:up

# Start individual backend service in dev mode (hot reload)
npm run dev:gateway
npm run dev:auth
npm run dev:ride
npm run dev:driver
npm run dev:payment
npm run dev:booking
npm run dev:pricing
npm run dev:wallet
npm run dev:user
npm run dev:notification
npm run dev:review

# Start frontend apps (dev servers)
npm run dev:customer      # :4000
npm run dev:driver-app    # :4001
npm run dev:admin         # :4002
npm run dev:frontends     # all three concurrently
```

### Build

```bash
npm run build             # shared + all backend services
npm run build:shared      # shared package only (must build first after shared changes)
```

### Test

```bash
npm run test              # all tests across workspaces
npm run test:unit         # unit tests (--runInBand)
npm run test:contract     # contract tests (driver + ride service)
npm run test:integration  # integration tests via tsx scripts/test-backend.ts
npm run test:coverage     # coverage across all packages

# Run tests for a single service
cd services/auth-service && npm test
cd services/payment-service && npm test
cd services/ride-service && npm test

# Run a single test file
cd services/payment-service && npx jest src/__tests__/full_logic.test.ts

# Smoke tests (requires running stack)
npm run smoke:gateway
npm run smoke:lifecycle
```

### Lint

```bash
npm run lint              # ESLint on all .ts/.tsx files
```

### Database

```bash
npm run db:seed           # seed all databases
bash scripts/reset-database.sh  # full DB reset + re-migrate + seed

# Per-service Prisma (run inside service directory)
npx prisma migrate dev
npx prisma generate
```

### Get OTP in dev (no SMS provider)

```bash
docker logs cab-auth-service 2>&1 | grep OTP
```

---

## Architecture Overview

**Monorepo** with npm workspaces. Structure:
- `services/` — 11 Node.js/TypeScript microservices
- `apps/` — 3 React SPAs (customer, driver, admin)
- `shared/` — shared TypeScript types, gRPC proto definitions
- `scripts/` — DB seed, smoke tests, simulation scripts

### Entry Points and Communication

All client traffic flows through **`api-gateway:3000`** — the only public entry point. It:
- HTTP-proxies to downstream services (see route table in Section 3.1 of this file below)
- Hosts the single Socket.IO server (Redis adapter for horizontal scale)
- Verifies JWT and injects `x-user-id`, `x-user-role`, `x-user-email` headers — downstream services **trust these headers, never re-verify JWT**
- Runs the driver matching/dispatch algorithm

Inter-service communication uses two mechanisms:
1. **RabbitMQ** (`domain-events` topic exchange) — async events between services
2. **gRPC** — low-latency sync calls (pricing, driver lookup, auth validation)

Some services also make direct internal HTTP calls with `x-internal-token` header.

### Service → Port → Database Map

| Service | HTTP Port | gRPC Port | Database |
|---------|-----------|-----------|----------|
| api-gateway | 3000 | — | Redis only |
| auth-service | 3001 | 50051 | `auth_db` (PG) |
| ride-service | 3002 | 50054 | `ride_db` (PG) |
| driver-service | 3003 | 50055 | `driver_db` (PG) |
| payment-service | 3004 | 50056 | `payment_db` (PG) |
| notification-service | 3005 | — | `notification_db` (Mongo) |
| wallet-service | 3006 | — | `wallet_db` (PG) |
| user-service | 3007 | 50052 | `user_db` (PG) |
| booking-service | 3008 | 50053 | `booking_db` (PG) |
| pricing-service | 3009 | 50057 | — (stateless) |
| review-service | 3010 | — | `review_db` (Mongo) |
| ai-service | 8000 | — | — (stateless, Python) |

PostgreSQL runs on host port **5433** (not 5432). All 7 PG databases share one Postgres instance.

### Key Architecture Decisions

**Ride state machine** (`services/ride-service/src/domain/ride-state-machine.ts`): Only transitions listed in `VALID_TRANSITIONS` are allowed. Never update `Ride.status` directly — always go through the state machine.

**Payment idempotency**: Every payment has an `idempotencyKey`. MoMo/VNPay IPN callbacks can fire multiple times — the handler must be idempotent (check existing payment by key before processing).

**Wallet gate**: Before a driver can go online, driver-service calls payment-service to verify `canAcceptRide` (balance > `DEBT_LIMIT`). Cash rides create a debt: driver collects full fare but owes `platformFee` (commission) which is debited from their wallet.

**AI is optional**: All calls to `ai-service` have a 150ms timeout with full fallback. The system works normally without it — only dynamic surge prediction is affected.

**OTP is stdout-only in dev**: `OTP_SMS_MODE=mock` prints OTP to stdout instead of calling Twilio. Never exposed via API.

**gRPC bridge in api-gateway**: `src/grpc/bridge.client.ts` converts HTTP→gRPC for most downstream calls. Exceptions (forced HTTP forward): all auth-service routes, all wallet-service routes, and specific driver `me/*` routes.

**Address normalization**: All incoming address payloads pass through `normalizeAddressPayloadDeep()` in api-gateway before forwarding to services (handles inconsistent Vietnamese address formatting).

### Driver Matching Algorithm

Defined in `api-gateway/src/matching/driver-matcher.ts` + `src/events/consumer.ts`.

Three dispatch rounds expanding radius: `2km×1, 3km×3, 5km×5` (configurable via `MATCHING_ROUNDS` env). Scoring weights: distance 40%, rating 25%, idle time 15%, acceptance rate 15%, cancel rate -5%. If `MATCHING_AI_ADJUSTMENT_ENABLED=true`, accept-probability from ai-service adjusts scores (150ms timeout, fallback to base score).

### Commission & Wallet Flow

After `ride.completed` event:
1. payment-service computes `platformFee = grossFare × commissionRate` and publishes `driver.earnings.settled`
2. wallet-service credits `netEarnings` to driver, records double-entry in `MerchantLedger`, updates singleton `merchant_balance` row

Commission rates: MOTORBIKE/SCOOTER 20%, CAR_4 18%, CAR_7 15%.

### Prisma Pattern

All PG-backed services use Prisma. Generated client is in `src/generated/prisma-client/` per service (not a shared Prisma instance). After schema changes: `npx prisma migrate dev && npx prisma generate` inside the service directory.

### Frontend State Management

All three React apps use Redux Toolkit. Socket.IO connection is initialized once after login and stored in a ref (not Redux state). Map in customer-app uses Leaflet + OpenStreetMap/Nominatim.

---

## Infrastructure (Docker Compose)

```
PostgreSQL :5433   MongoDB :27017   Redis :6379   RabbitMQ :5672/:15672
```

Init SQL at `scripts/init-db.sql` creates all 7 PG databases on first container start.

Services with **root build context** (need `shared/` directory — build from repo root):
`api-gateway`, `auth-service`, `driver-service`, `ride-service`, `pricing-service`

Services with **local build context** (build from service directory):
`booking-service`, `payment-service`, `wallet-service`, `user-service`, `notification-service`, `review-service`
