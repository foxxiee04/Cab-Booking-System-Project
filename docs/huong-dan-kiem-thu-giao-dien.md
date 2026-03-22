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

| Vai trò | Số điện thoại | Email | Mật khẩu |
|---|---|---|---|
| Admin | 0900000001 | admin@cabbooking.com | Password@1 |
| Customer 1 | 0901234561 | customer1@example.com | Password@1 |
| Customer 2 | 0901234562 | customer2@example.com | Password@1 |
| Customer 3 | 0901234563 | customer3@example.com | Password@1 |
| Customer 4 | 0901234564 | customer4@example.com | Password@1 |
| Customer 5 | 0901234565 | customer5@example.com | Password@1 |
| Customer 6 | 0901234566 | customer6@example.com | Password@1 |
| Customer 7 | 0901234567 | customer7@example.com | Password@1 |
| Customer 8 | 0901234568 | customer8@example.com | Password@1 |
| Customer 9 | 0901234569 | customer9@example.com | Password@1 |
| Customer 10 | 0901234570 | customer10@example.com | Password@1 |
| Driver 1 | 0911234561 | driver1@example.com | Password@1 |
| Driver 2 | 0911234562 | driver2@example.com | Password@1 |
| Driver 3 | 0911234563 | driver3@example.com | Password@1 |
| Driver 4 | 0911234564 | driver4@example.com | Password@1 |
| Driver 5 | 0911234565 | driver5@example.com | Password@1 |
| Driver 6 | 0911234566 | driver6@example.com | Password@1 |
| Driver 7 | 0911234567 | driver7@example.com | Password@1 |
| Driver 8 | 0911234568 | driver8@example.com | Password@1 |
| Driver 9 | 0911234569 | driver9@example.com | Password@1 |
| Driver 10 | 0911234570 | driver10@example.com | Password@1 |

> **Lưu ý mật khẩu:** `Password@1` — chữ P hoa, ký tự đặc biệt @, dài 9 ký tự. Đáp ứng chính sách mới: ≥8 ký tự, ≥1 chữ hoa (A-Z), ≥1 ký tự đặc biệt.

---

## 4) OTP trong môi trường dev/test

### 4.1 Chính sách OTP hiện tại
- API không trả về `devOtp` trong mọi môi trường.
- UI không hiển thị OTP trong mọi màn hình customer/driver/admin.
- Response chỉ trả về message đã mask, ví dụ: `OTP đã gửi tới +84****470`.
- OTP vẫn được xử lý đầy đủ backend: hash + Redis TTL 5 phút + giới hạn số lần nhập sai + rate limit.

### 4.2 OTP thật qua Twilio (personal phone)

Checklist cấu hình đúng:
1. Sửa `env/auth.env`:
   - `TWILIO_ENABLED=true`
   - `TWILIO_ACCOUNT_SID=...`
   - `TWILIO_AUTH_TOKEN=...`
   - `TWILIO_FROM_PHONE=+1...` (hoặc số Twilio hợp lệ)
   - `REAL_SMS_PHONE=0328861460` (chỉ số này mới nhận SMS thật)
2. Auth service phải đọc env file từ compose (đã cấu hình).
3. Restart auth service sau khi sửa env:
   - `docker compose up -d --build auth-service`
4. Kiểm tra log:
   - `docker logs cab-auth-service --tail 100 -f`

Lưu ý:
- Chỉ số khớp `REAL_SMS_PHONE` mới gửi SMS thật qua Twilio.
- Các số khác vẫn đi qua luồng OTP nhưng không gửi SMS ra ngoài.
- UI không hiển thị OTP trong bất kỳ trường hợp nào; response chỉ trả về dạng mask như `OTP đã gửi tới +84****470`.
- Nếu `TWILIO_ENABLED=false` hoặc thiếu `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM_PHONE` thì số thật cũng không nhận được SMS.

---

## 4b) Chính sách mật khẩu

Mật khẩu bắt buộc đáp ứng **đồng thời** 3 điều kiện:

| Điều kiện | Chi tiết |
|---|---|
| Độ dài tối thiểu | ≥ 8 ký tự |
| Chữ hoa | Ít nhất 1 ký tự A-Z |
| Ký tự đặc biệt | Ít nhất 1 ký tự ngoài chữ/số (vd: `!@#$%^&*`) |

Ví dụ hợp lệ: `Password@1`, `Test#2024`, `Admin!99`
Ví dụ không hợp lệ: `password1` (thiếu hoa + đặc biệt), `Password` (thiếu đặc biệt + số), `pass@1` (quá ngắn)

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
| 2 | Mật khẩu không có chữ hoa | Báo lỗi "Mật khẩu phải chứa ít nhất 1 chữ hoa" |
| 3 | Mật khẩu không có ký tự đặc biệt | Báo lỗi "Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt" |
| 4 | Mật khẩu và xác nhận không khớp | Báo lỗi không khớp |
| 5 | SĐT đã tồn tại | Báo lỗi trùng tài khoản |

