# Bao Cao Test Logic Chuc Nang Dat Xe

Ngay test: 2026-04-10
Nhanh ket: He thong dat xe dang hoat dong dung logic co ban cho cac case chinh (multi-customer cung diem don, race giua tai xe, gating theo payment method, khu vuc khong co tai xe).

## 1) Pham vi va cach test

- Moi truong: stack Docker dang chay local tren `localhost` (gateway `:3000`, cac service ride/driver/booking/payment da up).
- Du lieu: da seed lai bang script `npm run db:seed` (20 customer, 40 driver, 35 driver online trong Redis geo index).
- Script baseline:
  - `npm run test:backend` (script cu) -> fail mot so test do contract auth da doi (yeu cau password/OTP behavior moi), khong dung de ket luan logic booking hien tai.
  - `npm run smoke:gateway` -> fail o buoc truy van payment ride (404), nhung khong anh huong truc tiep danh gia logic matching dat xe.
- Script custom de test dung yeu cau: `scripts/test-booking-logic-report.ts`.
  - Test dong thoi nhieu customer cung diem don.
  - Test tai xe quanh vung.
  - Test race 2 tai xe cung nhan 1 ride.
  - Test ap luc cung-cau (nhieu ride > so tai xe san sang).
  - Test CASH vs MOMO.
  - Test khu vuc xa khong co tai xe.

## 2) Ket qua thuc te theo tung tinh huong

### Scenario A - 1 dia diem, nhieu khach dat cung luc

- Dau vao:
  - 3 customer tao ride dong thoi tai Ben Thanh.
  - Vehicle type duoc chon theo nhom tai xe roi nhat luc test: `MOTORBIKE`.
- Ket qua:
  - 3 ride tao thanh cong:
    - `5953dc5d-2fa5-4564-ba9e-7c59b11690b3`
    - `d70e884b-f656-4e6b-a3fc-4e9c7b5748fd`
    - `305efa32-3986-43cc-b377-4044dd2b2991`
  - Sau ~2.5s, ca 3 ride deu o trang thai `FINDING_DRIVER` (chua auto assigned ngay).
  - So tai xe gan diem don (API nearby trong ban kinh 4km): `13`.
- Danh gia logic: **PASS**
  - He thong chap nhan dat xe dong thoi, khong bi crash/duplicate.
  - Luong matching la bat dong bo: ride vao `FINDING_DRIVER` roi moi den buoc tai xe nhan.

### Scenario B - 2 tai xe nhan cung 1 ride (ai la nguoi nhan)

- Dau vao:
  - 2 tai xe cung goi API accept cho cung ride `5953dc5d-2fa5-4564-ba9e-7c59b11690b3` gan nhu dong thoi.
- Ket qua:
  - `driver25@example.com`: `200` (nhan thanh cong).
  - `driver21@example.com`: `400` voi message `Ride is no longer available. Current status: ASSIGNED`.
  - Ride cuoi cung: `ASSIGNED`, `driverId = fe2b0fbe-9d38-4cf7-b0d6-65b24eb104d7`.
- Danh gia logic: **PASS**
  - Chi 1 tai xe thang race, tai xe con lai bi tu choi dung nghiep vu.
  - Phu hop co che atomic claim trong ride-service (update co dieu kien status).

### Scenario C - Ap luc cung-cau (nhieu khach, it tai xe)

- Dau vao:
  - Tiep tuc voi 3 ride o Scenario A, tai xe con lai nhan ride tu danh sach available.
- Ket qua:
  - Ride `5953dc5d-2fa5-4564-ba9e-7c59b11690b3`: `ASSIGNED`.
  - Ride `d70e884b-f656-4e6b-a3fc-4e9c7b5748fd`: `ASSIGNED`.
  - Ride `305efa32-3986-43cc-b377-4044dd2b2991`: van `FINDING_DRIVER`.
- Danh gia logic: **PASS**
  - Khi cau > cung, mot phan ride tiep tuc cho tai xe, khong co hien tuong 1 ride bi gan nhieu tai xe.

### Scenario D - CASH vs MOMO

- Dau vao:
  - Tao 2 ride tu 2 customer:
    - Ride CASH: `71d92b4f-7595-435b-b744-574fadfc4e1e`
    - Ride MOMO: `232d5b37-e26c-4229-a3ec-c776c9ec8ade`
- Ket qua:
  - CASH -> `FINDING_DRIVER` (bat dau matching ngay).
  - MOMO -> `CREATED` (chua matching).
- Danh gia logic: **PASS**
  - Dung voi rule trien khai: thanh toan online phai cho payment completed moi bat dau tim tai xe.

### Scenario E - Khu vuc xa khong co tai xe xung quanh

- Dau vao:
  - Pickup tai Can Gio (xa cum tai xe seed).
- Ket qua:
  - Nearby drivers: `0`.
  - Ride tao thanh cong va vao `FINDING_DRIVER` (`c367abab-47b2-4c12-8f75-f6dac547f00f`).
- Danh gia logic: **PASS**
  - He thong khong assign sai tai xe o xa.
  - Ride giu trang thai cho tim tai xe dung nghiep vu.

## 3) Tong hop logic trien khai hien tai (doi chieu code + test)

- Luong dat xe:
  1. Customer tao ride.
  2. Ride vao `CREATED`.
  3. Neu `paymentMethod = CASH` -> chuyen `FINDING_DRIVER` ngay.
  4. Neu `MOMO/VNPAY` -> giu `CREATED` cho den su kien payment completed.
- Matching/nhan chuyen:
  - Tai xe xem danh sach available theo location + radius + vehicle type compatible.
  - Khi 2 tai xe cung nhan 1 ride, DB atomic claim dam bao chi 1 nguoi thanh cong.
- Vehicle compatibility:
  - Ride chi duoc tai xe dung loai xe nhan.
- Geo logic:
  - Nearby driver dua tren Redis geo index (`drivers:geo:online`).
- Timeout:
  - Ride bi ket `FINDING_DRIVER` lau se co co che system timeout/cancel theo cau hinh.

## 4) Cac diem can luu y (finding)

1. Script `test-backend.ts` dang lech contract auth hien tai
- Bieu hien: fail register/send-otp/verify-otp, keo theo fail booking auth.
- Tac dong: de gay nham neu dung script nay de ket luan tinh trang he thong.

2. `smoke-gateway-flows.ts` co the fail o buoc payment lookup (404) tuy luong ride van chay
- Can tach rieng testcase booking/matching voi testcase payment de tranh false-negative khi review booking.

## 5) Ket luan cho cau hoi nghiep vu ban yeu cau

- 1 dia diem, nhieu khach dat cung luc: he thong van tao duoc nhieu ride; ride vao hang doi `FINDING_DRIVER`, khong bi xung dot.
- Tai xe xung quanh ra sao: API nearby tra ve danh sach tai xe theo ban kinh va khoang cach (da ghi nhan 13 tai xe gan pickup trong lan test).
- Ai la nguoi nhan: khi nhieu tai xe cung nhan 1 ride, chi 1 tai xe thanh cong; tai xe con lai bi tra ve "ride khong con kha dung".
- Khi thieu tai xe: mot so ride duoc assign, ride con lai tiep tuc `FINDING_DRIVER` cho den khi co tai xe/timeout.
- Khac biet theo payment method: CASH tim tai xe ngay; MOMO/VNPAY cho thanh toan xong moi tim tai xe.

=> Tong the, logic dat xe/matching hien tai dang van hanh dung huong trien khai.
