# Hướng Dẫn Lệnh Terminal Cho Dự Án Cab Booking System

## 1. Mục đích tài liệu

Tài liệu này tập hợp toàn bộ các lệnh terminal thường dùng trong dự án để một người khác có thể:

- Khởi động hệ thống.
- Seed và reset dữ liệu.
- Chạy frontend và backend ở môi trường local.
- Chạy test backend, smoke test và browser test.
- Theo dõi logs và dọn môi trường khi cần.

Tài liệu ưu tiên cách dùng trên Windows vì dự án hiện đang được thao tác trong môi trường Windows.

## 2. Di chuyển vào thư mục dự án

Thực hiện bước này để bảo đảm mọi lệnh bên dưới chạy đúng ngữ cảnh repo.

```bat
cd /d "e:\Nam4 - Ki 2\KLTN2025\Cab-Booking-System-Project"
```

Kết quả mong đợi:

- Terminal đang đứng tại thư mục gốc của dự án.

## 3. Lệnh cài đặt phụ thuộc

Thực hiện bước này khi mới clone dự án hoặc khi cần cài lại package.

```bat
npm install
```

Mục đích:

- Cài toàn bộ dependency cho monorepo.

Khi cần cài riêng cho app customer:

```bat
npm --prefix apps/customer-app install
```

## 4. Lệnh khởi động hệ thống bằng Docker

### 4.1. Build và chạy toàn bộ backend bằng Docker Compose

```bat
docker compose up -d --build
```

Mục đích:

- Build image mới.
- Khởi động toàn bộ backend service và hạ tầng đi kèm.

### 4.2. Kiểm tra container đang chạy

```bat
docker compose ps
```

Mục đích:

- Xem container nào đang chạy, container nào lỗi.

### 4.3. Xem log realtime của toàn hệ thống Docker

```bat
docker compose logs -f
```

Hoặc dùng script trong `package.json`:

```bat
npm run docker:logs
```

### 4.4. Dừng toàn bộ container

```bat
docker compose down
```

Hoặc:

```bat
npm run docker:down
```

### 4.5. Chỉ build lại image

```bat
docker compose build
```

Hoặc:

```bat
npm run docker:build
```

## 5. Lệnh reset và seed dữ liệu

### 5.1. Reset database trên Windows

```bat
scripts\reset-database.bat
```

Mục đích:

- Xóa trạng thái dữ liệu cũ để chuẩn bị test lại từ đầu.

### 5.2. Seed dữ liệu mẫu

```bat
npm run db:seed
```

Mục đích:

- Tạo tài khoản và dữ liệu mẫu để đăng nhập, test nghiệp vụ.

## 6. Lệnh chạy frontend local

### 6.1. Chạy toàn bộ frontend cùng lúc

```bat
npm run dev:frontends
```

Mục đích:

- Mở đồng thời admin, customer và driver app.

### 6.2. Chạy riêng từng frontend

Customer App:

```bat
npm run dev:customer
```

Driver App:

```bat
npm run dev:driver-app
```

Admin Dashboard:

```bat
npm run dev:admin
```

## 7. Lệnh chạy backend local theo từng service

Phần này dùng khi không muốn chạy backend bằng Docker hoặc muốn debug một service cụ thể.

API Gateway:

```bat
npm run dev:gateway
```

Auth Service:

```bat
npm run dev:auth
```

User Service:

```bat
npm run dev:user
```

Ride Service:

```bat
npm run dev:ride
```

Driver Service:

```bat
npm run dev:driver
```

Booking Service:

```bat
npm run dev:booking
```

Pricing Service:

```bat
npm run dev:pricing
```

Payment Service:

```bat
npm run dev:payment
```

Notification Service:

```bat
npm run dev:notification
```

Review Service:

```bat
npm run dev:review
```

## 8. Lệnh build dự án

Build toàn bộ phần shared và backend:

```bat
npm run build
```

Build shared:

```bat
npm run build:shared
```

Build backend:

```bat
npm run build:backend
```

Build các service backend chính:

```bat
npm run build:services
```

## 9. Lệnh kiểm thử

### 9.1. Chạy toàn bộ test theo workspace

```bat
npm test
```

### 9.2. Chạy unit test

```bat
npm run test:unit
```

### 9.3. Chạy contract test

```bat
npm run test:contract
```

### 9.4. Chạy integration test backend

```bat
npm run test:integration
```

Hoặc:

```bat
npm run test:backend
```

### 9.5. Chạy test cho từng service

Ride Service:

```bat
npm run test:ride
```

Auth Service:

```bat
npm run test:auth
```

Shared package:

```bat
npm run test:shared
```

### 9.6. Chạy coverage

```bat
npm run test:coverage
```

## 10. Lệnh smoke test

### 10.1. Smoke test gateway hoặc lifecycle backend

```bat
npm run smoke:gateway
```

```bat
npm run smoke:lifecycle
```

Mục đích:

- Kiểm tra nhanh các luồng backend quan trọng mà không cần thao tác tay trên UI.

### 10.2. Browser smoke test toàn bộ các spec hiện có

```bat
npm run smoke:browser
```

### 10.3. Browser smoke test luồng hoàn tất chuyến

```bat
npm run smoke:browser:lifecycle
```

### 10.4. Browser smoke test các luồng hủy chuyến

```bat
npm run smoke:browser:cancellations
```

## 11. Lệnh chạy Cypress trực tiếp trong customer app

Mở Cypress UI:

```bat
npm --prefix apps/customer-app run cypress:open
```

Chạy Cypress headless:

```bat
npm --prefix apps/customer-app run cypress:run
```

Chạy riêng một spec:

```bat
npm --prefix apps/customer-app run cypress:run -- --spec cypress/e2e/ride-lifecycle.cy.ts
```

```bat
npm --prefix apps/customer-app run cypress:run -- --spec cypress/e2e/ride-cancellations.cy.ts
```

## 12. Lệnh hỗ trợ kiểm tra nhanh môi trường

Kiểm tra port customer app:

```bat
powershell -Command "Test-NetConnection localhost -Port 4000 | Select-Object TcpTestSucceeded"
```

Kiểm tra port driver app:

```bat
powershell -Command "Test-NetConnection localhost -Port 4001 | Select-Object TcpTestSucceeded"
```

Kiểm tra port admin app:

```bat
powershell -Command "Test-NetConnection localhost -Port 4002 | Select-Object TcpTestSucceeded"
```

## 13. Thứ tự chạy khuyến nghị khi cần test từ đầu

Nếu một người mới cần chạy lại toàn bộ hệ thống từ đầu, nên làm theo thứ tự sau:

1. `cd /d "e:\Nam4 - Ki 2\KLTN2025\Cab-Booking-System-Project"`
2. `npm install`
3. `docker compose up -d --build`
4. `scripts\reset-database.bat`
5. `npm run db:seed`
6. `npm run dev:frontends`
7. `npm run smoke:browser` hoặc thao tác tay trên giao diện.

## 14. Lưu ý khi chạy trên Windows

- Khi chạy nhiều lệnh test trong `cmd`, nên chạy từng lệnh riêng thay vì nối chuỗi dài bằng `&&` để tránh lỗi `Terminate batch job`.
- Sau khi `docker compose up -d --build`, gateway có thể lên trước các service phụ trợ. Nên chờ thêm vài giây trước khi login hoặc chạy smoke test đầu tiên.
- Nếu Prisma bị khóa file DLL khi reset nhiều lần, nên seed lại rồi khởi động lại service thay vì cố generate lặp liên tục.
- Nếu chỉ kill shell mà không kill cây process con, có thể còn tiến trình Node cũ chạy ngầm. Khi nghi ngờ, nên đóng terminal cũ hoặc kill tiến trình liên quan.