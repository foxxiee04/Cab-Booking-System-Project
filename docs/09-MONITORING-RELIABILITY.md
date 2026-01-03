# CHƯƠNG 9: MONITORING & RELIABILITY

---

## 9.1. Mục Tiêu Observability

Trong hệ thống microservices, cần quan sát được:
- Service health và tài nguyên (CPU/RAM/network)
- Latency/error rate theo endpoint
- Thông lượng events (publish/consume)
- Khả năng truy vết luồng nghiệp vụ (correlation)

Mục tiêu khóa luận:
- Thiết kế được kiến trúc monitoring khả thi trên Docker Swarm
- Có dashboard tổng quan và cảnh báo cơ bản

---

## 9.2. Metrics với Prometheus

### 9.2.1. Thành phần

- **Prometheus server**: scrape metrics endpoints
- **Node Exporter**: metrics cấp máy (VM)
- **cAdvisor** (hoặc docker metrics): metrics container
- **Application metrics**: `/metrics` từ các service

### 9.2.2. Metrics đề xuất

**Gateway**
- request count, latency (P50/P95), status code

**Ride Service**
- số ride tạo/phút
- phân bố trạng thái ride
- thời gian matching driver

**Payment Service**
- payment success/failure rate
- payment latency

**Notification Service**
- connected clients
- message fan-out rate

**RabbitMQ**
- queue depth
- consumer ack rate

---

## 9.3. Visualization với Grafana

Dashboard tối thiểu:
- **System overview**: CPU/RAM/Network per node
- **Service overview**: RPS, latency, error rate
- **Business KPI**: rides created/completed/cancelled, payments success
- **Realtime**: active sockets, location update rate

---

## 9.4. Logging

### 9.4.1. Docker logs (baseline)

- Mỗi container ghi stdout/stderr
- Swarm lưu và xem log qua `docker service logs`

### 9.4.2. Centralized logging (mô tả kiến trúc)

Hai lựa chọn phổ biến:
- **ELK/EFK**: Elasticsearch + (Logstash/Fluentd) + Kibana
- **Grafana Loki**: đơn giản hơn cho khóa luận, tích hợp tốt Grafana

Khuyến nghị học thuật:
- Mô tả Loki architecture (promtail → loki → grafana)
- Trình bày structured logging JSON (timestamp, level, service, correlationId)

---

## 9.5. Reliability Patterns

### 9.5.1. Timeout

Nguyên tắc:
- Mọi outbound call đều có timeout
- Không để request treo vô hạn

Áp dụng:
- Ride → AI service: timeout 300–800ms (demo)
- Payment → mock gateway: timeout 3–5s

### 9.5.2. Retry với backoff

Retry chỉ dùng cho lỗi tạm thời:
- network glitch
- timeout

Không retry cho lỗi logic (4xx).

Backoff:
- exponential backoff + jitter
- giới hạn số lần (ví dụ 3)

### 9.5.3. Circuit Breaker

Mục tiêu:
- tránh “cascading failure” khi downstream bị lỗi

Logic (khái niệm):
- nếu tỷ lệ lỗi vượt ngưỡng trong window N requests → mở circuit
- trong thời gian open → fail fast
- sau cooldown → half-open để thử lại

Áp dụng:
- Ride → AI
- Payment → external payment mock

### 9.5.4. Bulkhead (cách ly tài nguyên)

- tách thread pool/connection pool cho các dependency
- giới hạn concurrency cho từng outbound integration

---

## 9.6. Health Checks & Readiness

Mỗi service cung cấp:
- `GET /health` (liveness)
- `GET /ready` (readiness: DB/broker connected)

Swarm restart policy dựa trên:
- container exit code
- healthcheck (nếu cấu hình)

---

## 9.7. Alerting (mô tả)

Có thể dùng:
- Prometheus Alertmanager

Alerts tối thiểu:
- node down
- service error rate cao
- rabbitmq queue depth tăng bất thường
- payment failure spike

---

## 9.8. Kết Luận Chương

Chương 9 đã:
- Thiết kế monitoring bằng Prometheus + Grafana
- Mô tả logging tập trung (Loki/ELK)
- Trình bày các reliability patterns: timeout, retry, circuit breaker, bulkhead

---

*Tiếp theo: [Chương 10 - Security Architecture](./10-SECURITY-ARCHITECTURE.md)*
