# Monitoring Stack — Cab Booking System

Hệ thống monitoring bao gồm 6 thành phần chạy trong Docker Swarm stack, thu thập metrics và logs từ toàn bộ microservices.

```
┌─────────────────────────────────────────────────────────────────┐
│                      Monitoring Architecture                     │
│                                                                  │
│  Docker Containers / Host OS                                    │
│       │                    │                                    │
│  [Promtail]           [Node Exporter]  [cAdvisor]              │
│  (collect logs)       (host metrics)   (container metrics)      │
│       │                    │                │                   │
│       └─────────┬──────────┘                │                   │
│                 ▼                           ▼                   │
│             [Loki]                    [Prometheus]              │
│          (log storage)               (metrics storage)         │
│                 │                           │                   │
│                 └─────────────┬─────────────┘                   │
│                               ▼                                 │
│                          [Grafana]                              │
│                    http://18.136.250.236:3030                   │
│                    (dashboards + log explorer)                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mục lục

1. [Prometheus](#1-prometheus)
2. [Grafana](#2-grafana)
3. [Loki](#3-loki)
4. [Promtail](#4-promtail)
5. [cAdvisor](#5-cadvisor)
6. [Node Exporter](#6-node-exporter)
7. [Dashboards](#7-dashboards)
8. [Truy cập và sử dụng](#8-truy-cập-và-sử-dụng)
9. [Thêm alert](#9-thêm-alert)

---

## 1. Prometheus

**File:** `prometheus/prometheus.yml`

**Tác dụng:** Thu thập và lưu trữ metrics dạng time-series từ các scrape targets. Là trung tâm của hệ thống metrics.

**Cách hoạt động:**
- Cứ mỗi `scrape_interval: 15s`, Prometheus gọi HTTP đến từng target
- Lưu dữ liệu vào TSDB (Time Series Database)
- Hỗ trợ query bằng ngôn ngữ PromQL

**Scrape targets hiện tại:**

| Job | Target | Metrics thu thập |
|-----|--------|-----------------|
| `prometheus` | prometheus:9090 | Self-monitoring |
| `cadvisor` | cadvisor:8080 | CPU/Memory/Network từng container |
| `node-exporter` | node-exporter:9100 | CPU/Memory/Disk/Network của host EC2 |
| `rabbitmq` | rabbitmq:15692 | Queue depth, consumers, messages/s |
| `api-gateway` | api-gateway:3000/metrics | HTTP requests, AI matching metrics, WebSocket |

**Truy cập:** http://18.136.250.236:9090

**Ví dụ PromQL queries:**
```promql
# CPU usage %
100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory usage %
100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))

# Container memory api-gateway
container_memory_working_set_bytes{name="cab-api-gateway"}

# RabbitMQ messages ready
rabbitmq_queue_messages_ready

# API Gateway AI matching rate
rate(cab_matching_ai_decisions_total[5m])
```

**Thêm scrape target mới:**
```yaml
# Thêm vào prometheus/prometheus.yml
scrape_configs:
  - job_name: my-service
    metrics_path: /metrics
    static_configs:
      - targets: ['my-service:PORT']
        labels:
          service: my-service
