# Hướng Dẫn Kiểm Thử Thủ Công Trên Giao Diện

## 1. Mục đích tài liệu

Tài liệu này dùng để kiểm thử thủ công toàn bộ các màn hình chính của hệ thống đặt xe, bao gồm luồng **đăng ký / đăng nhập / xác thực OTP / quên mật khẩu**, ride lifecycle, hồ sơ, GPS/map, và quản trị.

Hai mục tiêu chính:

- Kiểm tra các luồng nghiệp vụ chính đang chạy được hay không.
- Kiểm tra các vấn đề UX hoặc thiếu tính năng đã quan sát thấy trên Customer App, Driver App, Admin Dashboard và Map UX.

---

## 2. Tài khoản seed (sau khi reset-database)

| Vai trò   | Số điện thoại | Mật khẩu   |
|-----------|---------------|------------|
| Admin     | 0900000001    | password123 |
| Customer 1 | 0901234561   | password123 |
| Customer 2 | 0901234562   | password123 |
| Customer 3 | 0901234563   | password123 |
| Driver 1  | 0911234561    | password123 |
| Driver 2  | 0911234562    | password123 |
| Driver 3  | 0911234563    | password123 |

> Tất cả tài khoản seed có trạng thái `ACTIVE` và đã được xác minh OTP.

---

## 3. Thông tin về OTP trong môi trường dev/test

Hệ thống có **hai chế độ OTP**:

### 3.1. OTP thật (Twilio SMS)
- Bật khi: `TWILIO_ENABLED=true` trong `env/auth.env`
- Chỉ gửi SMS thật nếu số điện thoại khớp với `PERSONAL_SMS_PHONE`
- Số điện thoại khác → mock (xem log)

### 3.2. OTP mock (dev/test)
- Khi `NODE_ENV != production`, API trả về `devOtp` trong response body
- Ví dụ response của `POST /api/auth/register`:
  ```json
  {
    "success": true,
    "data": {
      "message": "Đăng ký thành công...",
      "resendDelay": 30,
      "devOtp": "483921"
    }
  }
  ```
- `devOtp` cũng xuất hiện trong log container: `docker logs cab-auth-service`

### 3.3. Xem OTP trong log Docker
```bash
docker logs cab-auth-service --tail 50 -f
```
Tìm dòng: `[SMS MOCK] OTP for 09xxxxxxxx: 123456`

---

## 4. Luồng kiểm thử: Đăng ký khách hàng (Customer App)

**URL**: `http://localhost:3006` (hoặc port của customer-app)

### TC-REG-01: Đăng ký mới thành công

| Bước | Thao tác | Kết quả mong đợi |
|------|----------|------------------|
| 1 | Mở `/register` | Hiển thị form: Họ, Tên, SĐT, Mật khẩu, Xác nhận mật khẩu |
| 2 | Nhập họ tên (VD: Nguyễn / Văn X), SĐT hợp lệ (VD: `0901999001`), mật khẩu ≥ 6 ký tự | Các trường hợp lệ |
| 3 | Bấm **Đăng ký & Gửi OTP** | Chuyển sang màn hình nhập OTP; thông báo "Tài khoản đã được tạo!" |
| 4 | Lấy OTP từ `devOtp` hoặc log Docker (mock) / SMS thật | Có mã 6 chữ số |
| 5 | Nhập OTP đúng, bấm **Xác minh & Đăng nhập** | Đăng nhập thành công, chuyển về `/home` |

### TC-REG-02: Nhập số điện thoại sai định dạng

| Bước | Thao tác | Kết quả mong đợi |
|------|----------|------------------|
| 1 | Nhập SĐT `12345` hoặc `090123456` (9 chữ số) | Lỗi: "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0" |

### TC-REG-03: Mật khẩu không khớp

| Bước | Thao tác | Kết quả mong đợi |
|------|----------|------------------|
| 1 | Nhập mật khẩu `123456` và xác nhận `654321` | Lỗi: "Mật khẩu xác nhận không khớp" |

### TC-REG-04: Số điện thoại đã đăng ký

| Bước | Thao tác | Kết quả mong đợi |
|------|----------|------------------|
| 1 | Đăng ký lại SĐT `0901234561` (đã seed) | Lỗi: "Số điện thoại này đã được đăng ký." |

### TC-REG-05: OTP sai

| Bước | Thao tác | Kết quả mong đợi |
|------|----------|------------------|
| 1 | Nhập OTP sai (VD: `000000`) | Lỗi: "OTP không hợp lệ. Còn N lần thử." |

### TC-REG-06: Gửi lại OTP (Resend)

| Bước | Thao tác | Kết quả mong đợi |
|------|----------|------------------|
| 1 | Sau khi nhập sai nhiều lần hoặc OTP hết hạn | Nút "Gửi lại OTP" hoạt động |
| 2 | Bấm "Gửi lại OTP" khi đang trong cooldown | Nút hiển thị đếm ngược `Gửi lại (30s)` và bị disable |
| 3 | Chờ hết cooldown, bấm gửi lại | OTP mới được gửi, nhập thành công |

---

## 5. Luồng kiểm thử: Đăng nhập khách hàng

### TC-LOGIN-01: Đăng nhập thành công

| Bước | Thao tác | Kết quả mong đợi |
|------|----------|------------------|
| 1 | Mở `/login` | Hiển thị SĐT + Mật khẩu + link "Quên mật khẩu?" |
| 2 | Nhập `0901234561` / `password123` | Đăng nhập thành công, chuyển về `/home` |

### TC-LOGIN-02: Sai mật khẩu

| Bước | Thao tác | Kết quả mong đợi |
|------|----------|------------------|
| 1 | Nhập đúng SĐT, sai mật khẩu | Lỗi: "Số điện thoại hoặc mật khẩu không đúng." |

### TC-LOGIN-03: Tài khoản chưa xác minh

| Bước | Thao tác | Kết quả mong đợi |
|------|----------|------------------|
| 1 | Tạo tài khoản mới, chưa nhập OTP (tài khoản INACTIVE), thử đăng nhập | Lỗi: "Tài khoản chưa được xác minh. Vui lòng hoàn tất đăng ký." |

