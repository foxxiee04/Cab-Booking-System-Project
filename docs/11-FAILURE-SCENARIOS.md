# CHƯƠNG 11: PHÂN TÍCH FAILURE SCENARIOS

---

## 11.1. Mục Tiêu

Trong hệ thống phân tán, lỗi là điều bình thường. Mục tiêu chương này:
- Xác định các kịch bản lỗi quan trọng theo yêu cầu đề tài
- Phân tích nguyên nhân – ảnh hưởng – cách xử lý
- Đưa ra cơ chế degradation và phục hồi phù hợp với Docker Swarm

---

## 11.2. Kịch Bản 1: Auth Service Down

### Nguyên nhân
- Container crash do bug
- MongoDB down làm Auth không sẵn sàng
- Network partition

### Ảnh hưởng
- Người dùng không thể login/refresh token
- Các API yêu cầu auth có thể bị chặn tại gateway
- Người dùng đã có access token còn hạn vẫn có thể gọi API (tùy thiết kế)

### Cách xử lý
- **Swarm self-healing**: restart container
- **Replicas** cho Auth Service
- **Gateway degradation**:
  - Nếu Auth down, vẫn cho phép các request với access token hợp lệ (verify signature bằng key local/JWKS cache)
  - Tạm thời disable refresh endpoint
- **Monitoring**:
  - alert khi error rate login tăng

---

## 11.3. Kịch Bản 2: Payment Timeout

### Nguyên nhân
- External payment mock phản hồi chậm
- Network lỗi giữa Payment Service và dependency

### Ảnh hưởng
- Ride đã Completed nhưng payment không hoàn tất
- UI hiển thị trạng thái payment “pending” lâu

### Cách xử lý
- **Timeout** cho outbound calls
- **Retry** có backoff và giới hạn số lần
- **Saga behavior**:
  - publish `PaymentFailed` nếu hết retry
  - cho phép người dùng “retry payment” (mức mô tả)
- **Outbox pattern** (nếu triển khai): đảm bảo event không mất

---

## 11.4. Kịch Bản 3: AI Service Lỗi

### Nguyên nhân
- FastAPI crash
- Model inference chậm
- Resource thiếu

### Ảnh hưởng
- Matching driver/ETA/surge bị chậm
- Có thể làm chậm flow đặt xe nếu ride phụ thuộc sync vào AI

### Cách xử lý
- **Circuit breaker** tại Ride/Matching module
- **Timeout ngắn** (ví dụ < 1s)
- **Fallback rule-based**:
  - chọn driver gần nhất từ Redis Geo
  - surge multiplier = 1.0
  - ETA dùng heuristic theo distance
- **Degrade gracefully**: không chặn create ride

---

## 11.5. Kịch Bản 4: WebSocket mất kết nối

### Nguyên nhân
- Mạng client yếu
- Notification service restart
- Load balancer routing thay đổi

### Ảnh hưởng
- Customer/Driver không nhận cập nhật realtime
- UX giảm (không thấy GPS/trạng thái tức thời)

### Cách xử lý
- **Socket.IO auto-reconnect**
- **Client fallback polling**:
  - định kỳ gọi `GET /api/rides/{id}` khi WS disconnected
- **Redis Pub/Sub adapter** để scale và giảm mất message khi đổi replica
- **Message ordering**:
  - gắn sequence hoặc timestamp để UI ignore events cũ

---

## 11.6. Kịch Bản 5: Node trong Swarm bị crash

### Nguyên nhân
- VM shutdown/crash
- Network partition
- Disk full

### Ảnh hưởng
- Các tasks đang chạy trên node đó bị mất
- Nếu node chứa database stateful → nguy cơ downtime dữ liệu

### Cách xử lý
- **Swarm rescheduling**:
  - services stateless sẽ được schedule sang node khác
  - đảm bảo replicas >= 2 cho stateless
- **Stateful services**:
  - trong khóa luận có thể chấp nhận SPOF cho DB để đơn giản
  - mô tả hướng nâng cao: replication (Postgres replica set), Mongo replica set, Redis sentinel/cluster
- **Monitoring**:
  - alert node down
  - capacity planning

---

## 11.7. Tổng Kết Biện Pháp Phòng Thủ

| Failure type | Biện pháp chính |
|---|---|
| Service crash | replicas + restart policy + healthchecks |
| Dependency slow/down | timeout + retry + circuit breaker |
| Event duplication | consumer idempotency |
| WS disconnect | reconnect + polling fallback |
| Node crash | swarm reschedule + replicas |

---

## 11.8. Kết Luận Chương

Chương 11 đã phân tích 5 kịch bản lỗi bắt buộc và đưa ra hướng xử lý phù hợp với kiến trúc microservices + Swarm.

---

*Tiếp theo: [Chương 12 - Trade-offs & Future Work](./12-TRADEOFFS-FUTURE.md)*