### TC-REG-04: OTP nhập sai
| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập OTP sai | Hiển thị thông báo lỗi, ô OTP xóa trắng để nhập lại — **không reload, không chuyển trang** |
| 2 | Nhập sai nhiều lần (quá 5 lần) | Thông báo "Quá nhiều lần nhập sai", nút Gửi lại OTP enable ngay lập tức |
| 3 | OTP hết hạn (sau 5 phút) | Thông báo "OTP đã hết hạn", nút Gửi lại OTP enable ngay lập tức |

### TC-REG-03: Resend OTP
| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Bấm gửi lại OTP trong thời gian cooldown | Nút disable + đếm ngược |
| 2 | Hết cooldown và resend | OTP mới được tạo |

### TC-REG-05: Lấy OTP trong môi trường dev (không có Twilio thật)
| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Gửi OTP đăng ký cho SĐT bất kỳ | Response trả về mask SĐT, không lộ OTP |
| 2 | Lấy OTP qua API dev | `GET http://localhost:3001/api/auth/dev/otp/{phone}?purpose=register` → trả về JSON `{"otp":"..."}` |
| 3 | Điền OTP vào form | Tiếp tục luồng bình thường |

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
| 2 | Nhập SĐT hợp lệ → Gửi OTP | OTP được gửi, cooldown bắt đầu |
| 3 | Nhập OTP sai | Thông báo lỗi, ô OTP xóa trắng, **không reload** |
| 4 | Nhập OTP đúng + mật khẩu mới đủ điều kiện (≥8, hoa, đặc biệt) | Reset thành công |
| 5 | Login bằng mật khẩu mới | Thành công |

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

### 12.3 Kiểm tra biến OTP runtime trong container auth-service
```bash
docker exec cab-auth-service printenv | findstr /I "TWILIO_ENABLED REAL_SMS_PHONE TWILIO_ACCOUNT_SID TWILIO_FROM_PHONE"
```

### 12.4 Chạy static app đúng port
```bash
npx serve -s apps/customer-app/build -l 4000
npx serve -s apps/driver-app/build -l 4001
npx serve -s apps/admin-dashboard/build -l 4002
```

---

## 13) Lệnh Postman/CLI để test OTP

Base URL: `http://localhost:3000/api/auth`

### 13.1 Gửi OTP đăng ký theo số điện thoại
```bash
curl -X POST "http://localhost:3000/api/auth/register-phone/start" \
   -H "Content-Type: application/json" \
   -d "{\"phone\":\"0328861460\"}"
```

### 13.2 Xác minh OTP đăng ký
```bash
curl -X POST "http://localhost:3000/api/auth/register-phone/verify" \
   -H "Content-Type: application/json" \
   -d "{\"phone\":\"0328861460\",\"otp\":\"123456\"}"
```

### 13.3 Hoàn tất đăng ký sau khi verify OTP
```bash
curl -X POST "http://localhost:3000/api/auth/register-phone/complete" \
   -H "Content-Type: application/json" \
   -d "{\"phone\":\"0328861460\",\"password\":\"Password@1\",\"firstName\":\"Test\",\"lastName\":\"User\",\"email\":\"test.user@example.com\"}"
```

### 13.4 Gửi OTP quên mật khẩu
```bash
curl -X POST "http://localhost:3000/api/auth/forgot-password" \
   -H "Content-Type: application/json" \
   -d "{\"phone\":\"0901234561\"}"
```

### 13.5 Đặt lại mật khẩu bằng OTP
```bash
curl -X POST "http://localhost:3000/api/auth/reset-password" \
   -H "Content-Type: application/json" \
   -d "{\"phone\":\"0901234561\",\"otp\":\"123456\",\"newPassword\":\"NewPass@1\"}"
```

### 13.6 Resend OTP cho luồng đăng ký
```bash
curl -X POST "http://localhost:3000/api/auth/send-otp" \
   -H "Content-Type: application/json" \
   -d "{\"phone\":\"0328861460\",\"purpose\":\"register\"}"
```

Ghi chú kiểm thử:
- Trong Postman, tạo Collection với biến `baseUrl = http://localhost:3000/api/auth` để tái sử dụng.
- Với số khác `REAL_SMS_PHONE`, response vẫn trả thành công dạng mask nhưng không gửi SMS thật.
- Với số đúng `REAL_SMS_PHONE`, chỉ nhận SMS thật khi Twilio bật đầy đủ credentials.

---

## 14) Kết quả chạy test browser gần nhất

- Driver app đã chạy ổn định lại trên `http://localhost:4001`.
- Case OTP UI customer register: hiển thị `OTP đã gửi tới +84****569`, không lộ OTP.
- Case OTP UI driver register: hiển thị `OTP đã gửi tới +84****678`, không lộ OTP.
- Case lifecycle chuyến đi: Driver `0911234562` hoàn tất chuyến đang chạy, Customer `0901234561` tự cập nhật sang trạng thái `Chuyến đi đã hoàn thành` và hiện hóa đơn + đánh giá.
- Case callback thanh toán mock:
   - MoMo callback `paid=true` hiển thị `Thanh toán thành công`.
   - VNPay callback `paid=false` hiển thị `Thanh toán chưa thành công hoặc đã bị hủy`.