---

## 6. Luồng kiểm thử: Quên mật khẩu (Forgot Password)

### TC-FORGOT-01: Đặt lại mật khẩu thành công

| Bước | Thao tác | Kết quả mong đợi |
|------|----------|------------------|
| 1 | Trang đăng nhập → bấm **Quên mật khẩu?** | Chuyển sang `/forgot-password` |
| 2 | Nhập SĐT hợp lệ đã đăng ký (VD: `0901234561`) | Bước nhập OTP + mật khẩu mới |
| 3 | Lấy OTP từ `devOtp` / log Docker | Có mã 6 chữ số |
| 4 | Nhập OTP đúng, mật khẩu mới `newpass123`, xác nhận `newpass123` | Thành công, hiện thông báo; nút "Đăng nhập ngay" |
| 5 | Bấm "Đăng nhập ngay" → login với `newpass123` | Đăng nhập thành công |
| 6 | Thử login bằng mật khẩu cũ `password123` | Lỗi: "Số điện thoại hoặc mật khẩu không đúng." |

### TC-FORGOT-02: SĐT không tồn tại

| Bước | Thao tác | Kết quả mong đợi |
|------|----------|------------------|
| 1 | Nhập SĐT chưa đăng ký | Thông báo lỗi trả về (không tiết lộ tài khoản có tồn tại hay không) |

### TC-FORGOT-03: Gửi lại OTP khi reset mật khẩu

| Bước | Thao tác | Kết quả mong đợi |
|------|----------|------------------|
| 1 | Đang ở bước nhập OTP forgot password | Nút "Gửi lại OTP" hiện và đếm ngược |
| 2 | Bấm gửi lại sau khi hết cooldown | OTP mới được gửi (khác OTP đăng ký — namespace riêng) |

### TC-FORGOT-04: OTP đăng ký và OTP reset không lẫn nhau

| Bước | Thao tác | Kết quả mong đợi |
|------|----------|------------------|
| 1 | Đồng thời có một OTP đăng ký đang chờ và gửi một OTP reset cho cùng SĐT | Hai OTP hoàn toàn độc lập; dùng OTP đăng ký cho endpoint `/reset-password` → lỗi |

---

## 7. Luồng kiểm thử: Đăng ký tài xế (Driver App)

**URL**: `http://localhost:3007` (hoặc port của driver-app)

### TC-DREG-01: Đăng ký tài xế thành công

| Bước | Thao tác | Kết quả mong đợi |
|------|----------|------------------|
| 1 | Mở `/register` | Hiển thị form: Họ, Tên, SĐT, **Mật khẩu**, **Xác nhận mật khẩu** |
| 2 | Điền đầy đủ thông tin hợp lệ | Các trường đều hợp lệ |
| 3 | Bấm **Đăng ký & Gửi OTP** | Chuyển bước OTP |
| 4 | Nhập OTP đúng | Đăng nhập thành công, chuyển về `/profile-setup` |

### TC-DREG-02: Thiếu mật khẩu

| Bước | Thao tác | Kết quả mong đợi |
|------|----------|------------------|
| 1 | Để trống trường mật khẩu | Lỗi client-side: "Mật khẩu phải có ít nhất 6 ký tự" |

### TC-DREG-03: Đăng nhập tài xế sau khi đăng ký

| Bước | Thao tác | Kết quả mong đợi |
|------|----------|------------------|
| 1 | Logout, vào `/login` | Form SĐT + mật khẩu + link "Quên mật khẩu?" |
| 2 | Đăng nhập bằng SĐT + mật khẩu đã đăng ký | Thành công |

---

## 8. Luồng kiểm thử: Quên mật khẩu tài xế

Tương tự mục 6, áp dụng cho Driver App tại URL driver-app.

---

## 9. Kiểm tra rate limit OTP

| Bước | Thao tác | Kết quả mong đợi |
|------|----------|------------------|
| 1 | Gửi OTP 3 lần liên tiếp cho cùng 1 SĐT trong 10 phút | Lần 4 → lỗi 429: "Quá nhiều yêu cầu OTP cho số điện thoại này. Thử lại sau Xs." |

---

## 10. Phạm vi kiểm tra

| Hạng mục | Phạm vi |
|----------|---------|
| Đăng ký + OTP xác minh SĐT | Customer App + Driver App |
| Đăng nhập SĐT + mật khẩu | Customer App + Driver App |
| Quên mật khẩu qua OTP | Customer App + Driver App |
| Resend OTP (đăng ký + reset) | Cả hai |
| Rate limit OTP (3 lần/10 phút/SĐT) | Backend test qua cURL |
| OTP namespace (register ≠ reset) | Backend test qua cURL |
| Ride lifecycle | Xem phần 11 |

---

## 11. Luồng ride lifecycle (từ phiên bản trước)

### 11.1 Đặt chuyến và hoàn tất

| Bước | Thao tác |
|------|----------|
| 1 | Đăng nhập customer → vào HomeMap → nhập điểm đón/đến → bấm **Đặt xe** |
| 2 | Đăng nhập driver (khác tab/máy) → thấy yêu cầu → bấm **Chấp nhận** |
| 3 | Driver bấm **Đã đến đón** → **Bắt đầu chuyến** → **Hoàn tất** |
| 4 | Customer thấy trạng thái cập nhật realtime |

---

## 12. Kiểm tra nhanh bằng cURL

### 12.1. Đăng ký
```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone":"0901999111","password":"test123","role":"CUSTOMER","firstName":"Test","lastName":"User"}' | jq .
```

### 12.2. Xác minh OTP (lấy devOtp từ response trên)
```bash
curl -s -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"0901999111","otp":"XXXXXX"}' | jq .
```

### 12.3. Đăng nhập
```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"0901234561","password":"password123"}' | jq .
```

### 12.4. Quên mật khẩu — gửi OTP reset
```bash
curl -s -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"phone":"0901234561"}' | jq .
```

