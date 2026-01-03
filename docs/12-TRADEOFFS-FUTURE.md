# CHƯƠNG 12: TRADE-OFFS, HẠN CHẾ VÀ HƯỚNG MỞ RỘNG

---

## 12.1. Trade-offs Kiến Trúc

### 12.1.1. Microservices vs Monolith

**Ưu điểm (microservices):**
- Tách biệt domain rõ ràng (phù hợp DDD)
- Scale độc lập theo tải từng service
- Dễ trình bày kiến trúc phân tán cho khóa luận

**Nhược điểm:**
- Độ phức tạp vận hành cao hơn (network, broker, observability)
- Debugging khó hơn nếu thiếu tracing
- Eventual consistency cần thiết kế cẩn thận

---

## 12.2. Trade-offs Công Nghệ

### 12.2.1. Docker Swarm vs Kubernetes

**Swarm (đã chọn):**
- Setup đơn giản, phù hợp thời gian khóa luận
- Native Docker, ít thành phần

**Kubernetes:**
- Mạnh hơn về ecosystem và production patterns
- Tuy nhiên học và vận hành phức tạp hơn

Kết luận: Swarm là lựa chọn hợp lý cho mục tiêu học thuật trong phạm vi đề tài.

### 12.2.2. RabbitMQ vs Kafka

- RabbitMQ: đơn giản, phù hợp event-driven ở quy mô nhỏ
- Kafka: tốt cho throughput lớn, retention và replay

Trong đề tài, RabbitMQ đủ đáp ứng; Kafka là hướng mở rộng.

### 12.2.3. MongoDB + PostgreSQL

- MongoDB: linh hoạt cho user/driver profile
- PostgreSQL: ACID mạnh cho ride/payment

Trade-off: tăng số lượng loại DB → tăng vận hành; nhưng phản ánh đúng yêu cầu “database per service”.

---

## 12.3. Hạn Chế (Limitations)

1) **Eventual consistency**: trạng thái giữa Ride và Payment có độ trễ.
2) **Stateful services** trong Swarm: nếu không cấu hình replication, DB có thể là SPOF.
3) **AI service** mô phỏng: model đơn giản, không có training pipeline đầy đủ.
4) **Distributed tracing** chưa triển khai sâu (có thể mô tả nâng cao).

---

## 12.4. Hướng Mở Rộng (Future Work)

### 12.4.1. Kỹ thuật hệ thống

- Migrate lên Kubernetes + Helm
- Triển khai distributed tracing (OpenTelemetry + Jaeger)
- Triển khai DB replication:
  - PostgreSQL replication
  - MongoDB replica set
  - Redis Sentinel/Cluster

### 12.4.2. Nghiệp vụ

- Đánh giá tài xế/chuyến đi (rating system)
- Pricing policy nâng cao (phí hủy, phí chờ)
- Fraud detection (consumer mới từ event bus)

### 12.4.3. AI/ML

- Pipeline training định kỳ
- Feature store
- Monitoring drift và A/B testing

---

## 12.5. Kết Luận

Tài liệu đã thiết kế hệ thống Cab Booking theo hướng microservices + DDD + event-driven, có kiến trúc triển khai Swarm và các khía cạnh vận hành (CI/CD, monitoring, security, failure handling). Các trade-offs và hướng mở rộng giúp định vị phạm vi khóa luận, đồng thời mở đường cho các nghiên cứu tiếp theo.

---

*Kết thúc tài liệu thiết kế.*
