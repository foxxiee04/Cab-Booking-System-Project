# Tai lieu kiem thu giao dien voi du lieu seed (cap nhat 2026-03-27)

## 1. Pham vi
Tai lieu nay dung de test nhanh va test hoi quy cho:
- Customer app: dang nhap, dat xe, theo doi chuyen, thanh toan, callback.
- Driver app: dang nhap, nhan cuoc, cap nhat trang thai cuoc.
- Admin dashboard: theo doi so lieu tong quan va map fallback.

Cap nhat quan trong trong phien ban hien tai:
- Vehicle type da thong nhat: MOTORBIKE, SCOOTER, CAR_4, CAR_7.
- Flow thanh toan online da toi gian: chon MOMO/VNPAY la redirect thang sang sandbox, khong qua trang online trung gian.
- Neu thanh toan online that bai: bat buoc nguoi dung chon phuong thuc khac (khong cho dung lai provider vua fail).

## 2. Lenh reset + seed bat buoc truoc khi test
### 2.1 Windows
- scripts/reset-database.bat

### 2.2 Linux/macOS
- scripts/reset-database.sh

Lenh reset da duoc chay thanh cong ngay 2026-03-27 voi ket qua:
- PostgreSQL: auth_db, booking_db, driver_db, payment_db, ride_db, user_db da drop/recreate.
- MongoDB: notification_db, review_db da drop.
- Prisma migrate/push/generate: thanh cong cho cac service.
- Seed thanh cong:
  - Admin: 1
  - Customers: 10
  - Drivers: 10
  - Bookings: 6
  - Rides: 6
  - Payments: 6
  - Notifications: 2
  - Reviews: 2

## 3. Tai khoan seed de test UI
Mat khau mac dinh tat ca tai khoan: Password@1

### 3.1 Admin
- Email: admin@cabbooking.com
- Phone: 0900000001

### 3.2 Customer
- Phone: 0901234561 -> 0901234570
- Email: customer1@example.com -> customer10@example.com
- Tai khoan khuyen nghi de chay smoke tu dong: customer5@example.com

### 3.3 Driver
- Phone: 0911234561 -> 0911234570
- Email: driver1@example.com -> driver10@example.com
- Tai khoan khuyen nghi de chay smoke tu dong: driver1@example.com

## 4. Vehicle type moi va mapping seed
### 4.1 Tap vehicle type chuan
- MOTORBIKE: Xe may
- SCOOTER: Xe ga
- CAR_4: O to 4 cho
- CAR_7: O to 7 cho

### 4.2 Driver seed mau
- Honda Vision -> SCOOTER
- Honda Wave Alpha -> MOTORBIKE
- Vios/City/Accent -> CAR_4
- Everest/Innova/Xpander/Sorento/Fortuner -> CAR_7

## 5. Bo testcase giao dien uu tien
### TC-UI-01 Dang nhap customer thanh cong
- Input: 0901234561 / Password@1
- Expected:
  - Dang nhap thanh cong
  - Dieu huong ve HomeMap

### TC-UI-02 Dang nhap driver thanh cong
- Input: 0911234561 / Password@1
- Expected:
  - Dang nhap thanh cong
  - Vao dashboard driver

### TC-UI-03 Dang nhap admin bang email
- Input: admin@cabbooking.com / Password@1
- Expected:
  - Dang nhap thanh cong
  - Vao dashboard admin

### TC-UI-04 Dat xe CAR_4 bang tien mat
- Step:
  1. Customer chon pickup/dropoff
  2. Chon CAR_4
  3. Chon CASH
  4. Xac nhan dat xe
- Expected:
  - Tao ride thanh cong
  - Driver gan cuoc theo dispatch hien tai

### TC-UI-05 Dat xe thanh toan MOMO (redirect truc tiep)
- Step:
  1. Customer dat xe
  2. Chon MOMO
  3. Xac nhan
- Expected:
  - App redirect thang sang gateway MOMO
  - Khong di qua route /payment/online/:rideId