### 12.5. Đặt lại mật khẩu
```bash
curl -s -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"phone":"0901234561","otp":"XXXXXX","newPassword":"newpass123"}' | jq .
```

### 12.6. Resend OTP (trong cooldown) — phải trả 30s delay
```bash
curl -s -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"0901999111"}' | jq .
```

---

## 13. Checklist nhanh

- [ ] Customer đăng ký → nhận OTP mock → xác minh → đăng nhập được
- [ ] Driver đăng ký (có trường mật khẩu) → OTP → profile-setup
- [ ] Đăng nhập customer/driver bằng SĐT + mật khẩu
- [ ] Link **Quên mật khẩu?** xuất hiện trên cả 2 trang Login
- [ ] Forgot password 3 bước: SĐT → OTP → mật khẩu mới → đăng nhập lại
- [ ] Resend OTP hoạt động với đếm ngược (0→30→60s)
- [ ] OTP đăng ký và OTP reset không lẫn lộn
- [ ] Rate limit kích hoạt sau 3 lần gửi OTP / 10 phút
- [ ] Các tài khoản seed đăng nhập được bằng `password123`

---

## 14. Địa chỉ ứng dụng (local dev)

| App | URL chạy test giao diện |
|---|---|
| Customer App | http://localhost:4000 |
| Driver App | http://localhost:4001 |
| Admin Dashboard | http://localhost:4002 |
| API Gateway | http://localhost:3000 |

> Khởi động static server đúng bộ port yêu cầu:
> ```bat
> npx serve -s apps/customer-app/build -l 4000
> npx serve -s apps/driver-app/build -l 4001
> npx serve -s apps/admin-dashboard/build -l 4002
> ```
> Hoặc dev mode:
> ```bat
> npm --workspace=apps/customer-app start
> npm --workspace=apps/driver-app start
> npm --workspace=apps/admin-dashboard start
> ```

### 3.2. Tài khoản seed dùng để test nhanh

Đăng nhập sử dụng **số điện thoại + mật khẩu**; OTP dùng cho bước xác thực số điện thoại khi đăng ký mới và quên mật khẩu.

| Vai trò | Số điện thoại | Mục đích |
| --- | --- | --- |
| Khách hàng 1 | 0901234561 | Tạo chuyến, hủy chuyến, kiểm tra lịch sử, hồ sơ |
| Khách hàng 2 | 0901234562 | Tạo chuyến thứ 2 khi cần test song song |
| Tài xế 1 | 0911234561 | Nhận chuyến, cập nhật trạng thái, kiểm tra hồ sơ tài xế |
| Tài xế 2 | 0911234562 | Tài xế dự phòng khi cần test hai tài xế |
| Quản trị viên | 0900000001 | Đăng nhập admin (role ADMIN), kiểm tra rides, payments, drivers |

Ghi chú:

- Tất cả tài khoản xác thực bằng **số điện thoại + OTP**, không có mật khẩu. Trong môi trường development, mã OTP được trả về trong trường `devOtp` của response API `/auth/send-otp` (và in trong console của auth-service).
- Các tài xế seed sẵn hiện đã ở trạng thái `APPROVED`.
- Muốn kiểm tra nghiệp vụ duyệt hồ sơ trên admin, cần tạo thêm một tài khoản tài xế mới để sinh hồ sơ `PENDING`.
- Admin Dashboard sẽ từ chối đăng nhập nếu tài khoản không có role `ADMIN` (hiển thị thông báo lỗi, không lưu token).

### 3.3. Dữ liệu test đề xuất

| Trường dữ liệu | Giá trị nhập | Mục đích |
| --- | --- | --- |
| Điểm đón | Ben Thanh | Điểm bắt đầu của chuyến |
| Điểm đến | Tan Son Nhat Airport | Điểm kết thúc của chuyến |
| Nội dung đánh giá | Tài xế hỗ trợ tốt, chuyến đi ổn định. | Kiểm tra review sau chuyến |
| Số điện thoại đăng ký mới (customer) | 0921000001 | Dùng để test đăng ký mới (tăng số cuối mỗi lần để tránh trùng) |
| Số điện thoại đăng ký mới (driver) | 0929000001 | Dùng để test đăng ký mới (tăng số cuối mỗi lần để tránh trùng) |
| OTP development | Lấy từ trường `devOtp` trong response API | Chỉ trả về khi `NODE_ENV=development`, điền vào bước xác minh OTP |
| Số điện thoại hợp lệ | 0912345678 | Dùng cho ca dương tính |
| Số điện thoại không hợp lệ | 09abc hoặc 123 | Dùng cho ca âm tính |

## 4. Các khoảng trống chức năng đã xác nhận từ code review

Phần này rất quan trọng để người test không hiểu nhầm lỗi với thiếu tính năng.
2
### 4.1. Các khoảng trống đã xác nhận

- Customer App hiện chưa có màn hình chỉnh sửa hồ sơ khách hàng, mới chỉ xem hồ sơ.
- Driver App đã có form cập nhật thông tin xe và GPLX trên giao diện hồ sơ, cần test lưu thay đổi như một chức năng đang hoạt động.
- Driver App đã hiển thị trạng thái duyệt hồ sơ trực tiếp trong trang hồ sơ, ví dụ `Chờ duyệt hồ sơ` hoặc `Đã được duyệt`.
- Admin Dashboard đã có trang `Duyệt hồ sơ` với thao tác `Duyệt` và `Từ chối` hoạt động trên UI.
- Backend driver-service hiện đã hỗ trợ luồng `approve/reject` hoàn chỉnh cho nghiệp vụ duyệt tài xế.
- Tài khoản tài xế chưa có review hiện được hiển thị là `Chưa có đánh giá`, không còn mặc định hiển thị như đã có 5/5.

### 4.2. Các vấn đề nghi ngờ cần kiểm tra thực tế

