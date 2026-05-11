# Monitoring — Logs Flow

Pipeline thu log: app code → stdout → Docker daemon → tooling (tail / aggregator). Hiện tại không có ELK, dùng `docker logs` trực tiếp + structured JSON line.

```mermaid
graph LR
    subgraph App["Application Layer"]
        direction TB
        SVC["Microservice<br/>(11 services)"]
        LOGGER["winston / pino logger<br/>JSON line format<br/>level: info/warn/error"]
        SVC --> LOGGER
    end

    subgraph Docker["Container Runtime"]
        direction TB
        STDOUT["container stdout/stderr"]
        DLOG["Docker logging driver<br/>(json-file default)"]
        FS[("/var/lib/docker/containers/<br/>{id}/{id}-json.log")]
        LOGGER -->|console.log| STDOUT
        STDOUT --> DLOG
        DLOG --> FS
    end

    subgraph Tools["Operator Tools"]
        direction TB
        DLOGS["docker logs cab-{svc} --tail N -f"]
        DCOMP["docker compose logs -f"]
        SWARM["docker service logs cab_{svc}"]
    end

    subgraph Future["Future / Optional Aggregator"]
        FLUENT["Fluent Bit<br/>(sidecar / DaemonSet)"]
        ELK["Elasticsearch<br/>+ Kibana"]
        LOKI["Grafana Loki<br/>(lighter alt)"]
    end

    FS --> DLOGS
    FS --> DCOMP
    FS --> SWARM
    FS -.->|proposed| FLUENT
    FLUENT -.-> ELK
    FLUENT -.-> LOKI

    style Future fill:#fff3e0,stroke:#d97706,stroke-dasharray: 5 5
```

## Patterns đang dùng

| Need | Command |
|------|---------|
| Lấy OTP dev | `docker logs cab-auth-service 2>&1 \| grep OTP \| tail -1` |
| Theo dõi gateway realtime | `docker logs cab-api-gateway --tail 50 -f` |
| Tìm error 500 hôm nay | `docker logs cab-payment-service --since 24h \| grep -i error` |
| Driver matching trace | `docker logs cab-api-gateway \| grep DISPATCH` |
| Full stack tail (compose) | `docker compose logs -f --tail=20` |

## Log levels & cấu trúc

```json
{
  "timestamp": "2026-05-10T12:34:56.789Z",
  "level": "info",
  "service": "ride-service",
  "event": "ride.transition",
  "rideId": "abc-123",
  "from": "FINDING_DRIVER",
  "to": "ASSIGNED",
  "driverId": "drv-789",
  "elapsedMs": 4521
}
```

- **Levels**: `error` (cần alert) · `warn` (degraded) · `info` (business event) · `debug` (dev-only, OFF in prod)
- **Correlation**: `requestId` được injected từ gateway, propagate qua tất cả service via header `x-request-id`
- **Sensitive data**: passwords, OTP, tokens **không bao giờ log** (LoggerService có sanitizer)

## Limitations hiện tại

- Không có centralized search → tìm event cross-service phải `grep` qua nhiều container
- Không có retention policy → Docker `json-file` mặc định không rotate; cần `--log-opt max-size=10m max-file=5`
- Không có alerting → cần Fluent Bit + Loki + Grafana Alert (đề xuất)
