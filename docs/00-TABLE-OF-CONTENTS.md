# THIẾT KẾ HỆ THỐNG CAB BOOKING
## Khóa Luận Tốt Nghiệp - Hệ Thống Thông Tin / Công Nghệ Thông Tin

---

## MỤC LỤC TỔNG QUAN

| STT | Chương | Nội dung | File |
|-----|--------|----------|------|
| 1 | Tổng quan hệ thống | Mô tả big picture, mục tiêu, phạm vi | [01-SYSTEM-OVERVIEW.md](./01-SYSTEM-OVERVIEW.md) |
| 2 | Phân tích DDD | Domain, Bounded Context, Entity, Aggregate | [02-DDD-ANALYSIS.md](./02-DDD-ANALYSIS.md) |
| 3 | Kiến trúc Microservices | Service design, API, Database | [03-MICROSERVICES-ARCHITECTURE.md](./03-MICROSERVICES-ARCHITECTURE.md) |
| 4 | Luồng nghiệp vụ | End-to-end flows, State machine | [04-BUSINESS-FLOWS.md](./04-BUSINESS-FLOWS.md) |
| 5 | Frontend Architecture | React/Next.js, UI mapping | [05-FRONTEND-ARCHITECTURE.md](./05-FRONTEND-ARCHITECTURE.md) |
| 6 | Real-time & Data | WebSocket, Redis, Database design | [06-REALTIME-DATA.md](./06-REALTIME-DATA.md) |
| 7 | Kiến trúc triển khai | Docker Swarm, Deployment | [07-DEPLOYMENT-ARCHITECTURE.md](./07-DEPLOYMENT-ARCHITECTURE.md) |
| 8 | CI/CD Pipeline | GitHub Actions, Automation | [08-CICD-PIPELINE.md](./08-CICD-PIPELINE.md) |
| 9 | Monitoring & Reliability | Prometheus, Grafana, Patterns | [09-MONITORING-RELIABILITY.md](./09-MONITORING-RELIABILITY.md) |
| 10 | Security Architecture | JWT, RBAC, Zero Trust | [10-SECURITY-ARCHITECTURE.md](./10-SECURITY-ARCHITECTURE.md) |
| 11 | Failure Scenarios | Phân tích lỗi, Recovery | [11-FAILURE-SCENARIOS.md](./11-FAILURE-SCENARIOS.md) |
| 12 | Trade-offs & Future | Đánh giá, Hướng mở rộng | [12-TRADEOFFS-FUTURE.md](./12-TRADEOFFS-FUTURE.md) |

---

## THÔNG TIN KHÓA LUẬN

- **Đề tài**: Thiết kế và triển khai hệ thống đặt xe taxi thời gian thực sử dụng kiến trúc Microservices
- **Công nghệ chính**: Node.js, Python (FastAPI), React.js, Docker Swarm
- **Kiến trúc**: Microservices + Event-Driven + Domain-Driven Design
- **Triển khai**: VirtualBox + CentOS + Docker Swarm

---

## STACK CÔNG NGHỆ TỔNG QUAN

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER                              │
├─────────────────────────────────────────────────────────────────────┤
│  React.js/Next.js │ Socket.IO Client │ Redux/Zustand │ Leaflet Maps │
├─────────────────────────────────────────────────────────────────────┤
│                         API GATEWAY                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Kong/Express Gateway │ JWT Auth │ Rate Limiting │ Load Balancing   │
├─────────────────────────────────────────────────────────────────────┤
│                      MICROSERVICES LAYER                            │
├─────────────────────────────────────────────────────────────────────┤
│  Auth    │  Ride    │  Driver  │  Payment │ Notification │   AI     │
│ Service  │ Service  │ Service  │ Service  │   Service    │ Service  │
│ (Node)   │ (Node)   │ (Node)   │ (Node)   │   (Node)     │ (FastAPI)│
├─────────────────────────────────────────────────────────────────────┤
│                      MESSAGE BROKER                                 │
├─────────────────────────────────────────────────────────────────────┤
│  RabbitMQ / Kafka  │  Event Bus  │  Async Communication             │
├─────────────────────────────────────────────────────────────────────┤
│                        DATA LAYER                                   │
├─────────────────────────────────────────────────────────────────────┤
│  PostgreSQL │ MongoDB │ Redis (Cache + Pub/Sub + Geo) │ TimescaleDB │
├─────────────────────────────────────────────────────────────────────┤
│                     INFRASTRUCTURE                                  │
├─────────────────────────────────────────────────────────────────────┤
│  Docker Swarm │ VirtualBox │ CentOS │ Prometheus │ Grafana          │
└─────────────────────────────────────────────────────────────────────┘
```

---

*Tài liệu được cập nhật lần cuối: Tháng 1/2026*