- GPS hiện tại có thể lệch so với vị trí thật của thiết bị hoặc trình duyệt.
- Sau bản sửa layout mobile, vẫn cần hồi quy để đảm bảo map hoặc bottom navigation không che ô nhập và nút CTA đặt xe.
- Luồng đặt xe ở customer vẫn cần kiểm tra kỹ bước tải giá cước; có thể xuất hiện cảnh báo `Hệ thống đang phản hồi chậm` dù hành trình đã hợp lệ.
- Admin Dashboard có thể hiển thị lẫn tiếng Việt và tiếng Anh trên cùng màn hình.
- Dữ liệu tổng hợp bên admin cần đối chiếu lại bằng rideId cụ thể để xác nhận có bám đúng database hay không.

## 5. Checklist tiền kiểm theo từng ứng dụng

## 5.1. Customer App

### A. Kiểm tra đăng ký tài khoản khách hàng

Luồng đăng ký dùng **số điện thoại + OTP** (không có email/mật khẩu).

| STT | Dữ liệu nhập | Mục đích kiểm tra | Kết quả mong đợi |
| --- | --- | --- | --- |
| 1 | Bỏ trống số điện thoại, họ tên | Kiểm tra ràng buộc bắt buộc | Không cho submit, hiển thị lỗi yêu cầu nhập đủ trường |
| 2 | Số điện thoại không bắt đầu bằng `0`, ví dụ `9123456789` | Kiểm tra validate định dạng | Hiển thị lỗi số điện thoại không hợp lệ |
| 3 | Số điện thoại dưới 10 chữ số, ví dụ `091234` | Kiểm tra độ dài tối thiểu | Hiển thị lỗi định dạng |
| 4 | Số điện thoại 10 chữ số hợp lệ, bấm Đăng ký | Kiểm tra luồng gửi OTP | Hệ thống gửi OTP, hiển thị màn hình nhập mã xác minh |
| 5 | Nhập OTP sai (ví dụ `000000`) | Kiểm tra xử lý OTP không hợp lệ | Hiển thị thông báo OTP không đúng |
| 6 | Nhập đúng OTP (lấy từ `devOtp` trong response hoặc log) | Kiểm tra xác minh OTP và tạo tài khoản | Đăng ký thành công, chuyển vào trang chủ customer |

### B. Kiểm tra đăng nhập khách hàng

Luồng đăng nhập dùng **số điện thoại + OTP** (bước 2 trong quy trình 2 bước).

| STT | Dữ liệu nhập | Mục đích kiểm tra | Kết quả mong đợi |
| --- | --- | --- | --- |
| 1 | Bỏ trống số điện thoại | Kiểm tra chặn submit phía client | Hiển thị lỗi yêu cầu nhập số điện thoại |
| 2 | Số điện thoại sai định dạng (không đủ 10 số hoặc không bắt đầu bằng 0) | Kiểm tra validate cơ bản phía client | Hiển thị lỗi số điện thoại không hợp lệ |
| 3 | Số điện thoại hợp lệ, bấm Tiếp tục | Kiểm tra gửi OTP | Hệ thống gửi OTP, hiển thị màn hình nhập mã OTP |
| 4 | Nhập OTP sai hoặc hết hạn | Kiểm tra xử lý lỗi OTP | Hiển thị thông báo OTP không hợp lệ |
| 5 | Nhập đúng OTP | Kiểm tra luồng đăng nhập thành công | Vào trang chủ customer |

### C. Kiểm tra hồ sơ khách hàng sau đăng ký

| Bước | Thao tác | Mục đích | Kết quả mong đợi |
| --- | --- | --- | --- |
| 1 | Đăng ký customer mới bằng dữ liệu hợp lệ | Tạo dữ liệu gốc | Đăng ký thành công |
| 2 | Đăng nhập lại bằng tài khoản vừa tạo | Kiểm tra dữ liệu auth | Đăng nhập thành công |
| 3 | Vào màn hình Profile | Kiểm tra đồng bộ hồ sơ | Họ tên, email, số điện thoại hiển thị đúng |
| 4 | Tìm nút chỉnh sửa hồ sơ | Xác nhận khả năng cập nhật profile | Hiện tại chưa có chức năng chỉnh sửa, cần ghi nhận là khoảng trống tính năng |

### D. Kiểm tra GPS và bản đồ ở customer

| Bước | Thao tác | Mục đích | Kết quả mong đợi |
| --- | --- | --- | --- |
| 1 | Cho phép quyền truy cập vị trí trên trình duyệt | Kiểm tra lấy GPS hiện tại | Bản đồ hoặc ô điểm đón nhảy về gần vị trí thật |
| 2 | Từ chối quyền truy cập vị trí | Kiểm tra xử lý fallback | Không crash, người dùng vẫn nhập tay được điểm đón |
| 3 | Nhấn định vị lại nhiều lần | Kiểm tra độ ổn định GPS | Không bị treo, vị trí cập nhật nhất quán |
| 4 | Bấm vào ô điểm đón và điểm đến | Kiểm tra overlay có cản thao tác không | Ô nhập phải nhìn rõ, click được, không bị map đè lên |
| 5 | Chọn điểm đón và điểm đến từ autocomplete | Kiểm tra hiển thị kết quả tìm kiếm | Danh sách gợi ý không bị che khuất |
| 6 | Bấm tiếp tục đặt xe | Kiểm tra mở được luồng booking | Flow đặt xe mở ra, không đứng mãi ở loading |

## 5.2. Driver App

### A. Kiểm tra đăng ký tài khoản tài xế

Thực hiện tương tự customer cho trường số điện thoại và luồng OTP, sau đó kiểm tra thêm luồng `Profile Setup`.

| STT | Dữ liệu nhập | Mục đích kiểm tra | Kết quả mong đợi |
| --- | --- | --- | --- |
| 1 | Số điện thoại không hợp lệ (sai định dạng, dưới 10 số) | Kiểm tra validate đăng ký | Không cho submit, hiển thị lỗi định dạng số điện thoại |
| 2 | Số điện thoại hợp lệ → gửi OTP → nhập OTP đúng | Kiểm tra tạo tài khoản driver qua phone+OTP | Điều hướng sang màn hình hoàn tất hồ sơ |
| 3 | Bỏ trống thông tin xe hoặc GPLX | Kiểm tra validate profile setup | Không cho hoàn tất hồ sơ |
| 4 | Nhập đủ vehicle type, hãng xe, dòng xe, màu xe, biển số, GPLX, ngày hết hạn | Kiểm tra tạo driver profile | Hoàn tất hồ sơ thành công |