### TC-UI-06 Dat xe thanh toan VNPAY (redirect truc tiep)
- Step:
  1. Customer dat xe
  2. Chon VNPAY
  3. Xac nhan
- Expected:
  - Redirect thang sang VNPAY sandbox

### TC-UI-07 Callback thanh toan thanh cong
- Expected:
  - Trang callback hien success
  - Tu dong quay lai trang ride
  - Payment status chuyen COMPLETED

### TC-UI-08 Callback thanh toan that bai va ep doi phuong thuc
- Step:
  1. Tao giao dich MOMO hoac VNPAY
  2. Lam payment fail
  3. Tu callback bam Chon phuong thuc khac
- Expected:
  - Ve RideTracking voi co retryPayment=1
  - Provider vua fail bi disable
  - User phai chon method khac (CASH hoac provider con lai)

### TC-UI-09 Driver nhan cuoc va cap nhat trang thai
- Step:
  1. Driver nhan cuoc moi
  2. Pickup -> Start -> Complete
- Expected:
  - Trang thai ride chuyen dung luong
  - Customer app cap nhat realtime

### TC-UI-10 Admin map fallback
- Expected:
  - Neu fallback Leaflet, tile dung OpenStreetMap
  - Hien du lieu hotspot tai xe

## 6. Du lieu sandbox thanh toan (bao gom OTP)
### 6.1 VNPAY NCB noi dia
- Thanh cong:
  - So the: 9704198526191432198
  - Ten chu the: NGUYEN VAN A
  - Ngay phat hanh: 07/15
  - OTP: 123456
- Loi thuong gap:
  - Khong du so du: 9704195798459170488
  - The bi khoa/chua kich hoat/het han: xem docs huong dan thanh toan sandbox

### 6.2 VNPAY the quoc te
- VISA/MASTER/JCB co bo test no-3DS va 3DS
- OTP/3DS: nhap theo man hinh sandbox

### 6.3 MOMO
- Visa test thanh cong:
  - 4111 1111 1111 1111
  - Exp: 05/26
  - CVC: 111
  - OTP: tuy luong, thuong khong yeu cau voi case nay
- Master test:
  - 5200 0000 0000 1096 (thanh cong)
  - 5200 0000 0000 1104 (that bai)
  - OTP: theo man hinh sandbox

## 7. Mau bang ghi ket qua
| Testcase ID | App | Input | Actual | Pass/Fail | Evidence |
|---|---|---|---|---|---|
| TC-UI-01 | Customer | 0901234561 |  |  |  |
| TC-UI-05 | Customer | MOMO redirect |  |  |  |
| TC-UI-08 | Customer | Payment fail + retry method |  |  |  |
| TC-UI-09 | Driver | Accept/Pickup/Start/Complete |  |  |  |

## 8. Ghi chu smoke test
Da chay lenh smoke backend:
- npm run smoke:gateway

Ket qua hien tai:
- PASS ngay 2026-03-27 sau khi reset + seed va rebuild cac service lien quan.
- Summary lan chay gan nhat:
  - nearbyDrivers: 1
  - completedRideId: 7cff4ec4-7728-4521-b55d-3aa31d3b60fb
  - paymentId: b5e3b703-bbfe-4abd-a0b2-ad88dc79902e
  - paymentStatus: COMPLETED
  - reviewCount: 1
  - adminDrivers: 10
  - heatmapDrivers: 10

Loi goc da gap va da fix trong ngay:
1. driver-service container dung Prisma client cu trong dist/generated, gay 500 cho /api/drivers/me khi enum da chuyen sang CAR_4/CAR_7.
2. payment-service container chua sync schema/client moi, lam event ride.completed khong tao duoc Fare/Payment/DriverEarnings.
3. Smoke script mac dinh dung customer1@example.com, trung voi ride IN_PROGRESS seed san. Da doi sang customer5@example.com de on dinh sau moi lan reset.
