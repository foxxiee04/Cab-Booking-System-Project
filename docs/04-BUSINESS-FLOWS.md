# CHƯƠNG 4: THIẾT KẾ LUỒNG NGHIỆP VỤ END-TO-END

---

## 4.1. Nguyên Tắc Thiết Kế Luồng

- Mỗi use case được mô tả theo góc nhìn **end-to-end**, gồm: UI action → API Gateway → Services → Events → Realtime updates.
- Các luồng quan trọng đều có:
  - **Correlation ID** (thường dùng `rideId` hoặc một UUID riêng)
  - **Timeout + retry + fallback** (đặc biệt với AI và Payment)
  - **Idempotency** cho event consumer

---

## 4.2. State Machine của Ride (CORE)

Trạng thái chính:
- `Pending` → `Accepted` → `InProgress` → `Completed`
- `Pending` → `Cancelled`
- `Accepted` → `Cancelled` (theo policy)

ASCII state diagram:

```
          ┌──────────┐
          │  Pending │
          └────┬─────┘
               │ Assign + Accept
               ▼
          ┌──────────┐
          │ Accepted │
          └────┬─────┘
               │ Start ride
               ▼
        ┌─────────────┐
        │ InProgress  │
        └──────┬──────┘
               │ Complete ride
               ▼
          ┌──────────┐
          │ Completed│
          └──────────┘

Cancel transitions:
- Pending → Cancelled
- Accepted → Cancelled
```

---

## 4.3. Luồng 1: Đăng ký / Đăng nhập

### 4.3.1. Đăng ký (Customer/Driver)

1) UI gửi `POST /api/auth/register`
2) API Gateway route → Auth Service
3) Auth Service:
- validate dữ liệu
- hash password
- tạo user, publish `UserRegistered` (optional)
4) Trả về access token + refresh token

### 4.3.2. Đăng nhập

1) UI gửi `POST /api/auth/login`
2) Auth Service verify credentials
3) Trả về:
- `accessToken` (JWT)
- `refreshToken`

---

## 4.4. Luồng 2: Customer đặt xe (Create Ride)

### 4.4.1. Sequence (mô tả)

```
Customer UI
  │ 1) POST /api/rides
  ▼
API Gateway (JWT verify)
  │ 2) forward request
  ▼
Ride Service
  │ 3) create Ride(Pending)
  │ 4) publish RideCreated
  │ 5) publish RideAssignmentRequested
  ├───────────────► RabbitMQ ────────────────┐
  │                                          │
  ▼                                           ▼
Notification Service (consume)            Driver Service / Matching worker
  │ 6) notify customer "Searching"        │ 7) query available drivers
  │ 7) websocket push                     │ 8) (optional) call AI Service
  ▼                                       │ 9) publish suggestion/assign command
Customer sees status                      ▼
                                       Ride Service assigns driver
                                         │ publish RideAssigned
                                         ▼
                                      Notification push to customer & driver
```

### 4.4.2. Trách nhiệm của từng service

- **Ride Service**: tạo ride, giữ state machine, phát events.
- **Driver Service**: cung cấp driver availability + location store.
- **AI Service**: trả về danh sách driver candidates/ETA/surge (sync).
- **Notification Service**: realtime push trạng thái đến UI.

### 4.4.3. Fallback khi AI Service lỗi

Nếu AI Service timeout/lỗi:
- Ride/Matching module chuyển sang rule-based:
  - chọn driver gần nhất trong bán kính R bằng Redis Geo
  - loại trừ driver Busy/Offline

---

## 4.5. Luồng 3: Driver nhận chuyến (Accept/Reject)

### 4.5.1. Nhận thông báo chuyến

- Notification Service push event `RideAssigned` đến Driver UI qua WebSocket.

### 4.5.2. Driver chấp nhận