### B. Kiểm tra đăng nhập tài xế

| STT | Dữ liệu nhập | Mục đích kiểm tra | Kết quả mong đợi |
| --- | --- | --- | --- |
| 1 | Bỏ trống số điện thoại | Kiểm tra chặn submit phía client | Hiển thị lỗi yêu cầu nhập số điện thoại |
| 2 | Số điện thoại sai định dạng | Kiểm tra validate | Hiển thị lỗi số điện thoại không hợp lệ |
| 3 | Số điện thoại hợp lệ, bấm Tiếp tục | Kiểm tra gửi OTP | Hệ thống gửi OTP, hiển thị màn hình nhập mã |
| 4 | Nhập OTP sai | Kiểm tra xử lý OTP không hợp lệ | Hiển thị lỗi OTP |
| 5 | Nhập OTP đúng | Kiểm tra điều hướng | Vào dashboard tài xế |

### C. Kiểm tra hồ sơ và trạng thái duyệt tài xế

| Bước | Thao tác | Mục đích | Kết quả mong đợi |
| --- | --- | --- | --- |
| 1 | Đăng nhập bằng tài khoản tài xế mới hoàn tất hồ sơ | Kiểm tra trạng thái ban đầu | Hồ sơ có trạng thái chờ duyệt hoặc tương đương |
| 2 | Quan sát app bar hoặc profile | Kiểm tra user có nhìn thấy trạng thái duyệt hay không | Có chip hoặc nhãn thể hiện `Chờ duyệt hồ sơ` hoặc `Đã được duyệt` đúng với dữ liệu thực tế |
| 3 | Thử bật online khi tài khoản chưa được duyệt | Kiểm tra chặn đúng nghiệp vụ | Không cho online, thông báo cần admin duyệt |
| 4 | Mở Profile | Kiểm tra dữ liệu xe và biển số | Thông tin xe hiển thị đúng |
| 5 | Kiểm tra khả năng sửa hồ sơ | Kiểm tra form cập nhật hồ sơ tài xế | Có form chỉnh sửa thông tin xe/GPLX và lưu thay đổi thành công |

### D. Kiểm tra rating tài xế mới

| Bước | Thao tác | Mục đích | Kết quả mong đợi |
| --- | --- | --- | --- |
| 1 | Dùng tài khoản tài xế mới chưa hoàn tất chuyến nào | Kiểm tra dữ liệu rating ban đầu | Không nên hiển thị 5/5 như đã có đánh giá |
| 2 | Mở Profile tài xế | Kiểm tra cách hiển thị | Nên hiện `Chưa có đánh giá` hoặc trạng thái tương đương |

## 5.3. Admin Dashboard

### A. Kiểm tra tính nhất quán ngôn ngữ

| Bước | Thao tác | Mục đích | Kết quả mong đợi |
| --- | --- | --- | --- |
| 1 | Mở Dashboard, Drivers, Rides, Payments | Kiểm tra i18n toàn cục | Không có tình trạng lẫn Việt - Anh trên cùng khu vực thông tin |
| 2 | Đổi ngôn ngữ nếu có hỗ trợ | Kiểm tra phản ứng UI | Cùng một nhóm màn hình đổi nhất quán |

### B. Kiểm tra dữ liệu admin có đúng với dữ liệu thật không

| Bước | Thao tác | Mục đích | Kết quả mong đợi |
| --- | --- | --- | --- |
| 1 | Tạo một ride mới từ customer và ghi lại rideId | Tạo dữ liệu đối chiếu | Có rideId cụ thể |
| 2 | Tìm rideId ở Rides | Kiểm tra dữ liệu admin có bám ride thật | Ride xuất hiện đúng trạng thái |
| 3 | Hoàn tất ride rồi mở Payments | Kiểm tra dữ liệu payment | Payment cùng rideId xuất hiện đúng |
| 4 | Kiểm tra Drivers và Customers | Kiểm tra dữ liệu tổng hợp | Tên, email, trạng thái online không phải dữ liệu placeholder |

### C. Kiểm tra duyệt tài xế

| Bước | Thao tác | Mục đích | Kết quả mong đợi |
| --- | --- | --- | --- |
| 1 | Tạo một tài khoản tài xế mới rồi mở trang Duyệt hồ sơ | Kiểm tra có danh sách tài xế chờ duyệt không | Hồ sơ mới xuất hiện ở trạng thái `Chờ duyệt` |
| 2 | Bấm Duyệt trên đúng hồ sơ rồi xác nhận | Kiểm tra khả năng xử lý nghiệp vụ | Hồ sơ biến mất khỏi danh sách chờ duyệt hoặc đổi trạng thái phù hợp |
| 3 | Tạo thêm một hồ sơ pending khác rồi bấm Từ chối | Kiểm tra nhánh từ chối | Hồ sơ bị loại khỏi danh sách chờ duyệt và trạng thái cập nhật đúng |

## 5.4. Map UX và hiệu năng

| Bước | Thao tác | Mục đích | Kết quả mong đợi |
| --- | --- | --- | --- |
| 1 | Pan, zoom, chọn điểm liên tục trên map | Kiểm tra độ mượt | Không giật lag quá mức, marker cập nhật ổn định |
| 2 | Thử trên cửa sổ nhỏ gần mobile width | Kiểm tra responsive | Ô nhập và nút CTA không bị che |
| 3 | Chọn các địa danh lớn như Ben Thanh, sân bay | Kiểm tra nhận diện địa điểm | Marker hoặc gợi ý thể hiện chính xác |
| 4 | Đi qua luồng mở booking rồi quay lại | Kiểm tra state map | Không bị kẹt loading, không mất dữ liệu vừa chọn bất thường |

## 5.5. Kiểm tra thanh toán MoMo và VNPay

### A. Kiểm tra danh sách phương thức thanh toán

