# Hướng Dẫn Kiểm Thử Giao Diện (Manual QA)

## 1) Mục tiêu

Tài liệu này mô tả bộ test case thủ công cho:
- Customer App
- Driver App
- Admin Dashboard

Trọng tâm là các luồng nghiệp vụ chính: đăng ký/OTP, đăng nhập, đặt xe, theo dõi chuyến, nhận chuyến tài xế, hoàn tất chuyến, thanh toán và thống kê thu nhập.

---

## 2) Địa chỉ ứng dụng (local)

| App | URL |
|---|---|
| Customer App | http://localhost:4000 |
| Driver App | http://localhost:4001 |
| Admin Dashboard | http://localhost:4002 |
| API Gateway | http://localhost:3000 |

---

## 3) Tài khoản seed sau khi reset database

| Vai trò | Số điện thoại | Mật khẩu |
|---|---|---|
| Admin | 0900000001 | password123 |
| Customer 1 | 0901234561 | password123 |
| Customer 2 | 0901234562 | password123 |
| Driver 1 | 0911234561 | password123 |
| Driver 2 | 0911234562 | password123 |

---

## 4) OTP trong môi trường dev/test

### 4.1 OTP mock (mặc định khi dev)
- API trả về `devOtp` trong response khi gọi các endpoint OTP.
- Log auth-service có dòng dạng: `[SMS MOCK] OTP for 09xxxxxxxx: 123456`.

### 4.2 OTP thật qua Twilio (personal phone)

Checklist cấu hình đúng:
1. Sửa `env/auth.env`:
   - `TWILIO_ENABLED=true`
   - `TWILIO_ACCOUNT_SID=...`
   - `TWILIO_AUTH_TOKEN=...`
   - `TWILIO_FROM_PHONE=+1...` (hoặc số Twilio hợp lệ)
   - `PERSONAL_SMS_PHONE=0xxxxxxxxx` (số bạn muốn nhận thật)
2. Auth service phải đọc env file từ compose (đã cấu hình).
3. Restart auth service sau khi sửa env:
   - `docker compose up -d --build auth-service`
4. Kiểm tra log:
   - `docker logs cab-auth-service --tail 100 -f`

Lưu ý:
- Chỉ số khớp `PERSONAL_SMS_PHONE` mới gửi SMS thật.
- Số khác sẽ rơi về mock OTP (đúng theo thiết kế dev/test).

---

## 5) Luồng đăng ký/OTP (Customer + Driver)

### TC-REG-01: Đăng ký thành công
| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở `/register` | Form hiển thị đủ họ tên, SĐT, mật khẩu, xác nhận mật khẩu |
| 2 | Nhập dữ liệu hợp lệ | Không có lỗi validate |
| 3 | Bấm Đăng ký & Gửi OTP | Chuyển sang bước nhập OTP |
| 4 | Kiểm tra thông báo ở bước OTP | Chỉ hiển thị **1 thông báo OTP** (không bị lặp) |
| 5 | Nhập OTP đúng | Đăng nhập thành công |

### TC-REG-02: Validate lỗi cơ bản
| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | SĐT sai định dạng | Báo lỗi đúng định dạng SĐT |
| 2 | Mật khẩu và xác nhận không khớp | Báo lỗi không khớp |
| 3 | SĐT đã tồn tại | Báo lỗi trùng tài khoản |

### TC-REG-03: Resend OTP
| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Bấm gửi lại OTP trong thời gian cooldown | Nút disable + đếm ngược |
| 2 | Hết cooldown và resend | OTP mới được tạo |

---

## 6) Đăng nhập + quên mật khẩu

### TC-LOGIN-01: Đăng nhập thành công
| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở `/login` | Có trường SĐT + mật khẩu |
| 2 | Nhập tài khoản seed đúng | Vào app thành công |

### TC-FORGOT-01: Reset mật khẩu qua OTP
| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Bấm Quên mật khẩu | Điều hướng đúng |
| 2 | Nhập SĐT hợp lệ + OTP đúng + mật khẩu mới | Reset thành công |
| 3 | Login bằng mật khẩu mới | Thành công |

---

## 7) Luồng đặt xe & trạng thái tìm tài xế (Customer)

### TC-RIDE-01: Tạo chuyến và theo dõi
| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Chọn điểm đón/điểm đến và tạo chuyến | Tạo ride thành công |
| 2 | Mở trang tracking ride | Hiển thị trạng thái chuyến |
| 3 | Khi chưa có tài xế | Có loading state “Đang xoay và tìm tài xế phù hợp” |
| 4 | Khi có tài xế nhận | Trạng thái đổi sang “Đã có tài xế nhận chuyến” |