```

---

## 2. Grafana

**File:** `grafana/provisioning/datasources/datasources.yml`
**File:** `grafana/provisioning/dashboards/dashboards.yml`
**File:** `grafana/dashboards/*.json`

**Tác dụng:** Visualization platform — hiển thị metrics từ Prometheus và logs từ Loki dưới dạng dashboard trực quan.

**Cách hoạt động:**
- Khi Grafana khởi động, đọc thư mục `provisioning/` để tự cấu hình
- `datasources.yml` → tự thêm Prometheus và Loki làm data source
- `dashboards.yml` → tự load dashboard JSON từ `dashboards/`
- Không cần cấu hình thủ công sau khi deploy

**Provisioning tự động:**
```
/etc/grafana/
├── provisioning/
│   ├── datasources/
│   │   └── datasources.yml   ← Prometheus + Loki tự kết nối
│   └── dashboards/
│       └── dashboards.yml    ← Load từ /etc/grafana/dashboards/
└── dashboards/
    ├── 1-system-overview.json
    ├── 2-containers.json
    ├── 3-application.json
    └── 4-logs.json
```

**Truy cập:** http://18.136.250.236:3030
- Username: `admin`
- Password: xem `GRAFANA_ADMIN_PASSWORD` trong `~/cab-booking/.env`

**Thêm dashboard mới:**
1. Tạo file JSON trong `monitoring/grafana/dashboards/`
2. Commit + push → CI/CD tự copy lên server
3. Grafana tự reload trong vòng 30 giây

**Import dashboard cộng đồng:**
- Grafana → Dashboards → Import → nhập Dashboard ID
- Node Exporter Full: ID `1860`
- Docker cAdvisor: ID `14282`

---

## 3. Loki

**File:** `loki/loki-config.yml`

**Tác dụng:** Log aggregation system — nhận, lưu trữ và cho phép query logs từ tất cả containers. Tương đương Elasticsearch nhưng nhẹ hơn nhiều.

**Cách hoạt động:**
- Nhận logs từ Promtail qua HTTP API
- Lưu logs theo label (service name, container name...)
- Hỗ trợ query bằng LogQL trong Grafana

**Cấu hình hiện tại:**
- Storage: filesystem (`/loki/chunks`) — lưu trên volume Docker
- Schema: TSDB v13 (hiệu quả nhất)
- Replication: 1 (single-node)

**Truy cập:** Không truy cập trực tiếp — dùng qua Grafana → Explore → chọn Loki

**Ví dụ LogQL queries:**
```logql
# Tất cả log từ api-gateway
{service="cab-api-gateway"}

# Tìm lỗi trong tất cả services
{job="docker-containers"} |= "error"

# Log từ ride-service trong 30 phút qua
{service="cab-ride-service"} | json | line_format "{{.log}}"

# Đếm log rate theo service
sum by (service) (rate({job="docker-containers"}[5m]))
```

---

## 4. Promtail

**File:** `promtail/promtail-config.yml`

**Tác dụng:** Log collector — đọc log từ Docker containers và đẩy lên Loki. Chạy trên mỗi node của Swarm.

**Cách hoạt động:**
- Kết nối Docker daemon qua `/var/run/docker.sock`
- Auto-discover tất cả containers đang chạy
- Extract labels từ container metadata (tên container, swarm service)
- Parse Docker JSON log format
- Đẩy log streams lên `http://loki:3100/loki/api/v1/push`

**Labels được gắn vào mỗi log:**
- `service` = tên container (vd: `cab-api-gateway`)
- `swarm_service` = Docker Swarm service name
- `compose_service` = Docker Compose service name

**Volumes cần mount (trong docker-stack):**
```yaml
volumes:
  - /var/lib/docker/containers:/var/lib/docker/containers:ro
  - /var/run/docker.sock:/var/run/docker.sock:ro
```

---

## 5. cAdvisor

**Tác dụng:** Container Advisor — thu thập metrics tài nguyên (CPU, Memory, Network, Disk I/O) của từng Docker container theo thời gian thực.

**Cách hoạt động:**
- Mount vào root filesystem và Docker socket
- Expose metrics tại `:8080/metrics` cho Prometheus scrape
- Chạy ở privileged mode để đọc cgroup data

**Metrics quan trọng:**
| Metric | Ý nghĩa |
|--------|---------|
| `container_cpu_usage_seconds_total` | CPU time tích lũy |
| `container_memory_working_set_bytes` | RAM đang dùng |
| `container_network_receive_bytes_total` | Network RX |
| `container_network_transmit_bytes_total` | Network TX |
| `container_last_seen` | Container còn sống |

**Truy cập:** http://18.136.250.236:8081 (xem raw UI)

---

## 6. Node Exporter

**Tác dụng:** Thu thập metrics của host machine (EC2 instance) — CPU, Memory, Disk, Network, System load.

**Cách hoạt động:**
- Đọc trực tiếp từ `/proc`, `/sys` của Linux
- Expose metrics tại `:9100/metrics` cho Prometheus scrape

**Metrics quan trọng:**
| Metric | Ý nghĩa |
|--------|---------|
| `node_cpu_seconds_total` | CPU time theo mode |
| `node_memory_MemAvailable_bytes` | RAM available |
| `node_filesystem_avail_bytes` | Disk space còn lại |
| `node_network_receive_bytes_total` | Network throughput |
| `node_load1/5/15` | System load average |
| `node_boot_time_seconds` | Uptime |

---

## 7. Dashboards

### Dashboard 1: System Overview (`1-system-overview.json`)

**Mục đích:** Giám sát sức khỏe tổng thể của EC2 instance.

| Panel | Query | Ý nghĩa |
|-------|-------|---------|
| CPU Usage % | `100 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m]))*100` | % CPU đang dùng |
| Memory Usage % | `100*(1-(node_memory_MemAvailable_bytes/node_memory_MemTotal_bytes))` | % RAM đang dùng |
| Disk Usage % | `100 - (avail/total)*100` trên mountpoint `/` | % ổ đĩa đã dùng |
| System Uptime | `time() - node_boot_time_seconds` | Thời gian hoạt động |
| Network I/O | `rate(node_network_receive/transmit_bytes_total[5m])` | Băng thông mạng |
| Load Average | `node_load1/5/15` | Tải hệ thống 1/5/15 phút |

**Khi nào cần chú ý:**
- CPU > 80% liên tục → scale hoặc optimize
- Memory > 85% → nguy cơ OOM
- Disk > 80% → dọn images cũ: `docker image prune -f`

---

### Dashboard 2: Container Resources (`2-containers.json`)

**Mục đích:** Xem CPU/Memory của từng microservice Docker.

| Panel | Ý nghĩa |
|-------|---------|
| Running Containers | Tổng số containers đang chạy |
| CPU per Service | % CPU theo từng service theo thời gian |
| Memory per Service | RAM (bytes) theo từng service |
| Container Restarts | Service nào đang crash/restart |
| Network I/O per Container | Bandwidth từng container |

**Cách dùng:**
- Tìm service dùng nhiều RAM nhất → xem có memory leak không
- Service có nhiều restarts → xem logs: `docker service logs cab-booking_<name>`

---

### Dashboard 3: Application Metrics (`3-application.json`)

**Mục đích:** Metrics nghiệp vụ — RabbitMQ và API Gateway AI matching.

| Panel | Ý nghĩa |
|-------|---------|
| RabbitMQ Messages Ready | Số message đang chờ xử lý trong queue |
| Messages Published/s | Tốc độ publish event |
| Connections & Channels | Số kết nối RabbitMQ |
| AI Matching Decisions | Số lần thuật toán ghép tài xế chạy |
| AI Adjustment Score | Mức điều chỉnh điểm bởi AI |
| AI Latency | Thời gian gọi AI service (ms) |

**Cách dùng:**
- Queue tăng cao → services đang chậm xử lý events
- AI latency > 150ms → AI service quá tải (fallback tự động)

---

### Dashboard 4: Service Logs (`4-logs.json`)

**Mục đích:** Tìm kiếm và phân tích logs từ tất cả services qua Loki.

| Panel | Query | Ý nghĩa |
|-------|-------|---------|
| Error Logs (All) | `{job="docker-containers"} \|= "error"` | Mọi log chứa "error" |
| API Gateway Logs | `{service="cab-api-gateway"}` | Log gateway |
| Auth Service Logs | `{service="cab-auth-service"}` | Log auth |
| Ride Service Logs | `{service="cab-ride-service"}` | Log ride |
| Payment Service Logs | `{service="cab-payment-service"}` | Log payment |
| Log Rate by Service | `sum by (service) (rate(...[5m]))` | Service nào log nhiều nhất |

**Cách dùng:**
1. Mở tab Explore → chọn Loki
2. Tìm lỗi: `{job="docker-containers"} |= "ERROR" | json`
3. Lọc theo service: `{service="cab-ride-service"} | json | line_format "{{.log}}"`

---

## 8. Truy cập và sử dụng

### Grafana

```
URL: http://18.136.250.236:3030
User: admin
Pass: xem GRAFANA_ADMIN_PASSWORD trong ~/cab-booking/.env
```

Sau khi đăng nhập:
1. **Dashboards** → Browse → thấy 4 dashboard đã import tự động
2. **Explore** → chọn Loki → query logs
3. **Explore** → chọn Prometheus → viết PromQL query

### Prometheus

```
URL: http://18.136.250.236:9090
```

- Targets: http://18.136.250.236:9090/targets → xem scrape status
- Graph: viết PromQL query trực tiếp

### Trên server

```bash
# Xem containers monitoring đang chạy
docker stack services cab-booking | grep -E "prometheus|grafana|loki|promtail|cadvisor|node"

# Xem logs Prometheus
docker service logs cab-booking_prometheus --tail 20

# Xem logs Loki
docker service logs cab-booking_loki --tail 20
```

---

## 9. Thêm alert

Grafana hỗ trợ alert qua Email/Slack/Telegram. Ví dụ alert CPU cao:

1. Mở dashboard **System Overview** → panel **CPU Usage %**
2. Edit → Alert → Create alert rule
3. Condition: `WHEN last() OF query(A, 5m, now) IS ABOVE 85`
4. Notification: cấu hình contact point (Email/Slack)

Hoặc dùng Prometheus Alertmanager (nâng cao) — thêm vào `docker-stack.thesis.yml`:
```yaml
alertmanager:
  image: prom/alertmanager
  ports:
    - "9093:9093"
```
