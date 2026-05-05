# Kịch bản Demo FoxGo — KLTN 2025

> **Điểm test chính:** 295 Nguyễn Văn Bảo, P. Hạnh Thông Tây, Gò Vấp, TP.HCM · `10.8158, 106.6636`
> **Mật khẩu mọi tài khoản:** `Password@1`

---

## Tổng quan tài khoản demo

| Vai trò | Phone | Họ tên | App | GPS |
|---------|-------|--------|-----|-----|
| **Khách hàng demo** | `0901234571` | Nguyen Thi Demo | http://localhost:4000 | Không (kéo pin trên bản đồ) |
| **Tài xế demo** | `0911234583` | Pham Van Bao · CAR_4 | http://localhost:4001 | Chrome Sensors 10.8178, 106.6645 |
| **Admin** | `0900000001` | System Admin | http://localhost:4002 | Không |
| Background driver | `0911234584` | Tran Van Hung · MOTORBIKE | — | set-drivers-online.mjs |
| Background driver | `0911234585` | Le Thi Mai · CAR_4 | — | set-drivers-online.mjs |
| Background driver | `0911234586` | Hoang Van Lam · CAR_7 | — | set-drivers-online.mjs |
| Background driver | `0911234587` | Bui Thi Lan · SCOOTER | — | set-drivers-online.mjs |

---

## Chuẩn bị (1 lần trước demo)

### Bước 1 — Khởi động stack
```cmd
npm run docker:up
```

### Bước 2 — Reset DB + seed (chỉ khi cần DB sạch)
```cmd
scripts\reset-database.bat
npx tsx scripts/seed-database.ts
```

> `seed-database.ts` tạo toàn bộ accounts, 5 vouchers, 28 rides lịch sử, ratings phân biệt cho tài xế.
> **Không cần chạy `seed-flows.ts` nữa** — đã gộp vào `seed-database.ts`.

### Bước 3 — Bật tài xế background online
```cmd
node scripts/set-drivers-online.mjs
```

### Bước 4 — Mở 3 tab browser

| Tab | URL | Tài khoản |
|-----|-----|-----------|
| Chrome thường | http://localhost:4001 | `0911234583` / `Password@1` |
| Chrome Incognito | http://localhost:4000 | `0901234571` / `Password@1` |
| Chrome tab mới | http://localhost:4002 | `0900000001` / `Password@1` |

### Bước 5 — GPS tài xế demo (0911234583)
1. Tab driver app (4001) → **F12** → **More tools → Sensors**
2. **Location** → **Custom location** → Lat: `10.8178` · Lng: `106.6645`
3. Bật **Trực tuyến** trong app

---

## Rating tài xế sau seed — Dispatch Demo

| Tài xế | Phone | Xe | Khoảng cách NVB | Rating sau seed |
|--------|-------|-----|-----------------|-----------------|
| Pham Van Bao | `0911234583` | CAR_4 | 250m | **4.8 ★** (5 chuyến: 4×⭐5 + 1×⭐4) |
| Le Thi Mai | `0911234585` | CAR_4 | 450m | **3.5 ★** (4 chuyến: ⭐5+⭐4+⭐3+⭐2) |
| Tran Van Hung | `0911234584` | MOTORBIKE | 130m | **4.7 ★** (3 chuyến: 2×⭐5 + 1×⭐4) |
| Bui Thi Lan | `0911234587` | SCOOTER | 650m | **4.5 ★** (2 chuyến: ⭐5+⭐4) |
| Hoang Van Lam | `0911234586` | CAR_7 | 300m | **5.0 ★** (1 chuyến ⭐5) |

---

## Luồng A — Full Lifecycle (1C-1D)

**Mục tiêu:** End-to-end: đặt xe → nhận → di chuyển → hoàn tất → đánh giá

**Browser cần mở:** Customer (Incognito/4000) + Driver (4001 + GPS Sensors)

1. **[Customer 4000]** Pin điểm đón tại `10.8158, 106.6636` · Điểm đến: Vincom Gò Vấp
2. Chọn **Ô tô 4 chỗ** · Thanh toán: **Tiền mặt** · **Đặt xe**
3. **[Driver 4001]** Popup xuất hiện (20 giây) → **Vuốt phải / Nhận chuyến**
4. Customer thấy icon tài xế + tên + biển số trên bản đồ
5. Driver: **Đã đến điểm đón** → **Đón khách** → **Bắt đầu chuyến** → **Hoàn tất**
6. Customer: đánh giá ⭐⭐⭐⭐⭐ → **Gửi**

**Verify:** Customer lịch sử → COMPLETED. Driver ví → COMMISSION trừ 18% (CAR_4). Admin → ride mới.

### Thử các loại xe khác

