# Kịch bản Demo FoxGo — KLTN 2025

> **Địa điểm demo:** Đại học Công Nghiệp TP.HCM (IUH) — 12 Nguyễn Văn Bảo, Phường 4, Gò Vấp
> **Tọa độ IUH (điểm đón):** `10.8192, 106.6685`
> **Loại xe demo:** Ô tô 4 chỗ (CAR_4) — nhất quán cho mọi luồng
> **Mật khẩu tất cả tài khoản:** `Password@1`

---

## ⚡ Reset Nhanh Trước Demo

```cmd
scripts\reset-database.bat
npx tsx scripts/seed-database.ts
npm run dev:frontends
```

> `seed-database.ts` tạo: 2 admin, 100 khách hàng, 40 tài xế (37 approved + 3 PENDING), 5 vouchers, ~30 live API rides + ~370 historical rides (tổng ~400) đồng bộ qua **TẤT CẢ** stores: ride_db ↔ payment_db ↔ wallet_db (transactions + ledger + balance) ↔ review_db (Mongo) ↔ driver ratings. Thời gian ~3-5 phút.

---

## Tài Khoản Demo

| Vai trò | SĐT | Họ tên | App | Ghi chú | Ảnh seed |
|---------|-----|--------|-----|----------|----------|
| **Khách hàng** | `0901234571` | Nguyen Thi Demo | http://localhost:4000 | Bật GPS tại IUH | Avatar: `assets/avt/cccd/avt.jpg` |
| **Tài xế A** | `0911234583` | Pham Van Bao | http://localhost:4001 | CAR_4 · ⭐ 4.8 | Avatar: `assets/avt/cccd/avt.jpg` · CCCD: `assets/avt/cccd/cccd.png` |
| **Tài xế B** | `0911234585` | Le Thi Mai | http://localhost:4001 (Incognito) | CAR_4 · ⭐ 3.5 | Avatar: `assets/avt/cccd/avt.jpg` · CCCD: `assets/avt/cccd/cccd.png` |
| **Tài xế C** | `0911234573` | Le Minh N | http://localhost:4001 (Firefox) | CAR_4 · ⭐ 4.2 | Avatar: `assets/avt/cccd/avt.jpg` · CCCD: `assets/avt/cccd/cccd.png` |
| **Admin 1** | `0900000001` | System Admin | http://localhost:4002 | — | Avatar: `assets/avt/cccd/avt.jpg` |
| **Admin 2** | `0900000002` | Sub Admin | http://localhost:4002 | Sub-admin (test multi-admin) | Avatar: `assets/avt/cccd/avt.jpg` |

> `scripts/seed-database.ts` encode các asset trên thành data URL khi seed, nên avatar/CCCD hiển thị lại sau mỗi lần reset + seed mà không cần upload thủ công. CCCD chỉ áp dụng cho tài xế.

### GPS Tài xế — Tự động (không cần DevTools)

Khi trình duyệt từ chối quyền GPS, driver app tự dùng tọa độ hardcoded theo SĐT đăng nhập:

| Tài xế | SĐT | GPS Fallback (tự động) | Khoảng cách IUH | Vòng dispatch |
|--------|-----|----------------------|-----------------|---------------|
| Pham Van Bao | `0911234583` | `10.8327, 106.6685` | ~1.5 km | Vòng 1 (≤ 2km) |
| Le Thi Mai | `0911234585` | `10.8437, 106.6685` | ~2.7 km | Vòng 2 (≤ 3km) |
| Le Minh N | `0911234573` | `10.8551, 106.6685` | ~4.0 km | Vòng 3 (≤ 5km) |

> Tọa độ đăng ký vào Redis geo set `drivers:geo:online` và cập nhật mỗi 5 giây. **Không cần Chrome DevTools → Sensors.**

### GPS Khách hàng

Bật GPS trên thiết bị và cho phép trình duyệt truy cập — bản đồ tự định vị tại IUH.  
Nếu không có GPS thiết bị: kéo thủ công pin đến IUH trên bản đồ (`10.8192, 106.6685`).

---

## Chuẩn Bị (1 lần trước mỗi demo)

### Bước 1 — Khởi động stack
```cmd
npm run docker:up
```

### Bước 2 — Reset DB + seed (bắt buộc nếu có rides/data cũ)
```cmd
scripts\reset-database.bat
npx tsx scripts/seed-database.ts
```

