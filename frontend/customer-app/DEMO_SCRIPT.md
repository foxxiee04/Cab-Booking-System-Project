# Demo Script - Frontend Customer App

## Chuẩn bị

### 1. Start Backend Services
```bash
# Terminal 1 - Start all services với Docker
docker-compose up -d

# Hoặc chạy từng service
cd services/auth-service && npm run dev
cd services/ride-service && npm run dev
cd services/ai-service && python app/main.py
```

### 2. Start Frontend
```bash
cd frontend/customer-app
npm install  # Nếu chưa install
npm run dev  # Chạy trên port 4000
```

### 3. Mở Browser
```
http://localhost:4000
```

## Demo Flow - Đặt xe

### Bước 1: Đăng ký / Đăng nhập

**Homepage:**
1. Mở http://localhost:4000
2. Click "Đăng ký" hoặc "Đăng nhập"
3. Đăng nhập với:
   - Email: `customer@test.com`
   - Password: `password123`

### Bước 2: Trang đặt xe

**Sau khi login, tự động redirect đến `/book`**

**Giao diện:**
- ✅ Map toàn màn hình hiển thị TP.HCM
- ✅ Panel bên trái (desktop) hoặc dưới (mobile)
- ✅ Header với nút "Chuyến đi" và "Đăng xuất"

### Bước 3: Nhập điểm đón

**Click vào ô "Điểm đón":**

1. **Test Autocomplete:**
   - Nhập: `"Bến"`
   - Xem gợi ý xuất hiện: Bến Thành, ...
   - Hoặc nhập: `"Tân Sơn"`
   - Xem gợi ý: Sân bay Tân Sơn Nhất

2. **Chọn địa điểm:**
   - Click vào một gợi ý
   - Địa chỉ được fill vào ô
   - Marker xanh xuất hiện trên map
   - Map zoom vào vị trí

3. **Địa điểm phổ biến:**
   - Nếu chưa nhập gì, dropdown hiển thị 5 địa điểm phổ biến
   - Chợ Bến Thành
   - Sân bay Tân Sơn Nhất
   - Nhà thờ Đức Bà
   - Phạm Ngũ Lão
   - Landmark 81

### Bước 4: Nhập điểm đến

**Click vào ô "Điểm đến":**

1. **Test Autocomplete:**
   - Nhập: `"Landmark"`
   - Xem gợi ý: Landmark 81, ...
   - Hoặc nhập: `"Quận 1"`
   - Xem các địa điểm ở Quận 1

2. **Chọn địa điểm:**
   - Click vào một gợi ý
   - Địa chỉ được fill vào ô
   - Marker đỏ xuất hiện trên map
   - Đường nối (polyline xanh) vẽ giữa 2 điểm
   - Map zoom để hiển thị cả 2 điểm

### Bước 5: Tìm xe

**Click button "Tìm xe":**

1. **Loading state:**
   - Button hiển thị "Đang tính toán..."
   - Spinner animation

2. **Kết quả:**
   - Panel chuyển sang step 2: "Chọn loại xe"
   - Hiển thị tóm tắt route:
     - Điểm đón: [địa chỉ]
     - Điểm đến: [địa chỉ]
   - Hiển thị distance và duration ở trên

### Bước 6: Chọn loại xe

**4 loại xe hiển thị:**

1. **Economy 🚗**
   - Giá: [base price] x 1.0
   - Features: 4 chỗ, Điều hòa, Giá rẻ

2. **Comfort 🚙**
   - Giá: [base price] x 1.3
   - Features: 4 chỗ, Xe mới, Êm ái

3. **Premium 🚘**
   - Giá: [base price] x 1.6
   - Features: 4 chỗ, Xe sang, Dịch vụ VIP

4. **SUV 🚐**
   - Giá: [base price] x 1.8
   - Features: 7 chỗ, Xe lớn, Gia đình

**Click vào loại xe:**
- Card được highlight
- Badge "Đã chọn" hiển thị
- Checkmark ở góc trên phải

### Bước 7: Đặt xe