| Loại xe | Driver | Chọn trên app |
|---------|--------|---------------|
| Xe máy | `0911234584` Tran Van Hung | "Xe máy" |
| Ô tô 4 chỗ | `0911234583` hoặc `0911234585` | "Ô tô 4 chỗ" |
| Ô tô 7 chỗ | `0911234586` Hoang Van Lam | "Ô tô 7 chỗ" |
| Xe tay ga | `0911234587` Bui Thi Lan | "Xe tay ga" |

---

## Luồng B — Dispatch Scoring Demo (1C-2D)

**Mục tiêu:** Thể hiện scoring algorithm: distance 40% + rating 25% + idle 15% + acceptance 15%

**Setup:** Driver 83 mở browser (GPS Sensors on) + `set-drivers-online.mjs` đã chạy (85 online)

### Lý thuyết scoring

Khi customer book CAR_4 tại NVB, có 2 CAR_4 driver trong bán kính 2km:

| Driver | Khoảng cách | Rating | Dự đoán dispatch |
|--------|-------------|--------|------------------|
| **0911234583** Pham Van Bao | 250m | **4.8 ★** | **1st — dispatch ngay** |
| 0911234585 Le Thi Mai | 450m | 3.5 ★ | 2nd — nhận nếu 83 từ chối |

Cả 2 yếu tố (gần hơn + rating cao hơn) đều có lợi cho 83 → 83 luôn được dispatch trước.

### Thực hiện — Demo từ chối

1. Customer book CAR_4 tại NVB
2. Driver 83 nhận notification → **Bấm X (từ chối)** hoặc chờ 20 giây hết giờ
3. Hệ thống tự chuyển sang Driver 85 → background driver nhận chuyến
4. Giải thích: không broadcast, chỉ 1 tài xế nhận notification tại 1 thời điểm

### Điểm nhấn kỹ thuật

- Vòng dispatch: **2km × 1 tài xế** → **3km × 3** → **5km × 5**
- Driver từ chối nhiều → acceptance rate giảm → điểm giảm về sau
- AI adjustment: nếu ai-service bật, accept-probability từ ML model tinh chỉnh score ±5%

### Demo 3 notification lần lượt (nâng cao)

1. Mở tab incognito → http://localhost:4001 → đăng nhập `0911234585`
2. F12 → Sensors → Lat: `10.8198`, Lng: `106.6655` → Bật Online
3. Customer book CAR_4 → notification đến 83 → 83 từ chối → notification đến 85 → 85 từ chối → vòng 2 mở rộng

---

## Luồng C — Thanh toán Online + Voucher

**Mục tiêu:** Demo MoMo/VNPay sandbox, voucher discount, refund flow

1. Customer book: Điểm đón NVB · Điểm đến Sân bay TSN · Xe CAR_4 · Thanh toán **MoMo**
2. Nhấn **"Áp voucher"** → nhập `WEEKEND10` (giảm 10%, tối đa 30k)
3. **Đặt xe** → trang Sandbox → **"Thanh toán (Sandbox)"** → redirect về app
4. Driver (background) nhận → hoàn tất

**Demo refund:** Sau sandbox confirm, trong lúc FINDING_DRIVER → Customer **Hủy chuyến** → badge vàng "Đang hoàn về ví MoMo" → Admin → Payments → thấy record REFUNDED.

### Voucher codes

| Code | Giảm | Điều kiện |
|------|------|-----------|
| `WEEKEND10` | 10%, tối đa 30k | Không giới hạn |
| `FLAT30K` | 30.000đ | Chuyến ≥ 80.000đ |
| `NEWUSER50` | 50%, tối đa 100k | Khách mới |
| `WELCOME20` | 20%, tối đa 50k | Khách mới |
| `OLDUSER15` | 15%, tối đa 40k | Chuyến ≥ 50.000đ |

---

## Luồng D — Chat & Đánh giá Realtime

**Trong khi chuyến đang chạy (sau "Đón khách"):**

1. Customer app → icon chat → tab **"Tài xế"** → gõ tin nhắn
2. Driver app nhận ngay (Socket.IO realtime)
3. Driver reply → Customer thấy ngay, không reload

**Review sau chuyến:** Driver hoàn tất → Customer màn hình rating → 5 sao + comment → Admin xem rating tài xế thay đổi realtime.

---

## Luồng E — AI Chatbot (FoxGo Assistant)

**Customer app** → icon chat nổi (góc phải) → tab **"Trợ lý FoxGo"**

| Câu hỏi | Hành vi mong đợi | Kỹ thuật |
|---------|---------|----------|
| `bảng giá xe máy` | <500ms | Pattern matching |
| `voucher giảm giá dùng như thế nào?` | Hướng dẫn chi tiết | RAG từ knowledge base |
| `tôi bị trừ tiền nhưng không thấy chuyến đâu` | Giải thích + contact | RAG + intent classification |
| `phí hủy bao nhiêu?` → `còn tài xế hủy thì sao?` | Trả lời đúng follow-up | Multi-turn context |