### Bước 3 — Khởi động frontend
```cmd
npm run dev:frontends
```

### Bước 4 — Mở 5 tab browser

| Tab | URL | Tài khoản |
|-----|-----|-----------|
| Chrome (normal) | http://localhost:4000 | `0901234571` |
| Chrome tab 2 | http://localhost:4001 | `0911234583` |
| Chrome Incognito | http://localhost:4001 | `0911234585` |
| Firefox | http://localhost:4001 | `0911234573` |
| Chrome tab 3 | http://localhost:4002 | `0900000001` |

### Bước 5 — Bật Online cho 3 tài xế

Vào từng tab tài xế → nhấn **"Bắt đầu nhận chuyến"**. GPS fallback tự kích hoạt nếu browser từ chối quyền vị trí.

### Bước 6 — Xác nhận GPS đăng ký (tùy chọn)
```cmd
docker exec cab-redis redis-cli GEORADIUS "drivers:geo:online" 106.6685 10.8192 5000 m WITHDIST ASC
```
Kết quả mong đợi: 3 driver ID với khoảng cách ~1500m, ~2700m, ~4000m.

---

## Dispatch Scoring — 3 Tài xế tại IUH

| Tài xế | SĐT | Xe | GPS Fallback | Khoảng cách | Vòng dispatch |
|--------|-----|-----|-------------|-------------|---------------|
| Pham Van Bao | `0911234583` | CAR_4 Toyota Vios · ⭐4.8 | `10.8327, 106.6685` | ~1.5 km | Vòng 1 (≤ 2km) |
| Le Thi Mai | `0911234585` | CAR_4 Hyundai Accent · ⭐3.5 | `10.8437, 106.6685` | ~2.7 km | Vòng 2 (≤ 3km) |
| Le Minh N | `0911234573` | CAR_4 Kia K3 · ⭐4.2 | `10.8551, 106.6685` | ~4.0 km | Vòng 3 (≤ 5km) |

**Công thức điểm:**
```
Score = Distance × 40% + Rating × 25% + IdleTime × 15%
      + AcceptanceRate × 15% − CancelRate × 5%
      [+ AI p_accept adjustment ±max 8%, timeout 150ms, fallback = 0]
```

---

## Luồng A — Vòng Đời Chuyến Đi (End-to-End)

**Mục tiêu:** Toàn bộ chu trình từ đặt xe → hoàn tất → đánh giá  
**Cần:** Tài xế A (`0911234583`) Online

### A1. Đặt xe tiền mặt

1. **[Customer :4000]** Kéo pin điểm đón đến **IUH** (hoặc nhập "Đại học Công nghiệp")
2. Điểm đến: **"Vincom Plaza Gò Vấp"**
3. Chọn **Ô tô 4 chỗ** → Thanh toán **Tiền mặt** → nhấn **Đặt xe**

### A2. Tài xế nhận chuyến

4. **[Tài xế A :4001]** — Sau ≤ 15 giây, popup hiện với: tên khách, điểm đón/đến, cước, khoảng cách, đếm ngược 30s
5. Tài xế nhấn **Nhận cuốc** ✅
6. **[Customer]** Nhận thông báo: tên tài xế, SĐT, biển số, vị trí trên bản đồ

### A3. Thực hiện chuyến

7. **[Tài xế A]** → **Đã đến điểm đón** → **Bắt đầu chuyến** → **Hoàn tất chuyến**

### A4. Đánh giá hai chiều

8. **[Customer]** Đánh giá tài xế: ⭐5 + nhận xét
9. **[Tài xế A]** Đánh giá khách: ⭐5
10. Lịch sử cả hai phía → trạng thái **COMPLETED**

**Điểm chứng minh:** State machine `CREATED → FINDING_DRIVER → ACCEPTED → DRIVER_EN_ROUTE → IN_PROGRESS → COMPLETED`; hoa hồng 18% tự động trừ ví tài xế ngay sau hoàn tất

---

## Luồng B — Dispatch 3 Vòng (Mở Rộng Bán Kính)

**Mục tiêu:** Chứng minh thuật toán dispatch 2km → 3km → 5km và scoring  
**Cần:** Cả 3 tài xế đang **Online**