| Bước | Thao tác | Mục đích | Kết quả mong đợi |
| --- | --- | --- | --- |
| 1 | Đăng nhập customer, mở luồng đặt xe đến bước chọn thanh toán | Xác nhận đã có access token hợp lệ | Màn hình chọn phương thức thanh toán hiển thị |
| 2 | Quan sát danh sách phương thức | Kiểm tra backend trả về đúng danh sách | Danh sách chứa cả **MoMo** và **VNPay** |

### B. Kiểm tra tạo payment intent

| Bước | Thao tác | Mục đích | Kết quả mong đợi |
| --- | --- | --- | --- |
| 1 | Tạo booking trước, lấy bookingId từ kết quả | Chuẩn bị dữ liệu đầu vào | Có bookingId hợp lệ |
| 2 | Chọn MoMo làm phương thức thanh toán | Kiểm tra tạo MoMo payment intent | Hệ thống nhận về `payUrl` để redirect người dùng sang trang MoMo |
| 3 | Chọn VNPay làm phương thức thanh toán | Kiểm tra tạo VNPay payment intent | Hệ thống nhận về `paymentUrl` chứa domain `vnpayment.vn` |
| 4 | Quan sát trạng thái payment trong Admin Dashboard | Kiểm tra dữ liệu thanh toán được ghi nhận | Payment ở trạng thái PENDING đến khi callback xác nhận |

> **Lưu ý development**: Môi trường test không thực hiện giao dịch thật. Nếu MoMo sandbox hoặc VNPay sandbox chưa được cấu hình, payment endpoint trả về URL redirect đúng cấu trúc nhưng cần mở thủ công trong trình duyệt để hoàn tất vòng lặp callback.

## 6. Cách chuẩn bị trạng thái sạch trước khi test

### Bước 1. Reset dữ liệu

- Thực hiện: chạy file `scripts\reset-database.bat`.
- Mục đích: xóa dữ liệu cũ và đưa hệ thống về trạng thái sạch.
- Kết quả mong đợi: không còn ride active từ lần test trước.

### Bước 2. Seed lại dữ liệu mẫu

- Thực hiện: script `reset-database.bat` đã bao gồm seed tự động ở bước 4.
- Nếu chỉ muốn seed mà không reset toàn bộ, chạy riêng: `npx tsx scripts\seed-database.ts`.
- Mục đích: tạo lại tài khoản test cố định (phone `0901234561`, `0911234561`, `0900000001`, v.v.).
- Kết quả mong đợi: các số điện thoại seed đăng nhập được qua OTP.

### Bước 3. Mở lại 3 ứng dụng

- Customer App: `http://localhost:4000`
- Driver App: `http://localhost:4001`
- Admin Dashboard: `http://localhost:4002`

### Bước 4. Kiểm tra không còn chuyến cũ

- Trên Driver App, xác nhận không có active ride đang mở.
- Trên Admin Dashboard, xác nhận không có ride bất thường đang treo.

## 7. Kịch bản 1: Hoàn tất trọn vẹn một chuyến xe

### 5.1. Luồng nghiệp vụ của kịch bản này

Đây là luồng nghiệp vụ đầy đủ nhất của hệ thống:

Khách hàng đặt xe → hệ thống tạo ride → admin nhìn thấy ride mới → tài xế online và nhận ride → tài xế tới điểm đón → tài xế bắt đầu chuyến đi → tài xế hoàn tất chuyến đi → hệ thống cập nhật thanh toán → khách hàng đánh giá tài xế → admin nhìn thấy ride và payment đã hoàn tất.

Kịch bản này dùng để kiểm tra xem toàn bộ chuỗi xử lý chính của hệ thống có chạy xuyên suốt hay không.

### 5.2. Dữ liệu sử dụng

| Dữ liệu | Giá trị |
| --- | --- |
| Điểm đón | Ben Thanh |
| Điểm đến | Tan Son Nhat Airport |
| Nội dung đánh giá | Tài xế hỗ trợ tốt, chuyến đi ổn định. |

### 5.3. Các bước thực hiện chi tiết