### TC-RIDE-02: Hoàn tất chuyến
| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Driver hoàn tất chuyến | Customer tự cập nhật sang “Chuyến đi đã hoàn thành” |
| 2 | Kiểm tra hóa đơn | Hiển thị mã chuyến, tiền, phương thức, trạng thái thanh toán |
| 3 | Kiểm tra đánh giá | Có form đánh giá tài xế |

---

## 8) Dashboard tài xế: danh sách cuốc gần bạn (refresh liên tục)

### TC-DRIVER-01: Danh sách cuốc gần bạn
| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Đăng nhập Driver và vào Dashboard | Thấy khu vực danh sách cuốc |
| 2 | Chờ hệ thống refresh | Danh sách tự cập nhật định kỳ |
| 3 | Kiểm tra card cuốc | Có đủ: pickup, dropoff, cước, khoảng cách, ETA |
| 4 | Nhấn “Nhận cuốc này” | Điều hướng sang `/active-ride` |

### TC-DRIVER-02: Ride lifecycle phía tài xế
| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Trong `/active-ride`, bấm “Đã tới điểm đón” | Trạng thái đổi đúng |
| 2 | Bấm “Đã đến - Bắt đầu” | Trạng thái sang đang chở khách |
| 3 | Bấm “Hoàn tất chuyến” | Quay về dashboard, ride kết thúc |

---

## 9) Thu nhập tài xế: doanh thu/hoa hồng/biểu đồ

### TC-EARN-01: Màn hình Earnings
| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Vào `/earnings` | Hiển thị tổng quan thu nhập |
| 2 | Kiểm tra card số liệu | Có Today/Week/Month + tổng số chuyến |
| 3 | Kiểm tra commission | Có gross, commission, net |
| 4 | Kiểm tra biểu đồ | Có breakdown 7 ngày |
| 5 | Kiểm tra danh sách chi tiết chuyến | Có từng chuyến với cước và hoa hồng |

---

## 10) Thanh toán: MoMo & VNPay

### TC-PAY-01: Chọn phương thức thanh toán khi đặt xe
| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Tới bước chọn thanh toán | Có danh sách phương thức |
| 2 | Kiểm tra phương thức | Có `Tiền mặt`, `MoMo`, `VNPay QR/Ngân hàng`, `Thẻ` |
| 3 | Chọn MoMo hoặc VNPay rồi tạo chuyến | Payment method được lưu theo ride |

### TC-PAY-02: Kiểm tra hiển thị trên tracking/invoice
| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở trang tracking sau khi tạo ride | Trường thanh toán hiển thị đúng method đã chọn (MoMo/VNPay) |
| 2 | Sau khi hoàn tất chuyến | Hóa đơn hiển thị đúng phương thức và trạng thái thanh toán |

Ghi chú:
- Môi trường dev có thể chưa chạy full redirect sandbox real gateway.
- Mục tiêu chính trong manual UI test là đúng method end-to-end và trạng thái hiển thị nhất quán.

---

## 11) Checklist hồi quy nhanh

- [ ] Đăng ký customer/driver: OTP step chỉ còn 1 thông báo OTP
- [ ] Sửa `env/auth.env` + restart auth-service thì Twilio behavior thay đổi đúng
- [ ] Customer tracking hiển thị loading “đang tìm tài xế” khi chưa có tài xế
- [ ] Driver dashboard có danh sách cuốc gần bạn và tự refresh
- [ ] Driver nhận cuốc từ danh sách và chạy đủ lifecycle đến hoàn tất
- [ ] Driver earnings có commission + chart + chi tiết chuyến
- [ ] Ride/payment hiển thị đúng phương thức MoMo/VNPay ở trang theo dõi/hóa đơn

---

## 12) Lệnh hỗ trợ test nhanh

### 12.1 Theo dõi OTP mock
```bash
docker logs cab-auth-service --tail 50 -f
```

### 12.2 Build lại auth-service sau khi sửa env
```bash
docker compose up -d --build auth-service
```

### 12.3 Chạy static app đúng port
```bash
npx serve -s apps/customer-app/build -l 4000
npx serve -s apps/driver-app/build -l 4001
npx serve -s apps/admin-dashboard/build -l 4002
```