**Driver app** → icon chat → "Trợ lý tài xế":

| Câu hỏi | Hành vi |
|---------|---------|
| `hoa hồng xe 4 chỗ bao nhiêu?` | "CAR_4: 18% mỗi cuốc..." |
| `tại sao không nhận được cuốc?` | Kiểm tra ví, GPS, online status |
| `làm sao tăng rating?` | Tips cụ thể |

**Điểm nhấn:** AI fallback trong 150ms — hệ thống hoạt động bình thường khi ai-service offline.

---

## Luồng F — Admin Dashboard

**Login:** http://localhost:4002 · `0900000001`

| Chức năng | Menu | Thấy gì |
|-----------|------|---------|
| Tổng quan | Dashboard | Rides hôm nay, doanh thu, driver online |
| Duyệt tài xế | Tài xế → Chờ duyệt | 3 PENDING: Truong Van V, Lam Thi W, Huynh Van X |
| Chuyến đi | Chuyến đi | 28 rides seeded, filter theo status |
| Voucher | Voucher | 5 vouchers active |
| Ví công ty | Ví → Merchant | Số dư, IN/OUT history, logo Techcombank |
| Ví tài xế | Ví → Tài xế | Xem debt từng driver |

**Live: Duyệt tài xế mới**
1. Tài xế → Chờ duyệt → chọn `Truong Van V` → xem hồ sơ, xe Toyota Mazda2, bằng B
2. Nhấn **"Phê duyệt"**
3. Mở tab mới → http://localhost:4001 → đăng nhập `0911234580` → nút Trực tuyến mở khóa

---

## Luồng G — Ví Tài xế & T+24h Settlement

**Driver app (0911234583) → Ví:**
- **Tổng số dư** / **Khả dụng** / **Chờ thanh toán** (MOMO earnings, mở sau 24h) / **Ký quỹ** 300k

**Top-up demo:** Ví → Nạp tiền → MoMo → Sandbox → Xác nhận → số dư tăng ngay.

**Simulate T+24h:**
```cmd
docker exec cab-postgres psql -U postgres -d wallet_db -c "UPDATE pending_earnings SET \"settleAt\" = NOW() - INTERVAL '25 hours' WHERE \"settledAt\" IS NULL;"
```

→ Reload trang Ví → "Chờ thanh toán" về 0, "Khả dụng" tăng (lazy settlement trigger khi GET /balance).

---

## Bản đồ khu vực test

| Địa điểm | Toạ độ | Cách điểm đón |
|----------|--------|---------------|
| **[Điểm đón] 295 Nguyễn Văn Bảo** | `10.8158, 106.6636` | — |
| Vincom Gò Vấp | `10.8340, 106.6648` | ~2km |
| Lotte Mart Gò Vấp | `10.8330, 106.6645` | ~2km |
| Chợ Hạnh Thông Tây | `10.8200, 106.6650` | ~500m |
| BV Nhân dân Gò Vấp | `10.8050, 106.6680` | ~1.5km |
| Sân bay Tân Sơn Nhất | `10.8184, 106.6519` | ~1.5km |

## Vị trí tài xế background

| Tài xế | Phone | Xe | Toạ độ | Cách điểm đón |
|--------|-------|-----|--------|--------------|
| Tran Van Hung | `0911234584` | MOTORBIKE Wave Alpha | `10.8165, 106.6622` | 130m |
| Pham Van Bao *(demo)* | `0911234583` | CAR_4 Toyota Vios | `10.8178, 106.6645` | 250m |
| Hoang Van Lam | `0911234586` | CAR_7 Toyota Innova | `10.8152, 106.6662` | 300m |
| Le Thi Mai | `0911234585` | CAR_4 Hyundai Accent | `10.8198, 106.6655` | 450m |
| Bui Thi Lan | `0911234587` | SCOOTER Honda Vision | `10.8222, 106.6615` | 650m |

---

## Rebuild nhanh trước demo

```cmd
scripts\reset-database.bat
npx tsx scripts/seed-database.ts
node scripts/set-drivers-online.mjs
```

---

## FAQ

**Q: Dispatch không gửi notification cho tài xế demo (83)?**
A: (1) GPS Sensors đã bật chưa? (2) Đã nhấn "Trực tuyến" chưa? (3) Chọn đúng vehicle type?

**Q: Không thấy tài xế background trên bản đồ?**
A: Chạy lại `node scripts/set-drivers-online.mjs` — driver tự OFFLINE sau khi hoàn tất chuyến.

**Q: Ví tài xế âm quá ngưỡng, không nhận cuốc?**
A: Driver app → Ví → Nạp tiền → MoMo → Sandbox confirm.

**Q: seed-database.ts báo lỗi "user already exists"?**
A: Chạy `scripts\reset-database.bat` trước.

**Q: seed-flows.ts có cần chạy không?**
A: **Không.** Đã gộp toàn bộ vào seed-database.ts.
