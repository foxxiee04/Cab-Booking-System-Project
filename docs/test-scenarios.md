# Kịch bản kiểm thử thủ công — FoxGo Cab Booking

> Phiên bản: 01/05/2026  
> Môi trường: dev local (Docker Compose)  
> Tất cả mật khẩu: `Password@1`  
> OTP (dev): `docker logs cab-auth-service 2>&1 | findstr OTP`

---

## Tài khoản seed

| Loại     | Số điện thoại | Tên           | Ghi chú                                      |
|----------|---------------|---------------|----------------------------------------------|
| Customer | 0901234561    | Nguyen Van A  | Customer 1 (chính)                           |
| Customer | 0901234562    | Nguyen Van B  | Customer 2                                   |
| Customer | 0901234563    | Nguyen Van C  | Customer 3                                   |
| Driver   | 0911234561    | Pham Van D    | Toyota Vios 51A-123.45, CAR_4, Bến Thành     |
| Driver   | 0911234562    | Vo Thi E      | Honda City 51A-678.90, CAR_4, Bến Thành      |
| Driver   | 0911234568    | (Driver 3)    | CAR_4, Bến Thành cluster                     |
| Admin    | 0900000001    | —             | Đăng nhập `http://localhost:4002`            |

---

## TC-01: Hủy chuyến seeded và đặt chuyến mới (1 khách, 1 tài xế)

**Mục tiêu:** Full booking flow từ đầu đến cuối với tiền mặt.

**Tài khoản:** Customer 1 + Driver 1

### Bước thực hiện

1. Mở `http://localhost:4000` → đăng nhập Customer 1 (`0901234561`)
2. Nếu có chuyến seeded đang ở trạng thái `FINDING_DRIVER`:
   - Nhấn **Hủy chuyến** → chọn lý do (vd: "Đặt nhầm chuyến") → **Xác nhận hủy**
   - Lặp lại nếu còn chuyến seeded khác
   - Nhấn **Quay về trang chủ**
3. Mở `http://localhost:4001` (tab khác cùng trình duyệt, hoặc cửa sổ khác) → đăng nhập Driver 1 (`0911234561`)
   - Kiểm tra tài xế đang **Trực tuyến** và loại xe **Ô tô 4 chỗ**
4. Trở về trang khách hàng → nhập điểm đón: `Bến Thành` → chọn **Phường Bến Thành, TP. HCM**
   - Nhập điểm đến: `Sân bay Tân Sơn Nhất` → chọn **Sân bay quốc tế Tân Sơn Nhất**
   - Nhấn **Tiếp tục đặt xe**
5. Chọn **Xe 4 chỗ** → nhấn **Tiếp tục**
6. Chọn thanh toán **Tiền mặt** → nhấn **Tiếp tục**
7. Xem xác nhận (7.7 km, ~11 phút, 166.100 ₫) → nhấn **Xác nhận và tìm tài xế**

### Kết quả mong đợi (Customer)
- Chuyển sang trang theo dõi → hiển thị **"Đang tìm tài xế phù hợp"**

### Bước tiếp theo (Driver)
8. Driver 1 nhận được thông báo dispatch (countdown ~30s)
   - Nhấn **Nhận ngay** (hoặc nếu hết giờ: ride vẫn hiện trong danh sách cuốc, nhấn **✓ Nhận ngay**)

### Kết quả mong đợi (Customer sau accept)
- Trang tracking cập nhật: **"Đã tìm được tài xế"**
- Hiển thị tên tài xế: **Pham Van D**, xe **Toyota Vios White**, biển **51A-123.45**
- Panel ETA/khoảng cách hiện ra (vd: "khoảng 1 phút · 0.5 km") — **không** hiển thị nếu chưa có dữ liệu GPS ✓
- Có thể nhấn icon điện thoại để gọi tài xế ✓

### Bước tiếp theo (Driver)
9. Driver: nhấn **Đã tới điểm đón** → trạng thái "Đã tới điểm đón"
10. Driver: nhấn **Đã đến - Bắt đầu** → trạng thái "Đang chở khách"

### Kết quả mong đợi (Customer)
- Tracking cập nhật: **"Đang trong chuyến đi"**
- Không hiển thị nút Nhắn tin tài xế riêng ngoài panel ✓