### Vòng 1 — Bán kính 2km → Tài xế A

1. **[Customer :4000]** Đặt xe CAR_4 từ IUH
2. Hệ thống tìm trong 2km → tìm thấy **Pham Van Bao** (⭐4.8, 1.5km)
3. **[Tài xế A]** Nhận popup → nhấn **Từ chối**
4. Hệ thống ghi `rejectedDriverIds = [driverA]` → khởi động Vòng 2

### Vòng 2 — Bán kính 3km → Tài xế B

5. Hệ thống mở rộng 3km → tìm thấy **Le Thi Mai** (⭐3.5, 2.7km), loại trừ Tài xế A
6. **[Tài xế B Incognito]** Nhận popup → nhấn **Từ chối**
7. Hệ thống ghi thêm `rejectedDriverIds = [driverA, driverB]` → khởi động Vòng 3

### Vòng 3 — Bán kính 5km → Tài xế C

8. Hệ thống mở rộng 5km → tìm thấy **Le Minh N** (⭐4.2, 4.0km), loại trừ A và B
9. **[Tài xế C Firefox]** Nhận popup → nhấn **Nhận cuốc** ✅
10. **[Customer]** Nhận thông báo: Tài xế C (từ 4km)

**Điểm chứng minh:**
- 3 vòng: `2km×1, 3km×3, 5km×5` (cấu hình `MATCHING_ROUNDS` trong `env/gateway.env`)
- Scoring: `Distance×40% + Rating×25% + Idle×15% + AcceptRate×15% − CancelRate×5%`
- Tài xế từ chối → acceptance rate giảm → score thấp hơn ở dispatch sau
- AI `p_accept` model điều chỉnh score ±max 8%, timeout 150ms, fallback = 0

---

## Luồng C — Thanh toán Online + Voucher

**Mục tiêu:** Chứng minh tích hợp MoMo/VNPay và mã giảm giá

1. **[Customer]** Đặt xe CAR_4 từ IUH → Sân bay Tân Sơn Nhất
2. Phương thức: **Ví MoMo**
3. Nhập mã: **`WEEKEND10`** (giảm 10%, tối đa 30.000đ)
4. App hiện: giá gốc, số tiền giảm, giá sau giảm → **Xác nhận đặt**
5. Chuyển sang trang MoMo sandbox → xác nhận thanh toán
6. Callback → trang xác nhận FoxGo (header xanh navy, card trắng, đếm ngược 3s)
7. Tự động chuyển về trang chuyến đi

**Kiểm tra ở Admin (:4002) → Merchant Wallet → Sổ cái:**
- `PAYMENT` (THU): Tiền khách nạp
- `VOUCHER` (CHI): Trợ giá WEEKEND10
- `COMMISSION` (THU): Hoa hồng 18%

**Vouchers có sẵn:**

| Code | Giảm | Điều kiện |
|------|------|-----------|
| `WEEKEND10` | 10%, tối đa 30.000đ | Tất cả |
| `FLAT30K` | 30.000đ flat | Đơn ≥ 80.000đ |
| `NEWUSER50` | 50%, tối đa 100.000đ | Khách mới |
| `WELCOME20` | 20%, tối đa 50.000đ | Khách mới |
| `OLDUSER15` | 15%, tối đa 40.000đ | Đơn ≥ 50.000đ |

---

## Luồng D — Chat Trong Chuyến (Real-time)

**Mục tiêu:** Nhắn tin 2 chiều thời gian thực, tin nhắn persist  
**Cần:** Có chuyến đang ở trạng thái `DRIVER_EN_ROUTE` hoặc `IN_PROGRESS`

1. Trong chuyến đang chạy, **[Customer :4000]** nhấn icon 💬 Chat
2. Nhập: *"đứng ở cổng B nhé"* → Gửi
3. **[Tài xế A :4001]** Nhận tin ngay lập tức (không reload trang)
4. Tài xế trả lời: *"Dạ, em đang tới, khoảng 2 phút nữa ạ!"*
5. **[Customer]** Nhận tin tức thì
6. Reload 1 trang → lịch sử chat vẫn hiện đầy đủ

**Điểm chứng minh:** Socket.IO room `ride:{rideId}`, 2 chiều realtime, tin nhắn persist không mất sau reload

---

## Luồng E — AI Chatbot (Trợ lý FoxGo)

