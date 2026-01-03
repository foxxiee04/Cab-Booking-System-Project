# CHƯƠNG 5: THIẾT KẾ KIẾN TRÚC FRONTEND

---

## 5.1. Mục Tiêu Thiết Kế

Frontend trong đề tài đóng vai trò:
- Cung cấp UI cho 3 nhóm người dùng: **Customer**, **Driver**, **Admin**
- Thể hiện rõ ràng luồng nghiệp vụ và tương tác real-time
- Mapping rõ **UI Action → API Gateway → Service**

Trong phạm vi khóa luận, frontend là “prototype có cấu trúc tốt”, không yêu cầu UX thương mại.

---

## 5.2. Lựa Chọn Công Nghệ và Kiến Trúc

### 5.2.1. React.js hoặc Next.js

- **React.js SPA**: triển khai đơn giản, phù hợp demo.
- **Next.js**: hỗ trợ SSR/SSG; trong đề tài có thể dùng để:
  - Admin dashboard SSR (loading nhanh, SEO không quan trọng)
  - Customer/Driver vẫn thiên về CSR do realtime

Khuyến nghị: **Next.js** + chia theo apps (hoặc monorepo) để thể hiện kỹ năng hệ thống.

### 5.2.2. Frontend Modules

- **Auth module**: login/register/refresh
- **Ride module**: create ride, ride status, tracking
- **Driver module**: online/offline, accept ride, tracking
- **Admin module**: lists, reports, configuration
- **Realtime module**: WebSocket/Socket.IO client + connection manager

---

## 5.3. Tổ Chức 3 Ứng Dụng Frontend

Có 2 hướng:

**Hướng A – 3 apps riêng (khuyến nghị nếu muốn rõ ràng):**
- `customer-app`
- `driver-app`
- `admin-dashboard`

**Hướng B – 1 app, tách theo role:**
- routing theo `/customer/*`, `/driver/*`, `/admin/*`

Ở mức khóa luận, hướng A giúp trình bày kiến trúc và phân quyền dễ hơn.

---

## 5.4. Mapping UI Action → Backend Service

### 5.4.1. Customer App

| UI Action | API (Gateway) | Service đích | Events/Realtime |
|---|---|---|---|
| Đăng ký | `POST /api/auth/register` | Auth | - |
| Đăng nhập | `POST /api/auth/login` | Auth | - |
| Đặt xe | `POST /api/rides` | Ride | `RideCreated`, WS: status |
| Theo dõi trạng thái | `GET /api/rides/{id}` | Ride | WS: `ride:{id}` |
| Theo dõi GPS tài xế | - | Notification | WS location updates |
| Hủy chuyến | `POST /api/rides/{id}/cancel` | Ride | `RideCancelled` |
| Thanh toán/xem hóa đơn | `GET /api/payments?rideId=` | Payment | `PaymentCompleted` |

### 5.4.2. Driver App

| UI Action | API (Gateway) | Service đích | Events/Realtime |
|---|---|---|---|
| Bật online | `POST /api/drivers/me/online` | Driver | `DriverOnline` |
| Tắt online | `POST /api/drivers/me/offline` | Driver | `DriverOffline` |
| Nhận chuyến | - | Notification | WS: user room |
| Accept | `POST /api/rides/{id}/accept` | Ride | `RideAccepted` |
| Start/Complete | `POST /api/rides/{id}/start|complete` | Ride | events |
| Gửi GPS | `POST /api/drivers/me/location` | Driver | `DriverLocationUpdated` |

### 5.4.3. Admin Dashboard

| UI Action | API (Gateway) | Service đích |
|---|---|---|
| Danh sách users | `GET /api/auth/users` | Auth |
| Danh sách drivers | `GET /api/drivers` | Driver |
| Danh sách rides | `GET /api/rides` | Ride |
| Danh sách payments | `GET /api/payments` | Payment |
| Cấu hình fare policy | `PUT /api/payments/policy` | Payment |

---

## 5.5. Real-time Client Design (Socket.IO)

### 5.5.1. Connection Manager

Frontend có một lớp quản lý kết nối:
- tự động reconnect
- attach JWT khi handshake
- join rooms theo `userId` và `rideId`

Gợi ý event naming:
- `ride.status.changed`
- `ride.driver.location`
- `notification.new`

### 5.5.2. State Management

- Client state (UI): Zustand/Redux
- Server state (API fetch): React Query
- Realtime events cập nhật trực tiếp cache (invalidate/refetch hoặc patch state)

---

## 5.6. Trang/Màn Hình Tối Thiểu (Prototype)

### 5.6.1. Customer App

- Login/Register
- Home (map + pickup/dropoff)
- Searching/Matching screen
- Ride tracking screen (status + driver location)
- Ride history

### 5.6.2. Driver App

- Login
- Online/Offline toggle
- Incoming ride request
- Navigation/tracking view
- Trip summary

### 5.6.3. Admin Dashboard

- Overview dashboard (counts)
- Users/Drivers list
- Rides list
- Payments list

---

## 5.7. Kết Luận Chương

Chương 5 đã:
- Xác định kiến trúc frontend và cách tổ chức 3 ứng dụng theo role
- Mapping rõ UI actions đến API Gateway và microservices
- Mô tả thiết kế realtime client và state management

---

*Tiếp theo: [Chương 6 - Real-time & Data](./06-REALTIME-DATA.md)*