1) Driver UI gửi `POST /api/rides/{rideId}/accept`
2) Ride Service kiểm tra:
- ride đang ở trạng thái `Pending/Assigned` (tùy mô hình)
- driverId khớp với driver được assign
3) Ride Service cập nhật `Accepted`, publish `RideAccepted`
4) Notification push tới Customer: “Driver accepted”
5) Driver Service set driver Busy (sync API) hoặc async event `DriverBecameBusy`

### 4.5.3. Driver từ chối

- Driver UI `POST /api/rides/{rideId}/reject`
- Ride Service ghi nhận, publish `RideAssignmentRequested` lại cho vòng matching tiếp theo.

---

## 4.6. Luồng 4: Tracking GPS & trạng thái realtime

### 4.6.1. Driver gửi GPS

1) Driver App định kỳ (ví dụ 1 giây) gửi location:
- WebSocket event: `driver.location.update`
- hoặc REST: `POST /api/drivers/me/location`

2) Driver Service:
- cập nhật Redis Geo `drivers:geo:online`
- publish `DriverLocationUpdated` (tùy chiến lược)

3) Notification Service:
- subscribe `DriverLocationUpdated`
- broadcast đến room của ride/customer

### 4.6.2. Room strategy (Socket.IO)

- Room theo `ride:{rideId}`
- Room theo `user:{userId}` (notifications cá nhân)

---

## 4.7. Luồng 5: Start ride → Complete ride

### 4.7.1. Start ride

1) Driver UI gọi `POST /api/rides/{rideId}/start`
2) Ride Service chuyển trạng thái `InProgress`, publish `RideStarted`
3) Notification push tới customer

### 4.7.2. Complete ride

1) Driver UI gọi `POST /api/rides/{rideId}/complete`
2) Ride Service chuyển `Completed`, publish `RideCompleted`
3) Payment Service consume `RideCompleted`:
- tính cước (fare)
- tạo payment
- thực hiện bước thanh toán (mock)
- publish `PaymentCompleted` hoặc `PaymentFailed`
4) Notification push kết quả payment

---

## 4.8. Luồng 6: Payment Saga (event-driven)

### 4.8.1. Choreography Saga

```
Ride Service: publish RideCompleted
  ▼
RabbitMQ
  ▼
Payment Service:
  - calculate fare
  - create Payment(Pending)
  - capture (mock)
  - publish PaymentCompleted/PaymentFailed
  ▼
Notification Service:
  - push receipt/failed notice
```

### 4.8.2. Payment timeout & retry

Nếu payment gateway mô phỏng trả chậm:
- Payment Service áp dụng timeout (ví dụ 3–5s)
- Retry có backoff (ví dụ 3 lần)
- Sau retry thất bại: publish `PaymentFailed`

---

## 4.9. Luồng 7: Hủy chuyến

### 4.9.1. Customer hủy khi Pending

1) UI `POST /api/rides/{rideId}/cancel`
2) Ride Service set `Cancelled`, publish `RideCancelled`
3) Driver Service nếu đã assign: release driver
4) Notification push thông báo

### 4.9.2. Customer hủy khi Accepted

Áp dụng policy (ví dụ):
- nếu driver chưa đến điểm đón: cho phép hủy
- nếu driver đã gần/đã tới: có thể tính phí hủy (optional – mô phỏng)

---

## 4.10. Luồng Admin Dashboard (tóm tắt)

Admin chủ yếu đọc dữ liệu và thao tác quản trị:
- Quản lý user/driver
- Xem danh sách rides/payments
- Thiết lập policy (fare policy, surge policy)

Trong khóa luận, ưu tiên mô tả mapping UI → API gateway → service.

---

## 4.11. Kết Luận Chương

Chương 4 đã mô tả:
- Luồng đặt xe end-to-end và cách phối hợp services
- Cơ chế realtime GPS và cập nhật trạng thái
- Saga pattern cho payment và các nhánh lỗi chính (AI timeout, payment failure)

---

*Tiếp theo: [Chương 5 - Frontend Architecture](./05-FRONTEND-ARCHITECTURE.md)*