**Mục tiêu:** Chứng minh AI assistant hỗ trợ khách và tài xế với fallback tự động

### E1. Chatbot khách hàng

**[Customer :4000]** → icon Trợ lý AI

| Câu hỏi demo | Nội dung trả lời mong đợi |
|-------------|--------------------------|
| *"Giá xe 4 chỗ đi 5km khoảng bao nhiêu?"* | Trả bảng giá / ví dụ tham khảo: ô tô 4 chỗ khoảng 133.000đ cho 5km, 15 phút, chưa surge |
| *"Cước từ IUH đến sân bay Tân Sơn Nhất hiện tại bao nhiêu?"* | Nói rõ Mia không tính giá tuyến cụ thể qua chat; hướng dẫn nhập điểm đón/đến trong app để Pricing Service tính chính xác |
| *"Voucher không áp dụng được thì vì sao?"* | Nêu các nguyên nhân: hết hạn, chưa đạt đơn tối thiểu, sai loại xe, sai phương thức thanh toán, đã dùng |
| *"Thanh toán MoMo thành công nhưng không tạo chuyến"* | Hướng dẫn đợi 10–15 phút, gửi mã giao dịch + thời gian cho support@foxgo.vn; tiền hoàn 3–5 ngày làm việc nếu lỗi |
| *"Có xe 7 chỗ không?"* | Giới thiệu CAR_7 |

**Cách chứng minh API/model đang trả lời:** gọi `POST /api/ai/chat` qua gateway hoặc `POST /api/chat` trực tiếp ai-service; response có `mode`, `llm_provider`, `llm_model`, `reranker_active`, `rewrite_used`. Gọi `GET /api/ai/chat/status` để xem provider hiệu lực, key nào đang cấu hình, reranker đã load chưa.

### E2. Chatbot tài xế

**[Tài xế A :4001]** → icon Trợ lý

| Câu hỏi demo | Trả lời mong đợi |
|-------------|-----------------|
| *"Hoa hồng xe 4 chỗ bao nhiêu %?"* | CAR_4: 18%, CAR_7: 15%, xe máy: 20% |
| *"Tại sao tôi không nhận cuốc được?"* | Kiểm tra ví, GPS, trạng thái online |
| *"Quy định vận hành"* | Trả lời ngay bằng fallback cục bộ nếu AI service chậm/offline: đón đúng điểm, không chèo kéo ngoài app, an toàn giao thông, thái độ chuyên nghiệp |
| *"Làm sao tăng rating?"* | Tips phục vụ khách hàng |

### E3. Fallback khi AI offline

- Dừng ai-service (hoặc ngắt mạng nội bộ)
- Customer vẫn đặt xe, tài xế vẫn nhận cuốc bình thường
- Chat UI dùng fallback cục bộ cho một số câu phổ biến khi `/ai/chat` lỗi; các luồng nghiệp vụ đặt xe/ghép tài xế không phụ thuộc chatbot
- Các call AI nghiệp vụ như pricing/matching vẫn có timeout ngắn 150ms và fallback rule-based riêng

**Điểm chứng minh:** ai-service:8000, RAG multi-turn context, response diagnostics (`mode`, `llm_provider`, `reranker_active`) + graceful fallback

---

## Luồng F — Admin Dashboard

**Mục tiêu:** Quản trị: duyệt tài xế, theo dõi tài chính, thống kê  
**Login:** http://localhost:4002 · `0900000001` / `Password@1`

### F1. Duyệt tài xế PENDING

1. **Quản lý Tài xế** → tab **Chờ duyệt** (3 tài xế)
2. Chọn `0911234580` — Truong Van V (CAR_4 Mazda2, Bến Thành)
3. Xem hồ sơ: ảnh GPLX, CMND, thông tin xe, biển số
4. Nhấn **Phê duyệt** → tài xế nhận thông báo "Tài khoản đã được duyệt"
5. Đăng nhập `:4001` với `0911234580` → nút "Trực tuyến" khả dụng

### F2. Merchant Wallet — Tài chính hệ thống

6. **Merchant Wallet** → xem số dư platform
7. **Sổ cái** → loại giao dịch:

| Loại | Chiều | Ý nghĩa |
|------|-------|----------|
| `PAYMENT` | THU | Tiền khách nạp (online payment) |
| `COMMISSION` | THU | Hoa hồng platform (% theo loại xe) |
| `VOUCHER` | CHI | Trợ giá voucher cho khách |
| `PAYOUT` | CHI | Thu nhập tài xế chỉ ghi khi khoản T+24h thật sự được giải ngân |
| `WITHDRAW` | CHI | Đối soát khi tài xế ngừng HĐ |

8. **Giải thích T+24h**: Chuyến online → platform nhận tiền ngay (`PAYMENT`) → tiền tài xế nằm ở `pending_earnings` → admin chỉ thấy `PAYOUT` khi giải ngân sau 24h (anti-fraud)

### F3. Thống kê

9. Dashboard → tổng chuyến, tổng doanh thu, tổng tài xế, rides theo ngày

---

## Luồng G — Ví Tài Xế & Thu Nhập

**Mục tiêu:** Ký quỹ, hoa hồng tự động, nạp ví, T+24h settlement

### G1. Hoa hồng tiền mặt (khấu trừ ngay)

1. Thực hiện Luồng A (chuyến tiền mặt, Tài xế A)
2. **[Tài xế A :4001]** → **Ví** → thấy giao dịch `COMMISSION` (CHI), số dư giảm đúng 18% cước

### G2. Thu nhập T+24h (online payment)

3. Thực hiện Luồng C (chuyến MoMo, Tài xế A)
4. **[Tài xế A]** → **Ví** → thấy `Thu nhập chờ xử lý (T+24h): +X.XXX đ`
5. Số dư khả dụng chưa thay đổi cho đến khi settle

### G3. Nạp ví tài xế

6. **[Tài xế A]** → **Nạp tiền** → nhập 200.000đ → chọn **MoMo** → sandbox → xác nhận
7. Ví cập nhật: `+200.000đ`, lịch sử `TOP_UP` xuất hiện

### G4. Giả lập giải ngân T+24h

```cmd
docker exec cab-postgres psql -U postgres -d wallet_db -c "UPDATE pending_earnings SET \"settleAt\" = NOW() - INTERVAL '25 hours' WHERE \"settledAt\" IS NULL;"
```
Sau đó reload trang Ví → "Chờ xử lý" = 0đ, "Khả dụng" tăng tương ứng.

---

## Ghi Chú Kỹ Thuật

| Thành phần | Chi tiết |
|-----------|----------|
| **State machine** | `ride-state-machine.ts` — mọi transition được validate, không bỏ qua bước |
| **Idempotency** | `idempotencyKey` trên mọi payment — IPN callback gọi N lần chỉ xử lý 1 lần |
| **gRPC** | pricing, driver, auth — giao tiếp đồng bộ độ trễ thấp (50051–50057) |
| **RabbitMQ** | `domain-events` topic exchange — sự kiện async giữa 11 service |
| **Socket.IO** | api-gateway:3000, Redis adapter — realtime: GPS, chat, status |
| **Redis Geo** | `drivers:geo:online` — GEORADIUS tìm tài xế theo bán kính |
| **AI fallback** | 150ms timeout, hệ thống hoạt động đầy đủ khi ai-service offline |
| **T+24h** | `pending_earnings` table — wallet-service settlement job |

---

## Troubleshooting Nhanh

**Tài xế không nhận popup notification:**
1. Đã nhấn "Trực tuyến"?
2. Đặt xe đúng loại xe (CAR_4)?
3. Xem gateway log: `docker logs cab-api-gateway --tail 20`
4. Kiểm tra GPS: `docker exec cab-redis redis-cli ZRANGE "drivers:geo:online" 0 -1`

**Tài xế không bật Online (nút bị khóa):**
→ Ví âm quá ngưỡng (`DEBT_LIMIT = -200.000đ`). Nạp ví qua app hoặc chạy seed lại:
```cmd
scripts\reset-database.bat && npx tsx scripts/seed-database.ts
```

**`seed-database.ts` báo "user already exists":**
→ Chạy `scripts\reset-database.bat` trước seed.

**Ride bị CANCELLED ngay (không dispatch):**
→ Có rides cũ từ lần test trước đang chiếm RabbitMQ queue. Reset DB là cách nhanh nhất.

**T+24h không release sau khi chạy SQL:**
→ Reload trang Ví — trigger khi gọi `GET /wallet/balance`.