11. Driver: nhấn **Hoàn tất chuyến**

### Kết quả mong đợi
- Driver: toast **"Chuyến tiền mặt hoàn thành"** — hiển thị phí nền tảng 18% ✓
- Customer: hiển thị trang hoàn tất + **Hóa đơn** + form **Đánh giá tài xế**
  - Trạng thái thanh toán: **Đã thanh toán** (tiền mặt tự động) ✓
  - Rating 5 sao → nhấn **Gửi đánh giá** → form chuyển sang "Đánh giá của bạn" ✓

---

## TC-02: Race condition 3 tài xế, 1 khách (3D-1C)

**Mục tiêu:** Kiểm tra chỉ 1 tài xế được nhận; lỗi trả về tiếng Việt; nút Bỏ qua hoạt động độc lập.

**Tài khoản:** Customer 1, Driver 1, Driver 2

### Bước thực hiện

1. Mở 3 tab/cửa sổ riêng:
   - Tab A (Customer 1): `http://localhost:4000`
   - Tab B (Driver 1): `http://localhost:4001` → đăng nhập `0911234561`
   - Tab C (Driver 2): `http://localhost:4001` (cửa sổ mới) → đăng nhập `0911234562`
   
   > **Lưu ý:** Nhờ sessionStorage, mỗi tab lưu token độc lập — không bị ghi đè nhau ✓

2. Đảm bảo cả 2 tài xế **Trực tuyến**
3. Customer 1 đặt chuyến **Xe 4 chỗ**, khu vực **Bến Thành** (cả 2 tài xế đều gần)
4. Quan sát thông báo dispatch trên cả 2 tab tài xế
5. Cả 2 tài xế nhấn **✓ Nhận ngay** gần như cùng lúc

### Kết quả mong đợi
- Chỉ 1 tài xế thành công → chuyển sang `/active-ride`
- Tài xế còn lại thấy lỗi: **"Chuyến đi đã có tài xế."** (tiếng Việt, không phải English) ✓
- Khách thấy đúng 1 tài xế được gán ✓

### Kiểm tra nút Bỏ qua
6. Trên tab tài xế đang ở dashboard (có danh sách cuốc):
   - Nhấn **Bỏ qua** trên một ride → ride đó biến khỏi danh sách
   - Nút Bỏ qua của ride khác **không bị disabled** trong khi đang nhấn Nhận ngay ride kia ✓

---

## TC-03: Browse mode (tài xế nhận chuyến qua danh sách, không qua dispatch)

**Mục tiêu:** Kiểm tra cơ chế browse-mode (suggestedDriverIds gate đã bị xóa).

**Tài khoản:** Customer 1, Driver 1

### Bước thực hiện

1. Customer đặt chuyến **Xe 4 chỗ**
2. **Không** tương tác với tab Driver trong vòng 30s (để dispatch timer hết)
3. Sau khi hết timer, ride xuất hiện trong **"Danh sách cuốc đang chờ nhận"** của Driver 1
4. Driver nhấn **✓ Nhận ngay** từ danh sách

### Kết quả mong đợi
- Ride được accept thành công (không bị chặn bởi `suggestedDriverIds`) ✓
- Customer nhận được thông báo tài xế đã tìm thấy ✓

---

## TC-04: Đặt chuyến tiền mặt — kiểm tra wallet driver (cash debt)

**Mục tiêu:** Driver nhận tiền mặt → nợ platform fee → ví trừ tự động.

**Tài khoản:** Driver 1 (xem ví trước và sau chuyến)

### Bước thực hiện

1. Driver 1 vào **Ví tiền** → ghi lại số dư hiện tại
2. Chạy 1 chuyến tiền mặt (TC-01)
3. Sau khi hoàn tất, driver xem thông báo: **"Chuyến tiền mặt hoàn thành — Phí nền tảng X ₫ (18%) đã ghi nợ"**
4. Vào **Ví tiền** → kiểm tra số dư giảm đúng bằng `18% × cước phí`

### Kết quả mong đợi
- Số dư giảm đúng commission rate: MOTORBIKE 20%, CAR_4 18%, CAR_7 15% ✓

---

