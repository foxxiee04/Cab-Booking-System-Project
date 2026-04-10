# Hướng dẫn test thanh toán sandbox (bản dễ làm)

## 1. Mục tiêu
Tài liệu này giúp QA/dev test nhanh thanh toán `MOMO` và `VNPAY` theo đúng nghiệp vụ hiện tại:
- `CASH`: tạo chuyến xong là tìm tài xế ngay.
- `MOMO`/`VNPAY`: chỉ tìm tài xế sau khi thanh toán thành công.

## 2. Luồng ngắn gọn
1. Customer tạo chuyến và chọn `MOMO` hoặc `VNPAY`.
2. Frontend gọi API tạo payment:
   - `POST /api/payments/momo/create`
   - `POST /api/payments/vnpay/create`
3. Frontend nhận `payUrl`/`paymentUrl` và redirect sang cổng sandbox.
4. Cổng thanh toán trả về callback của app.
5. Backend cập nhật trạng thái payment và phát event `payment.completed` khi thành công.
6. `ride-service` nhận event và mới chuyển sang tìm tài xế.

## 3. Chuẩn bị trước khi test
1. Reset dữ liệu:
   - Windows: `scripts/reset-database.bat`
   - Linux/macOS: `scripts/reset-database.sh`
2. Bật các service tối thiểu:
   - `api-gateway`, `payment-service`, `ride-service`, `customer-app`
3. Kiểm tra env sandbox:
   - MoMo: `partnerCode`, `accessKey`, `secretKey`, endpoint sandbox
   - VNPay: `tmnCode`, `hashSecret`, endpoint sandbox
4. Kiểm tra `returnUrl` đúng domain frontend đang chạy.

## 4. Cách test nhanh nhất

### 4.1 Test đầy đủ qua cổng sandbox
1. Tạo chuyến mới trên customer-app.
2. Chọn `MOMO` hoặc `VNPAY`.
3. Hoàn tất thanh toán trên cổng sandbox.
4. Quay lại app và kiểm tra:
   - UI báo thành công/thất bại đúng.
   - Nếu thành công: ride bắt đầu tìm tài xế.

### 4.2 Test không cần đăng nhập app MoMo (bypass QR)
Dùng cách này khi môi trường MoMo UAT khó đăng nhập.

1. Tạo payment record:
   - `POST /api/payments`
   - body tối thiểu: `orderId`, `amount`, `method`, `provider`, `rideId`
2. Giả lập callback thành công:
   - `GET /api/payments/momo/return?rideId=<rideId>&resultCode=0&transId=TEST123`
3. Hoặc giả lập thất bại:
   - `GET /api/payments/momo/return?rideId=<rideId>&resultCode=1006`

Kỳ vọng:
- `resultCode=0` -> payment `COMPLETED`, ride được phép tìm tài xế.
- mã khác `0` -> payment `FAILED`, ride không chuyển sang tìm tài xế.

### 4.3 Hủy chuyến sau khi đã thanh toán online
Áp dụng khi customer đã thanh toán `MOMO` xong rồi hủy chuyến.

Kỳ vọng nghiệp vụ:
1. Ride chuyển `CANCELLED`.
2. Payment không nên báo ngay kiểu chung chung là "tiền đã về ví" nếu hệ thống mới chỉ vừa gửi refund request.
3. Với `MOMO`, backend phải tạo refund request riêng và lưu lại thông tin đối soát như `requestId`, `refund orderId`, `resultCode`, `transId`, thời điểm ghi nhận.
4. UI customer nên hiển thị theo 2 bước:
   - Khi ride vừa hủy nhưng payment còn `COMPLETED`: "Hệ thống đang gửi yêu cầu hoàn tiền tới MoMo".
   - Khi payment đã thành `REFUNDED`: "MoMo đã ghi nhận hoàn tiền cho chuyến bị hủy".
5. Thông tin nên hiển thị gồm:
   - số tiền hoàn
   - thời điểm ghi nhận hoàn tiền
   - mã yêu cầu hoàn (`requestId`)
   - mã hoàn tiền nội bộ gửi MoMo (`refund orderId`)
   - mã phản hồi từ MoMo (`resultCode`)
   - lý do hoàn tiền

Lưu ý về câu chữ:
- Nên dùng các cụm như `MoMo đã ghi nhận hoàn tiền` hoặc `hệ thống đang gửi yêu cầu hoàn tiền tới MoMo`.
- Không nên luôn mặc định hiển thị `tiền đã về ví` vì sandbox và thời gian đối soát có thể khác với lúc app nhận callback.

## 5. Tài khoản test MoMo (nếu dùng app test)
Thông tin chung:
- Mật khẩu: `000000`
- OTP: `000000`

Nhóm tài khoản thường thành công:
- `0917003003`, `0917030000`, `0917030003`, `0917030030`, `0917030300`, `0917300300`

Nhóm hạn mức 30.000.000:
- `0919100100`, `0919100010`, `0919100001`, `0919010100`, `0919010010`, `0919100101`

Nhóm hạn mức 5.000.000:
- `0918002000`, `0918002020`, `0918002200`

Nhóm mô phỏng không thành công:
- `0916005000`, `0916005050`, `0916005500`

Lưu ý: tài khoản test có thể bị thay đổi theo thời điểm bởi phía cổng.

## 6. Dữ liệu test VNPay nội địa (NCB)
Case thành công:
- Số thẻ: `9704198526191432198`
- Tên chủ thẻ: `NGUYEN VAN A`
- Ngày phát hành: `07/15`
- OTP: `123456`

Case thất bại thường dùng:
- Không đủ số dư: `9704195798459170488`
- Thẻ chưa kích hoạt: `9704192181368742`
- Thẻ bị khóa: `9704193370791314`
- Thẻ hết hạn: `9704194841945513`

## 7. Checklist sau mỗi testcase
1. UI callback hiển thị đúng trạng thái.
2. Bảng `Payment` có trạng thái đúng (`COMPLETED` hoặc `FAILED`).
3. Có `transactionId` nếu là case thành công.
4. Có event `payment.completed` ở case thành công.
5. Ride chỉ chuyển sang tìm tài xế sau khi online payment thành công.

## 8. Lỗi thường gặp và cách xử lý

### 8.1 Không tạo được `payUrl`
- Kiểm tra env sandbox và token nội bộ giữa gateway và payment-service.
- Kiểm tra `rideId` tồn tại, `amount > 0`.

### 8.2 Callback về nhưng sai trạng thái
- Kiểm tra chữ ký và tham số callback (`resultCode`, `vnp_ResponseCode`, `rideId`).
- Kiểm tra mapping query ở frontend callback page.

### 8.3 Không redirect đúng frontend
- Kiểm tra `returnUrl` lúc tạo giao dịch.
- Kiểm tra domain frontend theo môi trường local/docker.

## 9. Bảo mật
- Không commit secret sandbox thật.
- Không log full `secretKey`/`hashSecret`.
- Chỉ log các trường cần đối soát: `rideId`, `paymentId`, `transactionId`, `provider`, `status`.
