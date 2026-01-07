# CHƯƠNG 10: SECURITY ARCHITECTURE

---

## 10.1. Mục Tiêu Bảo Mật

- Bảo vệ danh tính người dùng (authentication)
- Phân quyền truy cập (authorization)
- Giảm rủi ro lộ dữ liệu và tấn công phổ biến (rate limit, token theft)
- Mô tả định hướng **Zero Trust** ở mức kiến trúc

---

## 10.2. Authentication – JWT + Refresh Token

### 10.2.1. Access Token (JWT)

- Chứa claims: `sub(userId)`, `role`, `exp`, `iat`
- TTL ngắn để giảm rủi ro (ví dụ 15 phút)

### 10.2.2. Refresh Token

- TTL dài hơn (ví dụ 7–30 ngày)
- Lưu trong DB (Auth Service) để revoke
- Rotation: mỗi lần refresh cấp token mới và vô hiệu token cũ

### 10.2.3. Token Storage (client)

Mức khóa luận:
- web app: lưu access token in-memory; refresh token HttpOnly cookie (khuyến nghị)

---

## 10.3. Authorization – Role-based Access Control (RBAC)

Roles:
- **Customer**: tạo/hủy ride của chính mình, xem lịch sử
- **Driver**: nhận/hoàn tất ride được assign, cập nhật GPS
- **Admin**: quản trị users/drivers, xem báo cáo

Mô hình phân quyền:
- API Gateway kiểm tra role cho route nhạy cảm
- Service vẫn kiểm tra ownership (ví dụ ride.customerId == caller.userId)

---

## 10.4. API Gateway Security Controls

- JWT verification
- Rate limiting theo IP/userId
- Request validation (schema)
- Basic WAF-like checks (mức mô tả)

---

## 10.5. Zero Trust Architecture (mức kiến trúc)

Zero Trust nhấn mạnh:
- Không tin tưởng mặc định bất kỳ network zone nào
- Luôn xác minh danh tính và quyền cho mỗi request
- Giảm “lateral movement” khi một service bị compromise

Áp dụng trong phạm vi khóa luận (conceptual):
1) **Identity everywhere**
- mọi request giữa services có “identity” (service token hoặc mTLS)

2) **Least privilege**
- mỗi service chỉ có quyền truy cập đúng dependency cần thiết

3) **Segmentation**
- `frontend` chỉ expose gateway/ws (publish ports)
- `backend` cho service-to-service (internal overlay)
- database không public

4) **Continuous verification**
- verify token/signature ở gateway và (tối thiểu) ở service

---

## 10.6. Service-to-Service Trust (conceptual)

Trong Swarm, có thể mô tả 2 chiến lược:

### 10.6.1. Shared internal network + service authentication

- Services chỉ giao tiếp qua `backend`
- Mỗi service gọi nhau kèm “service token” (JWT nội bộ) do Auth hoặc hệ thống cấp

Ưu: dễ mô tả/triển khai.
Nhược: chưa mạnh bằng mTLS.

### 10.6.2. mTLS (mô tả như nâng cao)

- Dùng service mesh (ngoài scope) hoặc proxy sidecar
- Mỗi service có cert, verify lẫn nhau

Trong khóa luận: trình bày mTLS như hướng mở rộng.

---

## 10.7. Secrets Management

- Không hard-code secrets trong code
- Dùng `docker secret` cho:
  - JWT signing key
  - DB password
  - RabbitMQ credentials

---

## 10.8. Audit & Security Logging

- Log các hành vi quan trọng:
  - login success/failure
  - role changes
  - payment status changes
- Log theo JSON và có correlationId
- Tránh log PII (số điện thoại đầy đủ, password, token raw)

---

## 10.9. Kết Luận Chương

Chương 10 đã:
- Thiết kế xác thực JWT + refresh token
- Thiết kế RBAC và kiểm tra ownership
- Mô tả Zero Trust và service-to-service trust ở mức kiến trúc

---

*Tiếp theo: [Chương 11 - Failure Scenarios](./11-FAILURE-SCENARIOS.md)*