## TC-05: Kiểm tra Admin Dashboard

**Mục tiêu:** UUID truncation + bank account section + đăng nhập thành công.

**Tài khoản:** Admin (`0900000001`)

### Bước thực hiện

1. Mở `http://localhost:4002` → đăng nhập admin
   - **Mong đợi:** Dashboard load thành công, không bị redirect về login ✓ (đã fix sessionStorage bug)

2. Vào **Tài xế** (sidebar)
   - Cột ID hiển thị 8 ký tự uppercase, vd: `ABCD1234` ✓
   - Hover vào ID → tooltip hiện đầy đủ UUID 36 ký tự ✓

3. Vào **Khách hàng** (sidebar)
   - Cột ID: tương tự truncate 8 ký tự ✓

4. Vào **Chuyến đi** (sidebar)
   - Cột ID: tương tự truncate 8 ký tự ✓

5. Vào **Tài chính** → **Ví thương nhân** (merchant wallet)
   - Section "Tài khoản ngân hàng hệ thống": hiển thị 1 card duy nhất (dedup theo accountNumber) ✓
   - Không phân biệt type SETTLEMENT/PAYOUT nữa ✓

---

## TC-06: Đăng ký tài khoản mới (registration flow)

**Mục tiêu:** End-to-end registration với OTP mock.

### Bước thực hiện

1. Mở `http://localhost:4000` → nhấn **Đăng ký ngay**
2. Nhập số điện thoại mới (vd: `0901999001`), họ tên, mật khẩu `Password@1`
3. Nhấn **Gửi OTP**
4. Lấy OTP từ docker logs:
   ```
   docker logs cab-auth-service 2>&1 | findstr OTP
   ```
5. Nhập OTP → nhấn **Xác nhận**

### Kết quả mong đợi
- Tài khoản được tạo → tự động đăng nhập → chuyển về trang chủ ✓
- Có thể đặt chuyến ngay ✓

---

## TC-07: Kiểm tra tab isolation (sessionStorage)

**Mục tiêu:** Tab riêng không chia sẻ session, kể cả trong cùng cửa sổ incognito.

### Bước thực hiện

1. Mở 2 tab cùng `http://localhost:4000` trong cùng cửa sổ Chrome
2. Tab 1: đăng nhập Customer 1 (`0901234561`)
3. Tab 2: đăng nhập Customer 2 (`0901234562`)
4. Kiểm tra:
   - Tab 1 vẫn hiện "Xin chào, Nguyen!" (Customer 1) ✓
   - Tab 2 hiện tên Customer 2 ✓
   - Đăng xuất ở Tab 2 → Tab 1 không bị đăng xuất ✓

---

## TC-08: Gọi điện tài xế từ chat widget

**Mục tiêu:** Nút điện thoại trong panel nhắn tin driver.

**Bước thực hiện** (trong khi đang có chuyến PICKING_UP / IN_PROGRESS):
1. Customer nhấn icon chat/bell → mở widget chat
2. Chuyển sang tab **"Nhắn tin tài xế"**
3. Kiểm tra có icon điện thoại (📞) ở góc trên bên phải panel
4. Nhấn → trình duyệt mở `tel:0911234561` ✓

---

## Thứ tự chạy đề xuất

| Thứ tự | Test Case | Thời gian ước tính |
|--------|-----------|-------------------|
| 1      | TC-07 (tab isolation)      | 2 phút  |
| 2      | TC-01 (1C-1D full flow)    | 8 phút  |
| 3      | TC-04 (cash wallet check)  | 3 phút  |
| 4      | TC-02 (3D-1C race)         | 5 phút  |
| 5      | TC-03 (browse mode)        | 4 phút  |
| 6      | TC-05 (admin dashboard)    | 3 phút  |
| 7      | TC-06 (registration)       | 3 phút  |
| 8      | TC-08 (call button)        | 1 phút  |

**Tổng: ~29 phút**

---

## Lỗi đã biết / không cần test

- Map tiles lỗi 404: bình thường trong dev (OpenStreetMap bị chặn hoặc network timeout)
- GPS warning trên driver app: bình thường (browser không có GPS)
- `adminToken` từ localStorage: đã fix sang `sessionStorage.getItem('accessToken')`
