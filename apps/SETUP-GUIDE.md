# 🚀 HƯỚNG DẪN CÀI ĐẶT & CHẠY FRONTEND

## ⚠️ VẤN ĐỀ "CODE ĐỎ" (Red Squiggly Lines)

**Nguyên nhân**: Chưa cài đặt npm packages! TypeScript không tìm thấy các thư viện như `react`, `@reduxjs/toolkit`, `leaflet`, v.v.

**Giải pháp**: Chạy `npm install` trong từng thư mục app.

---

## 📦 CÀI ĐẶT TỪNG APP

### 1️⃣ Customer App (Port 4000)

```bash
cd apps/customer-app
npm install
```

**Lỗi sẽ biến mất sau khi cài đặt!** ✅

### 2️⃣ Driver App (Port 4001)

```bash
cd apps/driver-app
npm install
```

### 3️⃣ Admin Dashboard (Port 4002)

```bash
cd apps/admin-dashboard
npm install
```

---

## 🏃 CHẠY CÁC APP

### Chạy từng app riêng lẻ:

**Terminal 1 - Customer App:**
```bash
cd apps/customer-app
npm start
```
→ Mở http://localhost:4000

**Terminal 2 - Driver App:**
```bash
cd apps/driver-app
npm start
```
→ Mở http://localhost:4001

**Terminal 3 - Admin Dashboard:**
```bash
cd apps/admin-dashboard
npm start
```
→ Mở http://localhost:4002

---

## 🐳 ĐẢM BẢO BACKEND ĐANG CHẠY

```bash
# Từ thư mục gốc project
docker-compose up -d

# Kiểm tra
curl http://localhost:3000/health
```

Kết quả phải là: `{"status":"ok",...}`

---

## 🧪 TEST FULL FLOW

### 1. **Admin Dashboard** (Port 4002)
- Login: `admin@test.com` / `Admin123!`
- Xem dashboard với stats
- Điều chỉnh surge pricing → 1.5x

### 2. **Customer App** (Port 4000)
- Login: `customer@test.com` / `Password123!`
- Đặt xe → Thấy surge 1.5x trong fare estimate
- Xác nhận đặt xe

### 3. **Driver App** (Port 4001)
- Login: `driver@test.com` / `Password123!`
- Hoàn thành profile setup
- Go Online
- Nhận ride request (20s countdown)
- Accept → Start → Complete

### 4. **Xem Admin Dashboard**
- Thấy notification "New ride created"
- Thấy "Ride completed"
- Revenue tăng lên tự động
- Stats cập nhật real-time

---

## 🗂️ CẤU TRÚC THƯ MỤC

```
apps/
├── customer-app/       # Port 4000 - Ứng dụng khách hàng
│   ├── src/
│   ├── package.json
│   └── README.md
│
├── driver-app/         # Port 4001 - Ứng dụng tài xế
│   ├── src/
│   ├── package.json
│   └── README.md
│
└── admin-dashboard/    # Port 4002 - Quản trị hệ thống
    ├── src/
    ├── package.json
    └── README.md
```

---

## 🎯 TÍNH NĂNG CHÍNH

### Customer App (4000) ✅
- ✅ Login/Register
- ✅ Bản đồ OSM với markers
- ✅ Tìm kiếm địa điểm (Nominatim)
- ✅ Ước tính giá với surge pricing
- ✅ Đặt xe
- ✅ Socket.IO real-time tracking

### Driver App (4001) ✅
- ✅ Login/Register
- ✅ Profile setup (vehicle info)
- ✅ Online/Offline toggle
- ✅ GPS tracking tự động (15s)
- ✅ Ride request modal với countdown 20s
- ✅ Accept/Reject rides
- ✅ Active ride management
- ✅ Socket.IO notifications

### Admin Dashboard (4002) ✅
- ✅ Admin login
- ✅ Dashboard với real-time stats
- ✅ Surge pricing management (slider 1.0-3.0x)
- ✅ Socket.IO live updates
- ⏳ Rides/Drivers/Customers tables (TODO)

---

## 🐛 TROUBLESHOOTING

### Lỗi: "Cannot find module 'react'"
→ Chưa cài npm packages. Chạy `npm install` trong thư mục app.

### Lỗi: Port already in use
```bash
# Kill process trên port 4000/4001/4002
# Windows:
netstat -ano | findstr :4000
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:4000 | xargs kill -9
```

### Backend không kết nối được
```bash
# Restart Docker
docker-compose down
docker-compose up -d

# Check logs
docker-compose logs -f
```

### Map không hiển thị
- Kiểm tra internet connection
- Clear browser cache
- Reload page (Ctrl+Shift+R)

---

## 📚 TÀI LIỆU CHI TIẾT

- **Customer App**: `apps/customer-app/QUICKSTART.md`
- **Driver App**: `apps/driver-app/README.md`
- **Admin Dashboard**: `apps/admin-dashboard/README.md`
- **Backend Test Report**: `tests/comprehensive-test-report.txt`

---

## ✅ CHECKLIST CÀI ĐẶT

- [ ] Backend running (`docker-compose up -d`)
- [ ] Customer App installed (`cd apps/customer-app && npm install`)
- [ ] Driver App installed (`cd apps/driver-app && npm install`)
- [ ] Admin Dashboard installed (`cd apps/admin-dashboard && npm install`)
- [ ] All 3 apps running (ports 4000, 4001, 4002)
- [ ] No "red squiggly lines" in VS Code
- [ ] Full flow tested (Customer → Driver → Admin)

---

**Sau khi cài đặt xong, code đỏ sẽ biến mất! Hãy chạy `npm install` trong cả 3 app. 🎉**