| Bước | Vai trò thao tác | Hành động trên giao diện | Làm bước này để làm gì | Kết quả mong đợi | Bước tiếp theo |
| --- | --- | --- | --- | --- | --- |
| 1 | Khách hàng | Vào Customer App và đăng nhập | Bắt đầu tạo một chuyến mới từ đúng vai trò khách hàng | Đăng nhập thành công, vào trang chủ | Nhập điểm đón và điểm đến |
| 2 | Khách hàng | Nhập điểm đón là Ben Thanh | Xác định nơi khách sẽ được đón | Ô điểm đón hiển thị địa điểm đã chọn | Nhập điểm đến |
| 3 | Khách hàng | Nhập điểm đến là Tan Son Nhat Airport | Xác định hành trình của chuyến xe | Ô điểm đến hiển thị địa điểm đã chọn | Mở luồng đặt xe |
| 4 | Khách hàng | Bấm nút tiếp tục đặt xe | Mở luồng booking để hệ thống tính toán và chuẩn bị tạo ride | Hiển thị flow đặt xe | Xác nhận các bước trong flow |
| 5 | Khách hàng | Giữ lựa chọn mặc định và bấm xác nhận tạo chuyến | Tạo một ride mới trong hệ thống | Hệ thống chuyển sang màn hình chi tiết chuyến | Ghi lại rideId trên URL |
| 6 | Khách hàng | Ghi lại rideId từ đường dẫn dạng /ride/{rideId} | Dùng cùng một mã ride để đối chiếu ở admin và driver | Có được mã ride cụ thể | Sang admin để kiểm tra ride vừa tạo |
| 7 | Quản trị viên | Mở màn hình Rides và tìm đúng rideId vừa ghi | Kiểm tra backend đã ghi nhận chuyến mới hay chưa | Ride xuất hiện với trạng thái FINDING_DRIVER | Sang driver để nhận chuyến |
| 8 | Tài xế | Vào Driver App, bật trạng thái online nếu chưa bật | Đảm bảo tài xế đủ điều kiện nhận chuyến | Driver ở trạng thái trực tuyến | Chờ ride request xuất hiện |
| 9 | Tài xế | Khi có yêu cầu chuyến, bấm nhận chuyến | Kiểm tra khả năng ghép chuyến và accept ride | Driver được chuyển sang màn hình active ride | Thực hiện cập nhật trạng thái chuyến |
| 10 | Tài xế | Bấm Đã tới điểm đón | Chuyển ride sang trạng thái tài xế đã đến nơi đón khách | Trạng thái chuyến thay đổi tương ứng | Bắt đầu chuyến đi |
| 11 | Tài xế | Bấm Bắt đầu chuyến đi | Chuyển ride sang trạng thái đang thực hiện | Ride ở trạng thái đang di chuyển | Hoàn tất chuyến đi |
| 12 | Tài xế | Bấm Hoàn tất chuyến đi | Kết thúc luồng vận chuyển chính và kích hoạt bước hậu xử lý | Driver quay về dashboard | Sang khách hàng để kiểm tra trạng thái cuối |
| 13 | Khách hàng | Mở lại hoặc refresh trang ride theo đúng rideId | Kiểm tra trạng thái ride đã đồng bộ về phía khách hàng hay chưa | Hiển thị Chuyến đi đã hoàn thành | Kiểm tra payment |
| 14 | Khách hàng | Quan sát payment status chip | Kiểm tra hệ thống thanh toán đã sinh và cập nhật trạng thái hay chưa | Payment hiển thị COMPLETED | Gửi đánh giá cho tài xế |
| 15 | Khách hàng | Nhập nội dung đánh giá Tài xế hỗ trợ tốt, chuyến đi ổn định. rồi gửi | Kiểm tra khách hàng có thể review sau khi ride hoàn tất | Màn hình đổi sang phần đánh giá đã gửi | Sang admin để kiểm tra dữ liệu cuối |
| 16 | Quản trị viên | Vào lại Rides và tìm rideId | Kiểm tra trạng thái cuối của ride ở hệ thống quản trị | Ride có trạng thái COMPLETED | Kiểm tra payment của ride này |
| 17 | Quản trị viên | Vào Payments và tìm theo rideId | Kiểm tra giao dịch thanh toán đã hoàn tất | Payment tương ứng ở trạng thái COMPLETED | Kiểm tra dữ liệu thống kê phụ |
| 18 | Khách hàng | Mở Activity | Kiểm tra chuyến vừa hoàn tất đã được ghi vào phần thống kê và lịch sử | Số chuyến hoàn tất tăng lên hoặc chuyến mới xuất hiện trong lịch sử | Kiểm tra phía tài xế |
| 19 | Tài xế | Mở Earnings và History | Kiểm tra tài xế đã được cộng vào tổng số chuyến và có lịch sử chuyến mới | Total rides tăng, history có chuyến mới | Kết thúc kịch bản 1 |

### 5.4. Kết quả nghiệp vụ cần chốt sau kịch bản 1

Sau khi chạy xong kịch bản này, cần kết luận được các ý sau:

- Một ride duy nhất được theo dõi xuyên suốt bằng cùng một rideId.
- Ride đi qua đầy đủ các trạng thái chính từ lúc tạo đến lúc hoàn tất.
- Driver có thể thao tác theo đúng thứ tự nghiệp vụ.
- Payment được tạo và ở trạng thái hoàn tất.
- Customer chỉ có thể đánh giá sau khi chuyến đi hoàn thành.
- Admin nhìn thấy cùng một ride và payment tương ứng.

## 8. Kịch bản 2: Khách hàng hủy chuyến trước khi có tài xế nhận

### 6.1. Luồng nghiệp vụ của kịch bản này

Khách hàng đặt xe → hệ thống tạo ride ở trạng thái đang tìm tài xế → trước khi tài xế nhận, khách hàng chủ động hủy chuyến → admin thấy ride chuyển sang trạng thái đã hủy.

Kịch bản này dùng để kiểm tra quyền hủy chuyến của khách hàng trong giai đoạn ride chưa được phục vụ.

### 6.2. Dữ liệu sử dụng

| Dữ liệu | Giá trị |
| --- | --- |
| Điểm đón | Ben Thanh |
| Điểm đến | Tan Son Nhat Airport |

### 6.3. Các bước thực hiện chi tiết

| Bước | Vai trò thao tác | Hành động trên giao diện | Làm bước này để làm gì | Kết quả mong đợi | Bước tiếp theo |
| --- | --- | --- | --- | --- | --- |
| 1 | Khách hàng | Đăng nhập Customer App | Chuẩn bị tạo một ride mới để test tình huống hủy sớm | Vào trang chủ thành công | Tạo ride mới |
| 2 | Khách hàng | Nhập điểm đón Ben Thanh và điểm đến Tan Son Nhat Airport, sau đó xác nhận đặt xe | Tạo ride mới ở trạng thái ban đầu | Hệ thống chuyển tới trang chi tiết ride | Ghi lại rideId |
| 3 | Khách hàng | Ghi lại rideId trên URL | Dùng rideId để đối chiếu với admin | Có mã ride cụ thể | Sang admin kiểm tra |
| 4 | Quản trị viên | Mở Rides và tìm rideId vừa tạo | Xác nhận ride đã được tạo và đang chờ tài xế | Ride hiển thị FINDING_DRIVER | Quay lại customer để hủy |
| 5 | Khách hàng | Bấm Hủy chuyến khi ride vẫn chưa được ai nhận | Kiểm tra quyền hủy của khách hàng ở giai đoạn đầu | Ứng dụng quay lại trang chủ hoặc trạng thái ride kết thúc | Kiểm tra màn hình activity |
| 6 | Khách hàng | Mở Activity và xem phần đang diễn ra | Xác nhận hệ thống không còn coi ride này là chuyến active | Không còn chuyến đang diễn ra | Sang admin xác minh trạng thái cuối |
| 7 | Quản trị viên | Mở lại Rides và tìm đúng rideId | Kiểm tra dữ liệu quản trị đã đồng bộ việc hủy | Ride có trạng thái CANCELLED | Kết thúc kịch bản 2 |

