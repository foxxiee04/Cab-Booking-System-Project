# Monitoring — Health Check Map

Mỗi service expose `GET /health` (HTTP) hoặc gRPC `Check`; Docker dùng để decide healthy/unhealthy; gateway aggregate cho admin dashboard.

```mermaid
graph TB
    subgraph Health["Health Check Layers"]
        direction TB

        subgraph L1["Layer 1 — Liveness (Docker)"]
            HC_GW["api-gateway<br/>HEALTHCHECK GET /health<br/>interval 30s · timeout 5s"]
            HC_SVC["service container<br/>HEALTHCHECK<br/>(per service)"]
            HC_PG["cab-postgres<br/>pg_isready"]
            HC_MONGO["cab-mongodb<br/>mongosh ping"]
            HC_REDIS["cab-redis<br/>redis-cli PING"]
            HC_MQ["cab-rabbitmq<br/>rabbitmq-diagnostics ping"]
        end

        subgraph L2["Layer 2 — Readiness (App)"]
            EP_GW["GW /health<br/>{ status, uptime, services: {auth,ride,...} }"]
            EP_AUTH["auth /health<br/>{ db: ok, redis: ok }"]
            EP_PAY["payment /health<br/>{ db, momo, vnpay reachable }"]
            EP_WAL["wallet /health<br/>{ db, mq, balance.singleton }"]
            EP_OTHER["8 service khác /health"]
        end

        subgraph L3["Layer 3 — Aggregator (Admin)"]
            ADMIN_HC["GET /api/admin/health<br/>(gateway aggregator)"]
            DASH["Admin Dashboard<br/>System Status panel"]
        end
    end

    HC_GW -->|"checks"| EP_GW
    HC_SVC -->|"checks each"| EP_OTHER

    EP_GW -->|"calls all services"| EP_AUTH
    EP_GW --> EP_PAY
    EP_GW --> EP_WAL
    EP_GW --> EP_OTHER

    ADMIN_HC --> EP_GW
    DASH --> ADMIN_HC

    HC_PG -.->|"depends_on:condition: service_healthy"| HC_SVC
    HC_MONGO -.-> HC_SVC
    HC_REDIS -.-> HC_SVC
    HC_MQ -.-> HC_SVC

    style L1 fill:#fff3e0
    style L2 fill:#e8efff
    style L3 fill:#e8f5e9
```

## Health endpoint contract

```typescript
// Mỗi service cài đặt:
GET /health
→ 200 OK
{
  "status": "healthy" | "degraded" | "unhealthy",
  "service": "wallet-service",
  "version": "1.0.0",
  "uptime_sec": 12345,
  "checks": {
    "database": { "status": "ok", "latency_ms": 3 },
    "rabbitmq": { "status": "ok" },
    "merchant_balance_singleton": { "status": "ok", "id": 1 }
  }
}
→ 503 Service Unavailable (nếu critical dependency fail)
```

## Docker compose healthcheck

```yaml
# Ví dụ trong docker-compose.yml
api-gateway:
  healthcheck:
    test: ["CMD", "curl", "-fsS", "http://localhost:3000/health"]
    interval: 30s
    timeout: 5s
    retries: 3
    start_period: 20s
  depends_on:
    cab-postgres:
      condition: service_healthy
    cab-redis:
      condition: service_healthy
    cab-rabbitmq:
      condition: service_healthy
```

## Service dependencies (start order)

| Layer | Services | Depends on |
|-------|---------|-----------|
| L0 (Infra) | postgres, mongo, redis, rabbitmq | — |
| L1 (Core) | auth-service | postgres |
| L2 (Domain) | ride/driver/payment/wallet/booking/pricing/user | postgres + L1 |
| L3 (Engagement) | notification, review | mongo + rabbitmq |
| L4 (Edge) | api-gateway | L1+L2+L3 healthy |
| L5 (Optional) | ai-service | — (start last, optional) |

→ Compose chờ L0 healthy → start L1 → L2 ... → đảm bảo no race.
