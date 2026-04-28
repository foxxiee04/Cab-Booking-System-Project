Ok, 2 ý bạn thêm vào là **rất đúng hướng thực tế vận hành** (đặc biệt là phần tra soát & kiểm soát công nợ). Nhưng nếu nhét thẳng vào như mô tả ban đầu thì sẽ bị “lệch logic hệ thống” một chút — cần chuẩn hóa lại để:

* Không phá UX tài xế
* Không làm rối luồng tiền
* Nhưng vẫn kiểm soát rủi ro cho doanh nghiệp

Mình sẽ **viết lại hoàn chỉnh** cho bạn, đã tích hợp 2 cơ chế mới:

---

# 🔥 MÔ HÌNH KÝ QUỸ – CÔNG NỢ (BẢN CHUẨN HOÁ + KIỂM SOÁT RỦI RO)

---

## 1. TỔNG QUAN NGHIỆP VỤ (CẬP NHẬT)

Hệ thống vận hành theo 3 lớp tài chính:

* **Available Balance (Số dư khả dụng)** → tiền có thể rút
* **Pending Balance (Tiền tạm giữ)** → *mới thêm*
* **Debt (Công nợ)** → tiền tài xế đang nợ nền tảng
* **Deposit (Ký quỹ)** → 300.000₫ (khóa)

---

## 2. CẬP NHẬT LUỒNG ONLINE (THÊM “GIAM TIỀN”)

### ❗ Vấn đề thực tế:

* Thanh toán qua MoMo / VNPay **có thể bị hoàn tiền, dispute, lỗi hệ thống**
* Nếu cho rút ngay → doanh nghiệp chịu rủi ro

---

### ✅ Giải pháp: Thêm **Pending Balance (tiền chờ)**

### Luồng mới:

**Bước 1:** Khách thanh toán 100k → tiền vào DN
**Bước 2:** Tính phí 20% → tài xế được 80k
**Bước 3:** ❗ **KHÔNG vào available ngay → đưa vào `pending balance`**
**Bước 4:** Sau thời gian giữ (ví dụ: **T+1 hoặc 24h**) → chuyển sang available
**Bước 5:** Nếu có debt → trừ khi chuyển sang available

---

### 🔁 Sơ đồ mới:

```text
KHÁCH → thanh toán → DN

DN → +80k → PENDING (tài xế)

Sau 24h:
PENDING → AVAILABLE

Nếu có debt:
AVAILABLE → trừ debt → phần còn lại mới rút được
```

---

### 📌 UI cần cập nhật:

```
Số dư khả dụng:      120.000₫
Tiền chờ xử lý:       80.000₫
Công nợ:             -20.000₫
Ký quỹ:              300.000₫
```

---

### 📌 Rule quan trọng:

* ❌ Không cho rút từ pending
* ✅ Chỉ rút từ available
* ✅ Pending giúp:

  * Chống refund
  * Chống bug hệ thống
  * Delay kiểm toán

---

## 3. CẬP NHẬT LUỒNG TIỀN MẶT (THÊM DEADLINE TRẢ NỢ)

### ❗ Vấn đề:

* Tài xế giữ tiền mặt → hệ thống không kiểm soát được ngay
* Nếu không ép deadline → dễ “nợ xấu”

---

## ✅ Giải pháp: Thêm **THỜI HẠN THANH TOÁN CÔNG NỢ**

---

### Luồng mới:

**Bước 1:** Khách trả 100k tiền mặt
**Bước 2:** Hệ thống ghi nhận:

* Driver giữ: 100k
* Debt: +20k

---

### ❗ Thêm rule:

* Mỗi khoản debt có:

  * `created_at`
  * `due_date` (ví dụ: **T+2 ngày**)

---

### 📌 2 cách tất toán:

#### Cách 1 (auto – ưu tiên):

* Khi có chuyến online → hệ thống tự trừ

#### Cách 2 (manual – mới thêm):

* Tài xế **chủ động chuyển khoản trả nợ**
* (qua MoMo / VNPay / chuyển khoản DN)

---

## 🚨 XỬ LÝ TRỄ HẠN (QUAN TRỌNG)

Nếu quá `due_date`:

### Level 1 – Cảnh báo

* Không ảnh hưởng hoạt động
* Push notification + highlight đỏ

---

### Level 2 – Hạn chế

* ❌ Không cho nhận cuốc mới
* ❌ Không cho online
* (nhưng vẫn cho trả nợ)

---

### Level 3 – Cưỡng chế

* Tự động trừ vào:

  * available (nếu có)
  * deposit (nếu cần)

---

### Level 4 – Khoá tài khoản

* Nếu debt > deposit
* Hoặc cố tình không thanh toán

---

## 🔁 Sơ đồ luồng CASH (CẬP NHẬT)

```text
KHÁCH → trả tiền mặt → TÀI XẾ giữ 100k

HỆ THỐNG:
→ ghi nhận debt +20k
→ tạo due_date (T+2)

Trong thời gian:
- Có chuyến online → auto trừ
- Hoặc tài xế nạp tiền → giảm debt

Nếu quá hạn:
→ hạn chế tài khoản
→ trừ deposit nếu cần
```

---

## 4. CẬP NHẬT CÔNG THỨC ĐỐI SOÁT CUỐI

Không đổi logic, nhưng áp dụng thêm pending:

```
Hoàn tiền = Deposit + Available + Pending - Debt
```

> Nhưng:

* Pending chưa hết thời gian → có thể delay hoàn

---

## 5. CẬP NHẬT UI / UX QUAN TRỌNG

### Ví cần hiển thị rõ 4 phần:

```
AVAILABLE (có thể rút)
PENDING (đang chờ)
DEBT (phải trả)
DEPOSIT (bị khóa)
```

---

### Màn hình debt nên có thêm:

* Danh sách khoản nợ:

  * Số tiền
  * Ngày tạo
  * Hạn thanh toán
  * Trạng thái (Đúng hạn / Quá hạn)

---

### Thêm nút mới:

👉 **"Thanh toán công nợ"**

---

## 6. KẾT LUẬN (BẢN NÂNG CẤP)

Sau khi thêm 2 cơ chế:

### ✅ Hệ thống đạt:

* Có **cashflow control** (pending)
* Có **debt enforcement** (deadline)
* Không phá UX tài xế
* Giống thực tế Grab / Gojek hơn

---

## ⚠️ LƯU Ý QUAN TRỌNG (DEV SIDE)

Bạn nên tách rõ:

```text
wallet_transactions
wallet_balances
debt_records
settlement_jobs (cron xử lý pending + debt)
```

---

Nếu bạn muốn, mình có thể viết tiếp cho bạn:

* ERD database chuẩn cho mô hình này
* API design (withdraw, settle, debt payment)
* Hoặc flow backend (cron job xử lý pending + overdue)

Cái này mà bạn đem đi làm đồ án / production thì gần như “chuẩn bài fintech” luôn.