**Click button "Đặt xe":**

1. **Loading:**
   - Button: "Đang đặt..."
   - Spinner

2. **Success:**
   - Redirect đến `/rides`
   - Hiển thị danh sách chuyến đi
   - Chuyến mới ở trên cùng với status "Đang tìm tài xế"

### Bước 8: Xem chuyến đi

**Trang `/rides`:**
- Danh sách chuyến đi
- Status badge với màu:
  - Vàng: Đang tìm
  - Xanh: Đã nhận
  - Tím: Đã đến
  - Xanh lá: Đang đi
  - Xám: Hoàn thành
  - Đỏ: Đã hủy

## Test Cases

### TC1: Autocomplete Search
```
Input: "Bến Thành"
Expected: Dropdown hiển thị gợi ý liên quan
Result: ✅ Pass
```

### TC2: Map Markers
```
Input: Chọn điểm đón + điểm đến
Expected: 2 markers và 1 polyline
Result: ✅ Pass
```

### TC3: Vehicle Selection
```
Input: Click vào loại xe
Expected: Card highlight, giá cập nhật
Result: ✅ Pass
```

### TC4: Booking Flow
```
Input: Hoàn thành flow đặt xe
Expected: Redirect to /rides
Result: ✅ Pass
```

### TC5: Responsive Mobile
```
Input: Thu nhỏ browser < 768px
Expected: Sliding panel từ dưới
Result: ✅ Pass
```

### TC6: Error Handling
```
Input: Click "Tìm xe" khi chưa chọn địa điểm
Expected: Error message hiển thị
Result: ✅ Pass
```

## Screenshots Test

### Desktop
1. Homepage - Landing
2. Book page - Location step
3. Book page - Vehicle step  
4. Book page - Map with route
5. Rides page - List

### Mobile
1. Homepage - Responsive
2. Book page - Panel closed
3. Book page - Panel open
4. Autocomplete dropdown
5. Vehicle selection grid

## Performance Test

### Metrics to check:
- [ ] Autocomplete response < 500ms
- [ ] Map load time < 2s
- [ ] Page load < 3s
- [ ] Smooth 60fps animations
- [ ] No console errors

### Tools:
```bash
# Lighthouse
npm run build
npm run start
# Open Chrome DevTools > Lighthouse > Run

# Bundle size
npm run build
# Check .next/static/chunks/
```

## Common Issues

### Issue 1: Map không load
**Solution:**
- Check NEXT_PUBLIC_TRACKASIA_KEY
- Check internet connection
- Check console errors

### Issue 2: Autocomplete không có kết quả
**Solution:**
- Check Geocoding API key
- Check network tab
- Check search query length >= 2

### Issue 3: Backend không response
**Solution:**
- Check backend services running
- Check API_URL env variable
- Check CORS settings

### Issue 4: Panel animation lag
**Solution:**
- Disable animations in dev
- Check browser performance
- Reduce marker count

## Demo Script cho Khách hàng

### Giới thiệu (2 phút)
"Chào mừng đến với ứng dụng đặt xe của chúng tôi. 
Hôm nay tôi sẽ demo các tính năng chính."

### Feature 1: Tìm kiếm thông minh (3 phút)
"Khi bạn nhập địa điểm, hệ thống tự động gợi ý 
các địa điểm phù hợp sử dụng AI."

### Feature 2: Bản đồ tương tác (2 phút)  
"Bạn có thể thấy trực quan vị trí đón/đến 
và tuyến đường trên bản đồ."

### Feature 3: Chọn loại xe (2 phút)
"Chúng tôi có 4 loại xe phù hợp với nhu cầu 
và ngân sách của bạn."

### Feature 4: Đặt xe nhanh (1 phút)
"Chỉ với vài click, chuyến đi của bạn được đặt 
và bạn có thể theo dõi realtime."

### Tổng kết (1 phút)
"Giao diện thân thiện, dễ sử dụng trên cả 
mobile và desktop."

---

**Total Demo Time: ~10-15 phút**
