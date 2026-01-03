# CHƯƠNG 6: REAL-TIME & THIẾT KẾ DỮ LIỆU

---

## 6.1. Mục Tiêu Real-time

Hệ thống Cab Booking yêu cầu cập nhật liên tục:
- Vị trí tài xế (GPS) gần thời gian thực
- Trạng thái chuyến đi (Ride state)
- Thông báo hệ thống (assignment, payment)

Chỉ tiêu gợi ý cho khóa luận:
- GPS latency mục tiêu: < 1 giây
- Ride state update: gần tức thời (sub-second)

---

## 6.2. Kiến Trúc WebSocket / Socket.IO

### 6.2.1. Chọn Socket.IO hay WebSocket thuần

- **Socket.IO**: hỗ trợ reconnect, rooms, fallback transports, phù hợp demo.
- **WebSocket thuần**: đơn giản hơn về protocol nhưng phải tự quản reconnect/rooms.

Khuyến nghị: Socket.IO để tập trung vào kiến trúc và nghiệp vụ.

### 6.2.2. Notification Service là WebSocket Gateway

Notification Service:
- nhận domain events từ RabbitMQ
- fan-out tới client qua Socket.IO
- dùng Redis Pub/Sub để scale nhiều replicas

ASCII:

```
RabbitMQ (events)
   ▼
Notification Service (replica 1..N)
   │  (Redis adapter)
   ▼
Redis Pub/Sub  <──►  Notification replicas
   ▼
Socket.IO clients (Customer/Driver/Admin)
```

---

## 6.3. Redis trong hệ thống

Redis được sử dụng cho 3 mục tiêu:

### 6.3.1. Cache

- Cache profile (user/driver) theo `userId/driverId`
- Cache fare policy/surge policy
- Cache kết quả AI (ETA/driver candidates) TTL ngắn

### 6.3.2. Pub/Sub để scale realtime

- Notification replicas sử dụng Redis adapter:
  - event emit trên node A vẫn đến client đang kết nối node B

### 6.3.3. Geo-location (Redis GEO)

Driver Service lưu driver online location:
- Key: `drivers:geo:online`
- Commands:
  - `GEOADD` (driverId, lat, lng)
  - `GEORADIUS`/`GEOSEARCH` để tìm driver gần pickup

Gợi ý policy:
- update location mỗi 1–2 giây
- chỉ lưu driver Online
- nếu `lastSeen` quá TTL (ví dụ 10–30s) thì remove khỏi geo set

---

## 6.4. Chiến Lược Realtime Data (GPS)

### 6.4.1. Tần suất gửi GPS

- Driver app gửi 1 giây/ lần (có thể giảm 2–3 giây để tiết kiệm)
- Throttling theo khoảng cách: chỉ gửi nếu thay đổi > X mét

### 6.4.2. Fan-out strategy

Không broadcast GPS tới tất cả người dùng.
Chỉ phát tới:
- room `ride:{rideId}` cho customer/driver trong chuyến
- hoặc `user:{userId}` cho thông báo cá nhân

### 6.4.3. Data minimization

Tránh đẩy dữ liệu nhạy cảm:
- chỉ gửi lat/lng, heading, speed (tối giản)
- không gửi PII không cần thiết

---

## 6.5. Thiết Kế Dữ Liệu Theo Từng Service

### 6.5.1. PostgreSQL – Ride

Bảng chính:
- `rides`: trạng thái hiện tại + pickup/dropoff
- `ride_state_transitions`: lịch sử chuyển trạng thái (audit)

Vì hệ thống là event-driven, bảng transitions hỗ trợ:
- audit trail
- debugging
- reporting

### 6.5.2. PostgreSQL – Payment

- `fares`: breakdown giá
- `payments`: trạng thái thanh toán
- (optional) `outbox_events`: outbox pattern

### 6.5.3. MongoDB – Auth/User

- schema linh hoạt cho profile
- dễ mở rộng field (avatar, preferences)

### 6.5.4. MongoDB – Driver

- driver profile (vehicle, license)
- verification info

---

## 6.6. Data Consistency & Read Models

### 6.6.1. Eventual Consistency

Giữa Ride và Payment:
- Ride hoàn thành trước, Payment xử lý sau
- UI có thể hiển thị “Payment pending”

### 6.6.2. Denormalization (trong phạm vi khóa luận)

Một số service có thể lưu “bản sao tối giản” để đọc nhanh:
- Notification lưu `userId → socketIds` trong Redis
- Payment lưu `rideId` + minimal ride info nếu cần

Nguyên tắc: bản sao chỉ dùng để đọc, authoritative source vẫn là service chủ sở hữu.

---

## 6.7. Data Retention & Logging

Gợi ý cho khóa luận:
- GPS raw data không lưu dài hạn; chỉ lưu last-known location
- Ride history và payment lưu theo yêu cầu báo cáo
- Logs tách riêng khỏi business DB (centralized logging ở Chương 9)

---

## 6.8. Kết Luận Chương

Chương 6 đã:
- Thiết kế realtime bằng Socket.IO và Notification Service
- Mô tả Redis cho cache, Pub/Sub, Geo-location
- Trình bày thiết kế dữ liệu theo database-per-service và các nguyên tắc consistency

---

*Tiếp theo: [Chương 7 - Deployment Architecture (Docker Swarm)](./07-DEPLOYMENT-ARCHITECTURE.md)*
