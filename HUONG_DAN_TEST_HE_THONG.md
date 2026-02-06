# HUONG DAN TEST HE THONG CAB BOOKING QUA GIAO DIEN FRONTEND

## Muc Luc

1. [Tong Quan](#1-tong-quan)
2. [Yeu Cau Tien Quyet](#2-yeu-cau-tien-quyet)
3. [Du Lieu Test (Database Seed)](#3-du-lieu-test-database-seed)
4. [Kich Ban Test 1: Dang Ky & Dang Nhap Customer](#4-kich-ban-test-1-dang-ky--dang-nhap-customer)
5. [Kich Ban Test 2: Dang Ky & Dang Nhap Driver](#5-kich-ban-test-2-dang-ky--dang-nhap-driver)
6. [Kich Ban Test 3: Dat Xe (Customer)](#6-kich-ban-test-3-dat-xe-customer)
7. [Kich Ban Test 4: Nhan & Xu Ly Chuyen Di (Driver)](#7-kich-ban-test-4-nhan--xu-ly-chuyen-di-driver)
8. [Kich Ban Test 5: Theo Doi Chuyen Di Real-time](#8-kich-ban-test-5-theo-doi-chuyen-di-real-time)
9. [Kich Ban Test 6: Huy Chuyen Di](#9-kich-ban-test-6-huy-chuyen-di)
10. [Kich Ban Test 7: Lich Su Chuyen Di & Thanh Toan](#10-kich-ban-test-7-lich-su-chuyen-di--thanh-toan)
11. [Kich Ban Test 8: Admin Dashboard](#11-kich-ban-test-8-admin-dashboard)
12. [Kich Ban Test 9: Quan Ly Tai Xe (Admin)](#12-kich-ban-test-9-quan-ly-tai-xe-admin)
13. [Kich Ban Test 10: Tinh Gia & Surge Pricing](#13-kich-ban-test-10-tinh-gia--surge-pricing)
14. [Bang Ket Qua Test](#14-bang-ket-qua-test)

---

## 1. Tong Quan

Tai lieu nay huong dan test toan bo he thong Cab Booking thong qua 3 giao dien frontend:

| Ung Dung        | URL                    | Mo Ta                  |
| --------------- | ---------------------- | ---------------------- |
| Customer App    | `http://localhost:4000` | Ung dung dat xe        |
| Driver App      | `http://localhost:4001` | Ung dung tai xe        |
| Admin Dashboard | `http://localhost:4002` | Trang quan tri he thong |

**Quy trinh test:** Mo 3 tab trinh duyet dong thoi de test luong tuong tac giua Customer - Driver - Admin.

---

## 2. Yeu Cau Tien Quyet

### 2.1 Khoi Dong He Thong

```bash
# Buoc 1: Khoi dong tat ca cac service bang Docker
docker-compose up -d

# Buoc 2: Doi tat ca service healthy (khoang 30-60 giay)
docker-compose ps

# Buoc 3: Kiem tra health cua API Gateway
curl http://localhost:3000/health

# Buoc 4: Kiem tra health tat ca services
curl http://localhost:3000/health/services
```

### 2.2 Kiem Tra Cac Service

Tat ca cac service sau phai dang chay:

| Service              | Port  | Kiem Tra                         |
| -------------------- | ----- | -------------------------------- |
| API Gateway          | 3000  | `http://localhost:3000/health`   |
| Auth Service         | 3001  | Thong qua API Gateway            |
| Ride Service         | 3002  | Thong qua API Gateway            |
| Driver Service       | 3003  | Thong qua API Gateway            |
| Payment Service      | 3004  | Thong qua API Gateway            |
| Notification Service | 3005  | Thong qua API Gateway            |
| User Service         | 3007  | Thong qua API Gateway            |
| Booking Service      | 3008  | Thong qua API Gateway            |
| Pricing Service      | 3009  | Thong qua API Gateway            |
| Review Service       | 3010  | Thong qua API Gateway            |
| PostgreSQL           | 5433  | Database chinh                   |
| MongoDB              | 27017 | Notifications & Reviews          |
| Redis                | 6379  | Cache & Geo-indexing             |
| RabbitMQ             | 5672  | Message Queue                    |
| RabbitMQ Admin       | 15672 | `http://localhost:15672`         |

---

## 3. Du Lieu Test (Database Seed)

### 3.1 Chay Script Seed Du Lieu

Tao file `scripts/seed-test-data.sql` va chay de insert du lieu test vao database.

**Ket noi PostgreSQL:**
```bash
# Ket noi tu ben ngoai Docker
psql -h localhost -p 5433 -U postgres

# Hoac ket noi tu ben trong Docker
docker exec -it cab-booking-postgres psql -U postgres
```

### 3.2 Seed Du Lieu Auth Service (auth_db)

```sql
-- =============================================
-- AUTH DATABASE - TAI KHOAN TEST
-- =============================================
-- Ket noi vao auth_db
\c auth_db;

-- Mat khau cho tat ca tai khoan: Password123!
-- Hash bcrypt cua "Password123!":
-- $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy

-- === TAI KHOAN CUSTOMER ===
INSERT INTO users (id, email, phone, password_hash, role, status, first_name, last_name, created_at, updated_at)
VALUES
  ('cust-001', 'customer1@test.com', '0901000001', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'CUSTOMER', 'ACTIVE', 'Nguyen', 'Van A', NOW(), NOW()),
  ('cust-002', 'customer2@test.com', '0901000002', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'CUSTOMER', 'ACTIVE', 'Tran', 'Thi B', NOW(), NOW()),
  ('cust-003', 'customer3@test.com', '0901000003', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'CUSTOMER', 'ACTIVE', 'Le', 'Van C', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- === TAI KHOAN DRIVER ===
INSERT INTO users (id, email, phone, password_hash, role, status, first_name, last_name, created_at, updated_at)
VALUES
  ('drv-001', 'driver1@test.com', '0902000001', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'DRIVER', 'ACTIVE', 'Pham', 'Minh D', NOW(), NOW()),
  ('drv-002', 'driver2@test.com', '0902000002', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'DRIVER', 'ACTIVE', 'Hoang', 'Van E', NOW(), NOW()),
  ('drv-003', 'driver3@test.com', '0902000003', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'DRIVER', 'ACTIVE', 'Vo', 'Thi F', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- === TAI KHOAN ADMIN ===
INSERT INTO users (id, email, phone, password_hash, role, status, first_name, last_name, created_at, updated_at)
VALUES
  ('admin-001', 'admin@test.com', '0903000001', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'ADMIN', 'ACTIVE', 'Admin', 'System', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;
```

### 3.3 Seed Du Lieu User Service (user_db)

```sql
-- =============================================
-- USER DATABASE - HO SO NGUOI DUNG
-- =============================================
\c user_db;

INSERT INTO user_profiles (id, user_id, first_name, last_name, phone, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'cust-001', 'Nguyen', 'Van A', '0901000001', 'ACTIVE', NOW(), NOW()),
  (gen_random_uuid(), 'cust-002', 'Tran', 'Thi B', '0901000002', 'ACTIVE', NOW(), NOW()),
  (gen_random_uuid(), 'cust-003', 'Le', 'Van C', '0901000003', 'ACTIVE', NOW(), NOW()),
  (gen_random_uuid(), 'drv-001', 'Pham', 'Minh D', '0902000001', 'ACTIVE', NOW(), NOW()),
  (gen_random_uuid(), 'drv-002', 'Hoang', 'Van E', '0902000002', 'ACTIVE', NOW(), NOW()),
  (gen_random_uuid(), 'drv-003', 'Vo', 'Thi F', '0902000003', 'ACTIVE', NOW(), NOW()),
  (gen_random_uuid(), 'admin-001', 'Admin', 'System', '0903000001', 'ACTIVE', NOW(), NOW())
ON CONFLICT (user_id) DO NOTHING;
```

### 3.4 Seed Du Lieu Driver Service (driver_db)

```sql
-- =============================================
-- DRIVER DATABASE - THONG TIN TAI XE & XE
-- =============================================
\c driver_db;

INSERT INTO drivers (
  id, user_id, status, availability_status,
  vehicle_type, vehicle_brand, vehicle_model, vehicle_plate, vehicle_color, vehicle_year,
  license_number, license_expiry_date, license_verified,
  rating_average, rating_count,
  last_location_lat, last_location_lng, last_location_time,
  created_at, updated_at
) VALUES
  -- Driver 1: Tai xe xe may (Motorcycle) - Da duyet - Khu vuc Quan 1, HCM
  (
    gen_random_uuid(), 'drv-001', 'APPROVED', 'OFFLINE',
    'MOTORCYCLE', 'Honda', 'Wave Alpha 110', '59P1-12345', 'Do', 2023,
    'B2-001234', '2027-12-31', true,
    4.8, 150,
    10.7769, 106.7009, NOW(),
    NOW(), NOW()
  ),
  -- Driver 2: Tai xe o to (CAR) - Da duyet - Khu vuc Quan 3, HCM
  (
    gen_random_uuid(), 'drv-002', 'APPROVED', 'OFFLINE',
    'CAR', 'Toyota', 'Vios 2023', '51A-67890', 'Trang', 2023,
    'B2-005678', '2028-06-30', true,
    4.5, 89,
    10.7831, 106.6880, NOW(),
    NOW(), NOW()
  ),
  -- Driver 3: Tai xe SUV - Cho duyet (PENDING) - Khu vuc Quan 7, HCM
  (
    gen_random_uuid(), 'drv-003', 'PENDING', 'OFFLINE',
    'SUV', 'Ford', 'Everest 2024', '51H-11111', 'Den', 2024,
    'B2-009999', '2029-01-15', false,
    5.0, 0,
    10.7340, 106.7220, NOW(),
    NOW(), NOW()
  )
ON CONFLICT (user_id) DO NOTHING;
```

### 3.5 Bang Tom Tat Tai Khoan Test

| Vai Tro    | Email               | Mat Khau       | Trang Thai     | Ghi Chu                    |
| ---------- | ------------------- | -------------- | -------------- | -------------------------- |
| Customer 1 | customer1@test.com  | Password123!   | ACTIVE         | Khach hang test chinh      |
| Customer 2 | customer2@test.com  | Password123!   | ACTIVE         | Khach hang test phu         |
| Customer 3 | customer3@test.com  | Password123!   | ACTIVE         | Khach hang test bo sung     |
| Driver 1   | driver1@test.com    | Password123!   | APPROVED       | Xe may - Honda Wave        |
| Driver 2   | driver2@test.com    | Password123!   | APPROVED       | O to - Toyota Vios         |
| Driver 3   | driver3@test.com    | Password123!   | PENDING        | SUV - Ford Everest (chua duyet) |
| Admin      | admin@test.com      | Password123!   | ACTIVE         | Quan tri vien              |

### 3.6 Dia Chi Test (Khu Vuc TP.HCM)

| STT | Dia Diem                         | Latitude   | Longitude   |
| --- | -------------------------------- | ---------- | ----------- |
| 1   | Ben Thanh Market, Quan 1         | 10.7725    | 106.6980    |
| 2   | Nha Tho Duc Ba, Quan 1           | 10.7798    | 106.6990    |
| 3   | Cho Lon, Quan 5                  | 10.7520    | 106.6590    |
| 4   | Landmark 81, Binh Thanh          | 10.7952    | 106.7219    |
| 5   | San Bay Tan Son Nhat, Tan Binh   | 10.8184    | 106.6588    |
| 6   | Dai Hoc Bach Khoa, Quan 10       | 10.7726    | 106.6575    |
| 7   | Phu My Hung, Quan 7              | 10.7290    | 106.7180    |
| 8   | Thu Thiem, Quan 2                | 10.7870    | 106.7340    |

---

## 4. Kich Ban Test 1: Dang Ky & Dang Nhap Customer

### TC-01: Dang Ky Tai Khoan Customer Moi

**Muc Tieu:** Kiem tra chuc nang dang ky tai khoan khach hang.

**Buoc Thuc Hien:**

| Buoc | Hanh Dong                                                    | Ket Qua Mong Doi                                  |
| ---- | ------------------------------------------------------------ | -------------------------------------------------- |
| 1    | Mo trinh duyet, truy cap `http://localhost:4000`             | Chuyen huong den trang Login                       |
| 2    | Click lien ket **"Don't have an account? Register"**         | Chuyen den trang Dang Ky `/register`               |
| 3    | Nhap First Name: `Test`                                      | Hien thi trong o nhap                              |
| 4    | Nhap Last Name: `User`                                       | Hien thi trong o nhap                              |
| 5    | Nhap Email: `testuser@test.com`                              | Hien thi trong o nhap                              |
| 6    | Nhap Phone: `0901999999`                                     | Hien thi trong o nhap                              |
| 7    | Nhap Password: `Password123!`                                | Hien thi dau cham an mat khau                      |
| 8    | Nhap Confirm Password: `Password123!`                        | Hien thi dau cham an mat khau                      |
| 9    | Click nut **"Register"**                                     | Hien thi loading spinner                           |
| 10   | Doi xu ly xong                                               | Chuyen huong den trang Home `/home`                |

**Kiem Tra Loi:**

| Buoc | Hanh Dong                        | Ket Qua Mong Doi                             |
| ---- | -------------------------------- | --------------------------------------------- |
| E1   | De trong First Name, click Register | Hien thi loi "First name is required"       |
| E2   | Nhap email sai dinh dang: `abc`  | Hien thi loi "Invalid email format"           |
| E3   | Nhap Password < 8 ky tu: `123`  | Hien thi loi "Min 8 chars..."                 |
| E4   | Confirm Password khac Password   | Hien thi loi "Passwords do not match"         |
| E5   | Nhap email da ton tai            | Hien thi thong bao loi tu server              |

---

### TC-02: Dang Nhap Customer

**Muc Tieu:** Kiem tra chuc nang dang nhap khach hang voi tai khoan co san.

**Dieu Kien:** Da chay seed du lieu (muc 3.2).

**Buoc Thuc Hien:**

| Buoc | Hanh Dong                                        | Ket Qua Mong Doi                                       |
| ---- | ------------------------------------------------ | ------------------------------------------------------- |
| 1    | Mo trinh duyet, truy cap `http://localhost:4000`  | Hien thi trang Login                                    |
| 2    | Nhap Email: `customer1@test.com`                 | Hien thi trong o nhap                                   |
| 3    | Nhap Password: `Password123!`                    | Hien thi dau cham an mat khau                           |
| 4    | Click nut **"Sign In"**                          | Hien thi loading spinner                                |
| 5    | Doi xu ly xong                                   | Chuyen huong den trang Home `/home`                     |
| 6    | Kiem tra AppBar                                   | Hien thi ten nguoi dung "Nguyen Van A"                  |
| 7    | Kiem tra ban do                                  | Ban do hien thi vi tri hien tai cua nguoi dung          |

**Kiem Tra Loi:**

| Buoc | Hanh Dong                     | Ket Qua Mong Doi                      |
| ---- | ----------------------------- | -------------------------------------- |
| E1   | Nhap sai mat khau             | Hien thi "Invalid credentials"         |
| E2   | Nhap email khong ton tai      | Hien thi "Invalid credentials"         |
| E3   | De trong email hoac mat khau  | Nut Sign In bi disable hoac hien loi   |

---

## 5. Kich Ban Test 2: Dang Ky & Dang Nhap Driver

### TC-03: Dang Ky Tai Khoan Driver Moi

**Muc Tieu:** Kiem tra chuc nang dang ky tai khoan tai xe.

**Buoc Thuc Hien:**

| Buoc | Hanh Dong                                                    | Ket Qua Mong Doi                                  |
| ---- | ------------------------------------------------------------ | -------------------------------------------------- |
| 1    | Mo trinh duyet, truy cap `http://localhost:4001`             | Hien thi trang Login tai xe                        |
| 2    | Click lien ket **"Don't have an account? Register"**         | Chuyen den trang Dang Ky `/register`               |
| 3    | Nhap First Name: `Tester`                                    | Hien thi trong o nhap                              |
| 4    | Nhap Last Name: `Driver`                                     | Hien thi trong o nhap                              |
| 5    | Nhap Email: `testdriver@test.com`                            | Hien thi trong o nhap                              |
| 6    | Nhap Phone: `0902999999`                                     | Hien thi trong o nhap                              |
| 7    | Nhap Password: `Password123!`                                | Hien thi dau cham                                  |
| 8    | Nhap Confirm Password: `Password123!`                        | Hien thi dau cham                                  |
| 9    | Click nut **"Register"**                                     | Hien thi loading spinner                           |
| 10   | Doi xu ly xong                                               | Chuyen huong den trang Profile Setup `/profile-setup` |

---

### TC-04: Thiet Lap Ho So Tai Xe (Profile Setup)

**Muc Tieu:** Kiem tra chuc nang dien thong tin xe va bang lai.

**Dieu Kien:** Vua dang ky tai khoan driver thanh cong (TC-03).

**Buoc Thuc Hien:**

| Buoc | Hanh Dong                                        | Ket Qua Mong Doi                                    |
| ---- | ------------------------------------------------ | ---------------------------------------------------- |
| 1    | Sau khi dang ky, trang Profile Setup hien thi     | Form nhap thong tin xe va bang lai                    |
| 2    | Chon Vehicle Type: **CAR**                        | Radio button / Dropdown chon CAR                     |
| 3    | Nhap Vehicle Brand: `Honda`                       | Hien thi trong o nhap                                |
| 4    | Nhap Vehicle Model: `City 2024`                   | Hien thi trong o nhap                                |
| 5    | Nhap Vehicle Plate: `51A-99999`                   | Hien thi trong o nhap                                |
| 6    | Nhap Vehicle Color: `Bac`                         | Hien thi trong o nhap                                |
| 7    | Nhap Vehicle Year: `2024`                         | Hien thi trong o nhap                                |
| 8    | Nhap License Number: `B2-123456`                  | Hien thi trong o nhap                                |
| 9    | Chon License Expiry Date: `2028-12-31`            | Date picker hien thi ngay da chon                    |
| 10   | Click nut **"Submit"** / **"Register as Driver"**  | Hien thi loading, sau do chuyen den Dashboard        |

---

### TC-05: Dang Nhap Driver

**Muc Tieu:** Kiem tra dang nhap voi tai khoan tai xe da co san (da duyet).

**Dieu Kien:** Da chay seed du lieu (muc 3.2, 3.4).

**Buoc Thuc Hien:**

| Buoc | Hanh Dong                                         | Ket Qua Mong Doi                                        |
| ---- | ------------------------------------------------- | -------------------------------------------------------- |
| 1    | Mo trinh duyet, truy cap `http://localhost:4001`   | Hien thi trang Login tai xe                              |
| 2    | Nhap Email: `driver1@test.com`                    | Hien thi trong o nhap                                    |
| 3    | Nhap Password: `Password123!`                     | Hien thi dau cham an mat khau                            |
| 4    | Click nut **"Sign In"**                           | Loading spinner                                          |
| 5    | Doi xu ly xong                                    | Chuyen huong den Dashboard `/dashboard`                  |
| 6    | Kiem tra Dashboard                                 | Hien thi ban do, trang thai OFFLINE, thong tin tai xe    |
| 7    | Kiem tra Sidebar                                   | Hien thi ten "Pham Minh D", Honda Wave Alpha, rating 4.8 |

---

## 6. Kich Ban Test 3: Dat Xe (Customer)

### TC-06: Dat Xe Tu Diem A Den Diem B

**Muc Tieu:** Kiem tra toan bo luong dat xe cua khach hang.

**Dieu Kien:**
- Da dang nhap Customer (`customer1@test.com`)
- Co it nhat 1 tai xe da APPROVED va ONLINE

**CHUAIN BI - Bat Tai Xe Online (Tab 2):**

| Buoc | Hanh Dong                                         | Ket Qua Mong Doi                    |
| ---- | ------------------------------------------------- | ------------------------------------ |
| P1   | Mo tab moi, truy cap `http://localhost:4001`       | Trang Login Driver                   |
| P2   | Dang nhap: `driver1@test.com` / `Password123!`   | Chuyen den Dashboard                 |
| P3   | Bat cong tac **Online/Offline** sang **ONLINE**    | Trang thai doi sang "You are Online" |
| P4   | Cho phep trinh duyet truy cap vi tri (GPS)         | Vi tri tai xe hien thi tren ban do   |

**THUC HIEN DAT XE (Tab 1 - Customer App):**

| Buoc | Hanh Dong                                                              | Ket Qua Mong Doi                                        |
| ---- | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| 1    | Tai trang Home (`http://localhost:4000/home`)                          | Ban do hien thi, panel "Book a Ride" ben trai            |
| 2    | Cho phep trinh duyet truy cap vi tri (GPS)                             | Vi tri hien tai duoc hien thi tren ban do                |
| 3    | O **Pickup Location**: nhap `Ben Thanh`                                | Danh sach goi y dia chi xuat hien                        |
| 4    | Chon **"Ben Thanh Market"** tu danh sach goi y                         | Marker do xuat hien tren ban do tai vi tri diem don      |
| 5    | O **Dropoff Location**: nhap `Landmark 81`                             | Danh sach goi y dia chi xuat hien                        |
| 6    | Chon **"Landmark 81"** tu danh sach goi y                              | Marker xanh xuat hien tren ban do tai vi tri diem den    |
| 7    | Doi he thong tinh gia (tu dong sau khi chon dropoff)                   | Card **Estimated Fare** hien thi gia uoc tinh           |
| 8    | Kiem tra thong tin gia                                                  | Hien thi so tien (VND), khoang cach (km), thoi gian     |
| 9    | Chon **Vehicle Type**: click **ECONOMY**                               | Nut ECONOMY duoc highlight                               |
| 10   | Chon **Payment Method**: click **CASH**                                | Nut CASH duoc highlight                                  |
| 11   | Click nut **"Request Ride"**                                           | Hien thi loading spinner tren nut                        |
| 12   | Doi xu ly xong                                                         | Chuyen huong den trang Ride Tracking `/ride/{rideId}`    |
| 13   | Kiem tra trang Ride Tracking                                           | Hien thi trang thai "Finding Driver..." hoac tuong tu    |

---

### TC-07: Dat Xe Voi Cac Loai Xe Khac Nhau

**Muc Tieu:** Kiem tra dat xe voi tung loai xe (ECONOMY, COMFORT, PREMIUM).

| Loai Xe  | Gia Du Kien      | Mo Ta                            |
| -------- | ---------------- | -------------------------------- |
| ECONOMY  | Gia thap nhat    | Xe may hoac xe hoi pho thong     |
| COMFORT  | Gia trung binh   | Xe hoi tien nghi                 |
| PREMIUM  | Gia cao nhat     | Xe hoi cao cap / SUV             |

**Buoc Thuc Hien:** Lap lai TC-06 nhung thay doi buoc 9 de chon tung loai xe.

| Buoc | Hanh Dong                          | Ket Qua Mong Doi                             |
| ---- | ---------------------------------- | --------------------------------------------- |
| 1    | Chon loai xe **COMFORT**           | Gia uoc tinh thay doi (cao hon ECONOMY)       |
| 2    | Chon loai xe **PREMIUM**           | Gia uoc tinh thay doi (cao hon COMFORT)       |
| 3    | So sanh gia giua 3 loai xe         | ECONOMY < COMFORT < PREMIUM                  |

---

### TC-08: Dat Xe Voi Cac Phuong Thuc Thanh Toan

**Muc Tieu:** Kiem tra cac phuong thuc thanh toan khac nhau.

| Buoc | Hanh Dong                          | Ket Qua Mong Doi                             |
| ---- | ---------------------------------- | --------------------------------------------- |
| 1    | Chon Payment Method: **CASH**      | Nut CASH duoc highlight, cho phep dat xe      |
| 2    | Chon Payment Method: **MOMO**      | Nut MOMO duoc highlight, cho phep dat xe      |
| 3    | Chon Payment Method: **VISA**      | Nut VISA duoc highlight, cho phep dat xe      |

---

## 7. Kich Ban Test 4: Nhan & Xu Ly Chuyen Di (Driver)

### TC-09: Tai Xe Nhan Chuyen Di

**Muc Tieu:** Kiem tra tai xe nhan va xu ly chuyen di tu khi nhan yeu cau den khi hoan thanh.

**Dieu Kien:**
- Customer da dat xe (TC-06 buoc 1-12)
- Driver da online (TC-06 phan Chuan Bi)

**Buoc Thuc Hien (Tab Driver App):**

| Buoc | Hanh Dong                                                       | Ket Qua Mong Doi                                         |
| ---- | --------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Sau khi Customer dat xe, kiem tra man hinh Driver                | Modal **"Ride Request"** xuat hien voi thong tin chuyen di |
| 2    | Kiem tra thong tin trong modal                                   | Hien thi diem don, diem den, gia cuoc                     |
| 3    | Kiem tra bo dem thoi gian                                        | Hien thi countdown (thoi gian con lai de quyet dinh)       |
| 4    | Click nut **"Accept Ride"**                                      | Modal dong lai                                            |
| 5    | Doi xu ly xong                                                   | Chuyen huong den trang Active Ride `/active-ride`         |
| 6    | Kiem tra trang Active Ride                                       | Hien thi ban do voi diem don cua khach hang                |
| 7    | Kiem tra trang thai                                              | Hien thi "Heading to pickup" hoac tuong tu                 |

---

### TC-10: Tai Xe Di Don Khach Va Bat Dau Chuyen Di

**Dieu Kien:** Tai xe da nhan chuyen (TC-09).

| Buoc | Hanh Dong                                                       | Ket Qua Mong Doi                                         |
| ---- | --------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Tren trang Active Ride, click nut **"Arrived at Pickup"**        | Trang thai doi sang PICKING_UP                            |
| 2    | Kiem tra trang thai moi                                          | Hien thi "Waiting for passenger" hoac tuong tu            |
| 3    | Click nut **"Start Ride"**                                       | Trang thai doi sang IN_PROGRESS                           |
| 4    | Kiem tra ban do                                                  | Hien thi duong di tu diem don den diem tra                 |
| 5    | Kiem tra thong tin chuyen di                                     | Hien thi ten khach, diem don, diem tra, gia cuoc           |

---

### TC-11: Tai Xe Hoan Thanh Chuyen Di

**Dieu Kien:** Chuyen di dang IN_PROGRESS (TC-10).

| Buoc | Hanh Dong                                                       | Ket Qua Mong Doi                                         |
| ---- | --------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Click nut **"Complete Ride"**                                    | Hien thi xac nhan hoan thanh                              |
| 2    | Xac nhan hoan thanh                                              | Trang thai doi sang COMPLETED                             |
| 3    | Kiem tra ket qua                                                 | Hien thi tong ket chuyen di (gia cuoc, quang duong,...)   |
| 4    | Kiem tra Dashboard                                               | Quay lai Dashboard, so tien hom nay tang                  |
| 5    | Kiem tra tab Customer App                                        | Customer nhan thong bao chuyen di da hoan thanh            |

---

### TC-12: Tai Xe Tu Choi Chuyen Di

**Muc Tieu:** Kiem tra khi tai xe tu choi chuyen di.

**Dieu Kien:** Customer dat xe moi, Driver nhan ride request modal.

| Buoc | Hanh Dong                                                       | Ket Qua Mong Doi                                         |
| ---- | --------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Khi modal Ride Request xuat hien, click **"Reject Ride"**        | Modal dong                                                |
| 2    | Kiem tra trang thai Driver                                       | Van o trang Online, san sang nhan chuyen moi              |
| 3    | Kiem tra tab Customer App                                        | He thong tim tai xe khac hoac thong bao khong tim duoc    |

---

## 8. Kich Ban Test 5: Theo Doi Chuyen Di Real-time

### TC-13: Customer Theo Doi Vi Tri Tai Xe

**Muc Tieu:** Kiem tra tinh nang theo doi vi tri tai xe real-time tren ban do.

**Dieu Kien:** Driver da nhan chuyen (TC-09).

**Buoc Thuc Hien (Tab Customer App):**

| Buoc | Hanh Dong                                                       | Ket Qua Mong Doi                                         |
| ---- | --------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Tren trang Ride Tracking (`/ride/{rideId}`)                     | Ban do hien thi vi tri tai xe (marker)                    |
| 2    | Kiem tra thong tin chuyen di                                     | Hien thi ten tai xe, bien so xe, rating                   |
| 3    | Doi 15 giay (driver gui location update)                         | Marker tai xe di chuyen tren ban do                       |
| 4    | Kiem tra trang thai chuyen di                                    | Hien thi "Driver is on the way" hoac tuong tu             |
| 5    | Khi Driver click "Arrived at Pickup"                             | Trang thai doi sang "Driver has arrived"                  |
| 6    | Khi Driver click "Start Ride"                                    | Trang thai doi sang "Ride in progress"                    |
| 7    | Khi Driver click "Complete Ride"                                 | Chuyen den trang ket qua / danh gia                       |

---

## 9. Kich Ban Test 6: Huy Chuyen Di

### TC-14: Customer Huy Chuyen Di Truoc Khi Co Tai Xe

**Muc Tieu:** Kiem tra khach hang huy chuyen di khi dang tim tai xe.

| Buoc | Hanh Dong                                                       | Ket Qua Mong Doi                                         |
| ---- | --------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Dat xe binh thuong (TC-06 buoc 1-12)                             | Chuyen den trang Ride Tracking                            |
| 2    | Trang thai hien thi "Finding Driver..."                          | Dang tim tai xe                                           |
| 3    | Click nut **"Cancel Ride"**                                      | Hien thi dialog xac nhan huy                              |
| 4    | Xac nhan huy chuyen di                                           | Trang thai doi sang CANCELLED                             |
| 5    | Kiem tra ket qua                                                 | Quay lai trang Home, co the dat chuyen moi                |

---

### TC-15: Customer Huy Chuyen Di Sau Khi Co Tai Xe

**Dieu Kien:** Tai xe da nhan chuyen (TC-09).

| Buoc | Hanh Dong                                                       | Ket Qua Mong Doi                                         |
| ---- | --------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Tren trang Ride Tracking, click **"Cancel Ride"**                | Hien thi dialog xac nhan huy                              |
| 2    | Xac nhan huy chuyen di                                           | Trang thai CANCELLED                                      |
| 3    | Kiem tra tab Driver App                                          | Driver nhan thong bao chuyen di bi huy                    |
| 4    | Kiem tra trang thai Driver                                       | Driver quay lai Dashboard, trang thai ONLINE               |

---

## 10. Kich Ban Test 7: Lich Su Chuyen Di & Thanh Toan

### TC-16: Xem Lich Su Chuyen Di (Customer)

**Muc Tieu:** Kiem tra trang lich su chuyen di cua khach hang.

**Dieu Kien:** Da hoan thanh it nhat 1 chuyen di (TC-11).

| Buoc | Hanh Dong                                                       | Ket Qua Mong Doi                                         |
| ---- | --------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Tren Customer App, click menu icon (goc trai tren)               | Sidebar mo ra                                             |
| 2    | Click **"Ride History"**                                         | Chuyen den trang `/history`                               |
| 3    | Kiem tra danh sach chuyen di                                     | Hien thi cac chuyen di da hoan thanh / da huy             |
| 4    | Kiem tra thong tin tung chuyen                                   | Hien thi ngay, diem don, diem tra, gia cuoc, trang thai   |

---

### TC-17: Xem Thu Nhap (Driver)

**Muc Tieu:** Kiem tra trang thu nhap cua tai xe.

**Dieu Kien:** Da hoan thanh it nhat 1 chuyen di (TC-11).

| Buoc | Hanh Dong                                                       | Ket Qua Mong Doi                                         |
| ---- | --------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Tren Driver App, click menu icon                                 | Sidebar mo ra                                             |
| 2    | Click **"Earnings"**                                             | Chuyen den trang `/earnings`                              |
| 3    | Kiem tra tong thu nhap hom nay                                   | Hien thi so tien thu nhap                                 |
| 4    | Kiem tra so chuyen di                                            | So chuyen phu hop voi so chuyen da hoan thanh              |

---

### TC-18: Xem Lich Su Chuyen Di (Driver)

| Buoc | Hanh Dong                                                       | Ket Qua Mong Doi                                         |
| ---- | --------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Tren Driver App, click menu icon                                 | Sidebar mo ra                                             |
| 2    | Click **"Ride History"**                                         | Chuyen den trang `/history`                               |
| 3    | Kiem tra danh sach                                               | Hien thi cac chuyen da hoan thanh voi thong tin chi tiet   |

---

## 11. Kich Ban Test 8: Admin Dashboard

### TC-19: Dang Nhap Admin

**Muc Tieu:** Kiem tra dang nhap vao trang quan tri.

| Buoc | Hanh Dong                                         | Ket Qua Mong Doi                                        |
| ---- | ------------------------------------------------- | -------------------------------------------------------- |
| 1    | Mo trinh duyet, truy cap `http://localhost:4002`   | Hien thi trang Login Admin                               |
| 2    | Nhap Email: `admin@test.com`                      | Hien thi trong o nhap                                    |
| 3    | Nhap Password: `Password123!`                     | Hien thi dau cham                                        |
| 4    | Click nut **"Sign In"**                           | Loading spinner                                          |
| 5    | Doi xu ly xong                                    | Chuyen den Dashboard `/dashboard`                        |
| 6    | Kiem tra Dashboard                                 | Hien thi cac KPI: tong chuyen di, tai xe, doanh thu,...   |
| 7    | Kiem tra Sidebar trai                              | Hien thi menu: Dashboard, Rides, Drivers, Customers,...  |

---

### TC-20: Xem Tong Quan Dashboard (Admin)

**Muc Tieu:** Kiem tra cac chi so tren trang Dashboard cua Admin.

**Dieu Kien:** Da dang nhap Admin (TC-19).

| Buoc | Hanh Dong                                                       | Ket Qua Mong Doi                                         |
| ---- | --------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Xem phan KPI cards phia tren                                    | Hien thi: Total Rides, Active Drivers, Revenue, Customers |
| 2    | Kiem tra so lieu                                                 | So lieu phu hop voi du lieu test da insert                 |
| 3    | Xem bieu do (neu co)                                             | Hien thi bieu do thong ke chuyen di / doanh thu            |

---

### TC-21: Quan Ly Chuyen Di (Admin)

| Buoc | Hanh Dong                                                       | Ket Qua Mong Doi                                         |
| ---- | --------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Click **"Rides"** tren Sidebar                                   | Chuyen den trang `/rides`                                 |
| 2    | Kiem tra danh sach chuyen di                                     | Hien thi tat ca chuyen di trong he thong                  |
| 3    | Kiem tra thong tin cot                                           | Hien thi: ID, Customer, Driver, Status, Fare, Date        |
| 4    | Loc theo trang thai (neu co bo loc)                               | Chi hien thi chuyen di voi trang thai da chon              |

---

### TC-22: Quan Ly Khach Hang (Admin)

| Buoc | Hanh Dong                                                       | Ket Qua Mong Doi                                         |
| ---- | --------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Click **"Customers"** tren Sidebar                               | Chuyen den trang `/customers`                             |
| 2    | Kiem tra danh sach khach hang                                    | Hien thi: customer1, customer2, customer3                 |
| 3    | Kiem tra thong tin                                               | Hien thi: ten, email, so dien thoai, trang thai            |

---

## 12. Kich Ban Test 9: Quan Ly Tai Xe (Admin)

### TC-23: Xem Danh Sach Tai Xe

| Buoc | Hanh Dong                                                       | Ket Qua Mong Doi                                         |
| ---- | --------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Click **"Drivers"** tren Sidebar Admin                           | Chuyen den trang `/drivers`                               |
| 2    | Kiem tra danh sach tai xe                                        | Hien thi: driver1 (APPROVED), driver2 (APPROVED), driver3 (PENDING) |
| 3    | Kiem tra thong tin                                               | Hien thi: ten, xe, bien so, trang thai duyet               |

---

### TC-24: Duyet Tai Xe Moi (Admin)

**Muc Tieu:** Kiem tra Admin duyet tai khoan tai xe dang cho duyet (PENDING).

| Buoc | Hanh Dong                                                       | Ket Qua Mong Doi                                         |
| ---- | --------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Tren trang Drivers, tim tai xe `Vo Thi F` (driver3)              | Hien thi trang thai **PENDING**                           |
| 2    | Click nut **"Verify"** / **"Approve"** cua driver3               | Hien thi dialog xac nhan duyet                            |
| 3    | Xac nhan duyet                                                   | Trang thai doi sang **APPROVED**                          |
| 4    | Kiem tra lai danh sach                                           | driver3 hien thi trang thai APPROVED                      |
| 5    | Dang nhap driver3 (`driver3@test.com`) tren Driver App           | Co the dang nhap va bat ONLINE binh thuong                |

---

### TC-25: Tu Choi Tai Xe (Admin)

**Muc Tieu:** Kiem tra Admin tu choi tai khoan tai xe.

| Buoc | Hanh Dong                                                       | Ket Qua Mong Doi                                         |
| ---- | --------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Tren trang Drivers, tim tai xe PENDING                           | Hien thi trang thai PENDING                               |
| 2    | Click nut **"Reject"** cua tai xe do                             | Hien thi dialog xac nhan tu choi                          |
| 3    | Xac nhan tu choi                                                 | Trang thai doi sang **REJECTED**                          |
| 4    | Kiem tra lai danh sach                                           | Tai xe hien thi trang thai REJECTED                       |

---

## 13. Kich Ban Test 10: Tinh Gia & Surge Pricing

### TC-26: Kiem Tra Tinh Gia Binh Thuong

**Muc Tieu:** Kiem tra tinh nang uoc tinh gia cuoc binh thuong (surge = 1.0).

| Buoc | Hanh Dong                                                       | Ket Qua Mong Doi                                         |
| ---- | --------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Dang nhap Customer App                                           | Chuyen den Home                                           |
| 2    | Chon diem don: **Ben Thanh Market**                              | Marker do tren ban do                                     |
| 3    | Chon diem den: **Landmark 81**                                   | Marker xanh tren ban do                                   |
| 4    | Doi tinh gia                                                     | Hien thi Estimated Fare card                              |
| 5    | Kiem tra gia ECONOMY                                              | Hien thi gia cuoc > 0                                     |
| 6    | Kiem tra surge badge                                             | Khong hien thi surge badge (surge = 1.0)                  |

---

### TC-27: Kiem Tra Surge Pricing (Admin)

**Muc Tieu:** Kiem tra Admin thiet lap surge va anh huong len gia cuoc.

| Buoc | Hanh Dong                                                       | Ket Qua Mong Doi                                         |
| ---- | --------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Dang nhap Admin Dashboard                                        | Chuyen den Dashboard                                      |
| 2    | Click **"Pricing"** tren Sidebar                                 | Chuyen den trang `/pricing`                               |
| 3    | Thiet lap Surge Multiplier: **2.0**                              | Luu thanh cong                                             |
| 4    | Quay lai Customer App, dat chuyen moi                            | Uoc tinh gia moi                                          |
| 5    | Kem tra gia cuoc                                                 | Gia cuoc tang gap ~2 lan so voi gia binh thuong           |
| 6    | Kiem tra surge badge                                             | Hien thi badge **"2.0x Surge"** mau do/cam                |
| 7    | Quay lai Admin, dat surge ve **1.0**                             | Gia ve binh thuong                                         |

---

## 14. Bang Ket Qua Test

Su dung bang sau de ghi nhan ket qua test:

| Ma Test | Ten Kich Ban                              | Ket Qua | Nguoi Test | Ngay Test  | Ghi Chu |
| ------- | ----------------------------------------- | ------- | ---------- | ---------- | ------- |
| TC-01   | Dang ky tai khoan Customer                | [ ]     |            |            |         |
| TC-02   | Dang nhap Customer                        | [ ]     |            |            |         |
| TC-03   | Dang ky tai khoan Driver                  | [ ]     |            |            |         |
| TC-04   | Thiet lap ho so tai xe                    | [ ]     |            |            |         |
| TC-05   | Dang nhap Driver                          | [ ]     |            |            |         |
| TC-06   | Dat xe tu diem A den diem B               | [ ]     |            |            |         |
| TC-07   | Dat xe voi cac loai xe khac nhau          | [ ]     |            |            |         |
| TC-08   | Dat xe voi cac phuong thuc thanh toan     | [ ]     |            |            |         |
| TC-09   | Tai xe nhan chuyen di                     | [ ]     |            |            |         |
| TC-10   | Tai xe di don khach va bat dau chuyen di  | [ ]     |            |            |         |
| TC-11   | Tai xe hoan thanh chuyen di               | [ ]     |            |            |         |
| TC-12   | Tai xe tu choi chuyen di                  | [ ]     |            |            |         |
| TC-13   | Theo doi vi tri tai xe real-time          | [ ]     |            |            |         |
| TC-14   | Huy chuyen di truoc khi co tai xe         | [ ]     |            |            |         |
| TC-15   | Huy chuyen di sau khi co tai xe           | [ ]     |            |            |         |
| TC-16   | Xem lich su chuyen di (Customer)          | [ ]     |            |            |         |
| TC-17   | Xem thu nhap (Driver)                     | [ ]     |            |            |         |
| TC-18   | Xem lich su chuyen di (Driver)            | [ ]     |            |            |         |
| TC-19   | Dang nhap Admin                           | [ ]     |            |            |         |
| TC-20   | Xem tong quan Dashboard (Admin)           | [ ]     |            |            |         |
| TC-21   | Quan ly chuyen di (Admin)                 | [ ]     |            |            |         |
| TC-22   | Quan ly khach hang (Admin)                | [ ]     |            |            |         |
| TC-23   | Xem danh sach tai xe (Admin)              | [ ]     |            |            |         |
| TC-24   | Duyet tai xe moi (Admin)                  | [ ]     |            |            |         |
| TC-25   | Tu choi tai xe (Admin)                    | [ ]     |            |            |         |
| TC-26   | Tinh gia binh thuong                      | [ ]     |            |            |         |
| TC-27   | Surge pricing (Admin)                     | [ ]     |            |            |         |

---

## Phu Luc: Toan Bo Script Seed Du Lieu

Chay toan bo script sau de tao du lieu test:

```bash
# Ket noi vao PostgreSQL container
docker exec -it cab-booking-postgres psql -U postgres
```

Sau do chay toan bo SQL duoi day:

```sql
-- =============================================
-- 1. AUTH DATABASE
-- =============================================
\c auth_db;

-- Mat khau: Password123!
-- Hash: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy

INSERT INTO users (id, email, phone, password_hash, role, status, first_name, last_name, created_at, updated_at)
VALUES
  ('cust-001', 'customer1@test.com', '0901000001', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'CUSTOMER', 'ACTIVE', 'Nguyen', 'Van A', NOW(), NOW()),
  ('cust-002', 'customer2@test.com', '0901000002', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'CUSTOMER', 'ACTIVE', 'Tran', 'Thi B', NOW(), NOW()),
  ('cust-003', 'customer3@test.com', '0901000003', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'CUSTOMER', 'ACTIVE', 'Le', 'Van C', NOW(), NOW()),
  ('drv-001', 'driver1@test.com', '0902000001', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'DRIVER', 'ACTIVE', 'Pham', 'Minh D', NOW(), NOW()),
  ('drv-002', 'driver2@test.com', '0902000002', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'DRIVER', 'ACTIVE', 'Hoang', 'Van E', NOW(), NOW()),
  ('drv-003', 'driver3@test.com', '0902000003', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'DRIVER', 'ACTIVE', 'Vo', 'Thi F', NOW(), NOW()),
  ('admin-001', 'admin@test.com', '0903000001', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'ADMIN', 'ACTIVE', 'Admin', 'System', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- =============================================
-- 2. USER DATABASE
-- =============================================
\c user_db;

INSERT INTO user_profiles (id, user_id, first_name, last_name, phone, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'cust-001', 'Nguyen', 'Van A', '0901000001', 'ACTIVE', NOW(), NOW()),
  (gen_random_uuid(), 'cust-002', 'Tran', 'Thi B', '0901000002', 'ACTIVE', NOW(), NOW()),
  (gen_random_uuid(), 'cust-003', 'Le', 'Van C', '0901000003', 'ACTIVE', NOW(), NOW()),
  (gen_random_uuid(), 'drv-001', 'Pham', 'Minh D', '0902000001', 'ACTIVE', NOW(), NOW()),
  (gen_random_uuid(), 'drv-002', 'Hoang', 'Van E', '0902000002', 'ACTIVE', NOW(), NOW()),
  (gen_random_uuid(), 'drv-003', 'Vo', 'Thi F', '0902000003', 'ACTIVE', NOW(), NOW()),
  (gen_random_uuid(), 'admin-001', 'Admin', 'System', '0903000001', 'ACTIVE', NOW(), NOW())
ON CONFLICT (user_id) DO NOTHING;

-- =============================================
-- 3. DRIVER DATABASE
-- =============================================
\c driver_db;

INSERT INTO drivers (
  id, user_id, status, availability_status,
  vehicle_type, vehicle_brand, vehicle_model, vehicle_plate, vehicle_color, vehicle_year,
  license_number, license_expiry_date, license_verified,
  rating_average, rating_count,
  last_location_lat, last_location_lng, last_location_time,
  created_at, updated_at
) VALUES
  (
    gen_random_uuid(), 'drv-001', 'APPROVED', 'OFFLINE',
    'MOTORCYCLE', 'Honda', 'Wave Alpha 110', '59P1-12345', 'Do', 2023,
    'B2-001234', '2027-12-31', true,
    4.8, 150,
    10.7769, 106.7009, NOW(),
    NOW(), NOW()
  ),
  (
    gen_random_uuid(), 'drv-002', 'APPROVED', 'OFFLINE',
    'CAR', 'Toyota', 'Vios 2023', '51A-67890', 'Trang', 2023,
    'B2-005678', '2028-06-30', true,
    4.5, 89,
    10.7831, 106.6880, NOW(),
    NOW(), NOW()
  ),
  (
    gen_random_uuid(), 'drv-003', 'PENDING', 'OFFLINE',
    'SUV', 'Ford', 'Everest 2024', '51H-11111', 'Den', 2024,
    'B2-009999', '2029-01-15', false,
    5.0, 0,
    10.7340, 106.7220, NOW(),
    NOW(), NOW()
  )
ON CONFLICT (user_id) DO NOTHING;

-- =============================================
-- KIEM TRA DU LIEU DA INSERT
-- =============================================
\c auth_db;
SELECT id, email, role, status, first_name, last_name FROM users;

\c user_db;
SELECT user_id, first_name, last_name, phone, status FROM user_profiles;

\c driver_db;
SELECT user_id, status, availability_status, vehicle_type, vehicle_brand, vehicle_model, vehicle_plate, rating_average FROM drivers;
```

---

## Luu Y Quan Trong

1. **Mo 3 tab dong thoi:** Customer App (port 4000), Driver App (port 4001), Admin Dashboard (port 4002) de test luong tuong tac real-time.

2. **GPS / Location:** Trinh duyet se hoi quyen truy cap vi tri. Can **cho phep** de ban do hoat dong dung. Neu dung tren may tinh, trinh duyet se su dung vi tri IP (khong chinh xac lam). Co the dung Chrome DevTools > Sensors > Geolocation de gia lap vi tri tai TP.HCM (lat: 10.7769, lng: 106.7009).

3. **Thu tu test:** Nen test theo thu tu: Dang ky/Dang nhap -> Dat xe -> Nhan chuyen (Driver) -> Hoan thanh -> Lich su -> Admin. Vi cac kich ban co phu thuoc vao nhau.

4. **Reset du lieu:** Nen dung `docker-compose down -v && docker-compose up -d` roi chay lai seed script de reset toan bo du lieu ve trang thai ban dau truoc khi test lai.

5. **Kiem tra Console:** Mo Developer Tools (F12) > Console de xem loi JavaScript neu co van de. Tab Network de kiem tra cac API request/response.

6. **WebSocket:** Kiem tra tab Network > WS de xem cac ket noi WebSocket (Socket.IO) dang hoat dong. Cac su kien real-time (vi tri tai xe, trang thai chuyen di) di qua WebSocket.
