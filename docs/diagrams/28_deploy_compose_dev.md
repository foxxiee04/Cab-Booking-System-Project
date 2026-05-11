# Deployment — Docker Compose (Dev Environment)

Topology dev local — tất cả service chạy trên 1 máy qua `docker-compose.yml`.

```mermaid
graph TB
    subgraph Host["Developer Host (Windows / macOS / Linux)"]
        direction TB

        subgraph Browsers["Browsers (host)"]
            CH["Chrome :4000<br/>customer-app"]
            DR["Chrome :4001<br/>driver-app"]
            AD["Chrome :4002<br/>admin-dashboard"]
        end

        subgraph DevServers["Vite Dev Servers (host process)"]
            DS1["customer-app vite :4000"]
            DS2["driver-app vite :4001"]
            DS3["admin-dashboard vite :4002"]
        end

        subgraph DockerNet["docker-compose network: cab-net"]
            direction TB

            subgraph Edge["Edge"]
                GW_C["cab-api-gateway<br/>:3000 (host)"]
            end

            subgraph SVC["11 Microservices"]
                AUTH_C["cab-auth-service<br/>:3001 / :50051"]
                RIDE_C["cab-ride-service<br/>:3002 / :50054"]
                DRV_C["cab-driver-service<br/>:3003 / :50055"]
                PAY_C["cab-payment-service<br/>:3004 / :50056"]
                NOTIF_C["cab-notification-service<br/>:3005"]
                WAL_C["cab-wallet-service<br/>:3006"]
                USER_C["cab-user-service<br/>:3007 / :50052"]
                BOOK_C["cab-booking-service<br/>:3008 / :50053"]
                PRIC_C["cab-pricing-service<br/>:3009 / :50057"]
                REV_C["cab-review-service<br/>:3010"]
                AI_C["cab-ai-service<br/>:8000 (Python)"]
            end

            subgraph Stateful["Stateful Services"]
                PG_C[("cab-postgres<br/>:5433 → 5432<br/>7 databases<br/>volume: pg_data")]
                MONGO_C[("cab-mongodb<br/>:27017<br/>2 databases<br/>volume: mongo_data")]
                REDIS_C[("cab-redis<br/>:6379<br/>volume: redis_data")]
                MQ_C[("cab-rabbitmq<br/>:5672 / :15672<br/>volume: mq_data")]
            end
        end
    end

    CH -->|http| DS1
    DR -->|http| DS2
    AD -->|http| DS3

    DS1 -->|proxy /api/*| GW_C
    DS2 -->|proxy /api/*| GW_C
    DS3 -->|proxy /api/*| GW_C

    GW_C -->|HTTP / gRPC| SVC
    SVC --> Stateful
    GW_C --- REDIS_C
    SVC --- MQ_C
    AUTH_C --- PG_C
    RIDE_C --- PG_C
    DRV_C --- PG_C
    PAY_C --- PG_C
    WAL_C --- PG_C
    USER_C --- PG_C
    BOOK_C --- PG_C
    NOTIF_C --- MONGO_C
    REV_C --- MONGO_C
```

## File / config quan trọng

| File | Vai trò |
|------|---------|
| `docker-compose.yml` | Định nghĩa 15 service (11 backend + 4 stateful) |
| `scripts/init-db.sql` | Bootstrap 7 PG database lần đầu start |
| `env/*.env` | Biến môi trường per-service |
| `Dockerfile.root.*` | Multi-stage build dùng workspace root (cần `shared/`) |
| `services/*/Dockerfile` | Dockerfile riêng cho service local-context |

## Lệnh thường dùng

```bash
npm run docker:up                  # bring up toàn bộ stack
docker compose ps                  # check status
docker compose logs -f cab-api-gateway --tail 100
docker compose restart wallet-service  # rebuild after schema change
docker compose down -v             # NUKE everything (volumes too)
```

## Khác biệt với production (Swarm)

| Aspect | Dev (Compose) | Prod (Swarm) |
|--------|---------------|--------------|
| Replicas | 1 per service | N per service (load-balanced) |
| Network | bridge `cab-net` | overlay `swarm-net` (mTLS) |
| Frontend | Vite dev server (host) | Built static + nginx container |
| Reset DB | `compose down -v` | manual SQL drop (xem PHASE 15 trong SWARM-SETUP.md) |
| Logs | `docker compose logs` | `docker service logs` |