### 6.4. Kết quả nghiệp vụ cần chốt sau kịch bản 2

- Khách hàng được phép hủy khi chưa có tài xế phục vụ.
- Ride biến mất khỏi trạng thái đang diễn ra của khách hàng.
- Admin nhìn thấy ride đã chuyển sang CANCELLED.
- Không có luồng hoàn tất hay thanh toán tiếp tục chạy cho ride đã hủy.

## 9. Kịch bản 3: Tài xế hủy chuyến sau khi đã nhận

### 7.1. Luồng nghiệp vụ của kịch bản này

Khách hàng đặt xe → tài xế online và nhận chuyến → trước khi chuyến đi hoàn tất, tài xế chủ động hủy → khách hàng nhìn thấy chuyến bị hủy → admin ghi nhận ride bị hủy.

Kịch bản này dùng để kiểm tra tình huống ride đã được nhận nhưng bị hủy từ phía tài xế.

### 7.2. Dữ liệu sử dụng

| Dữ liệu | Giá trị |
| --- | --- |
| Điểm đón | Ben Thanh |
| Điểm đến | Tan Son Nhat Airport |

### 7.3. Các bước thực hiện chi tiết

| Bước | Vai trò thao tác | Hành động trên giao diện | Làm bước này để làm gì | Kết quả mong đợi | Bước tiếp theo |
| --- | --- | --- | --- | --- | --- |
| 1 | Khách hàng | Tạo một ride mới với cùng bộ dữ liệu mẫu | Tạo đầu vào cho tình huống tài xế hủy chuyến | Có trang chi tiết ride mới | Ghi lại rideId |
| 2 | Khách hàng | Ghi lại rideId trên URL | Dùng để đối chiếu customer, driver và admin trên cùng một chuyến | Có mã ride cụ thể | Chuyển sang driver |
| 3 | Tài xế | Đảm bảo trạng thái online và bấm nhận chuyến | Kiểm tra tài xế có thể tiếp nhận ride vừa tạo | Driver vào màn hình active ride | Mở thao tác hủy |
| 4 | Tài xế | Bấm nút hủy chuyến trên màn hình active ride | Kiểm tra quyền hủy từ phía tài xế sau khi đã nhận ride | Xuất hiện hộp thoại xác nhận hủy | Xác nhận hủy |
| 5 | Tài xế | Xác nhận đồng ý hủy chuyến | Gửi trạng thái hủy từ driver lên hệ thống | Driver quay về dashboard | Kiểm tra phía customer |
| 6 | Khách hàng | Mở lại hoặc refresh trang ride theo đúng rideId | Kiểm tra trạng thái hủy đã cập nhật về ứng dụng khách hàng | Trang ride hiển thị Chuyến đi đã hủy | Sang admin xác minh |
| 7 | Quản trị viên | Mở Rides và tìm rideId | Kiểm tra dữ liệu quản trị phản ánh đúng việc tài xế hủy | Ride có trạng thái CANCELLED | Kết thúc kịch bản 3 |

### 7.4. Kết quả nghiệp vụ cần chốt sau kịch bản 3

- Tài xế có thể hủy ride sau khi đã nhận.
- Customer nhận được trạng thái hủy tương ứng.
- Admin nhìn thấy ride ở trạng thái CANCELLED.
- Ride đã hủy không tiếp tục đi qua các bước pickup, start, complete.

## 10. Mẫu ghi nhận kết quả sau khi test

Người test nên ghi lại ít nhất các thông tin sau cho mỗi lần chạy:

| Mục cần ghi | Nội dung nên lưu lại |
| --- | --- |
| Thời gian test | Ngày giờ bắt đầu và kết thúc |
| Người thực hiện | Tên người test |
| Kịch bản đã chạy | Kịch bản 1, 2 hoặc 3 |
| rideId | Mã ride dùng để đối chiếu giữa các màn hình |
| Kết quả | Pass hoặc Fail |
| Bằng chứng | Ảnh chụp màn hình hoặc video nếu có |
| Ghi chú lỗi | Nếu lỗi, ghi rõ lỗi xuất hiện ở bước nào |

## 11. Cách ghi nhận lỗi theo nhóm

Khi phát hiện lỗi, cần ghi rõ lỗi thuộc nhóm nào để dễ ưu tiên xử lý:

- Nhóm A: Lỗi chặn nghiệp vụ, ví dụ không đăng nhập được, không đặt chuyến được, không nhận chuyến được.
- Nhóm B: Lỗi dữ liệu, ví dụ hồ sơ sai thông tin, rating sai, admin hiển thị lệch trạng thái.
- Nhóm C: Lỗi UX, ví dụ ô nhập bị map che, loading quá lâu, icon khó nhìn.
- Nhóm D: Thiếu tính năng, ví dụ chưa có sửa profile, chưa có duyệt tài xế ở admin.

## 12. Lưu ý khi thao tác thực tế

- Nếu customer tạo ride nhưng driver chưa thấy chuyến ngay, chờ thêm vài giây để cơ chế polling hoặc realtime cập nhật.
- Nếu giao diện customer mở được flow nhưng báo `Hệ thống đang phản hồi chậm`, ghi nhận lại hành trình, thời điểm và thử đóng/mở flow một lần nữa để đối chiếu tính ổn định.
- Nếu admin chưa thấy trạng thái mới ngay lập tức, tải lại trang danh sách rides hoặc payments.
- Nếu admin không thấy hồ sơ ở trang `Duyệt hồ sơ`, kiểm tra lại xem tài xế vừa tạo có còn ở trạng thái `PENDING` hay đã được duyệt từ lần test trước.
- Mỗi lần test một kịch bản mới, nên xác nhận lại rằng không còn ride active từ lần test trước.

## 13. Lệnh hỗ trợ nếu cần chạy lại smoke tự động

Phần này chỉ để tham khảo khi cần so sánh với kết quả thao tác tay trên giao diện:

- npm run smoke:browser
- npm run smoke:browser:lifecycle
- npm run smoke:browser:cancellations