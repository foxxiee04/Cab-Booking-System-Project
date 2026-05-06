# Review Service

> **Cổng HTTP:** 3010 | **Database:** MongoDB (`review_db`)

---

## 1. Tổng quan

Review Service quản lý **hệ thống đánh giá hai chiều** sau mỗi chuyến đi:
- Khách hàng đánh giá tài xế (1–5 sao + nhận xét)
- Tài xế đánh giá khách hàng

Sau khi review được lưu, service tính toán và cập nhật `ratingAverage` trong Driver Service (qua RabbitMQ event).

**Vì sao dùng MongoDB?** Đánh giá là dữ liệu dạng document với schema linh hoạt (tags, nested comment), không yêu cầu ACID transaction phức tạp, và cần full-text search hiệu quả.

---

## 2. Công nghệ

| Thành phần | Công nghệ |
|-----------|----------|
| Runtime | Node.js 20, TypeScript |
| HTTP Framework | Express.js |
| Database | MongoDB (Mongoose ODM) |
| Events | RabbitMQ (publish) |

---

## 3. Database Schema (`review_db`)

### Collection `reviews`

```javascript
{
  _id:          ObjectId,
  rideId:       String,           // FK logic → Ride
  bookingId:    String?,          // FK logic → Booking

  type:         String,           // "CUSTOMER_TO_DRIVER" | "DRIVER_TO_CUSTOMER"

  reviewerId:   String,           // userId người đánh giá
  reviewerName: String,           // Tên hiển thị
  revieweeId:   String,           // userId người được đánh giá
  revieweeName: String,

  rating:       Number,           // 1–5 sao
  comment:      String?,          // Nhận xét tự do
  tags:         [String],
  // Customer→Driver tags: "professional", "safe_driving", "clean_car", "late_pickup", "rude"
  // Driver→Customer tags: "cooperative", "punctual", "route_change", "slow_response"

  isAnonymous:  Boolean,          // Ẩn danh
  isHidden:     Boolean,          // Admin ẩn vi phạm chính sách
  createdAt:    Date,
}
```

---

## 4. API Endpoints

| Method | Path | Mô tả | Auth |
|--------|------|-------|------|
| POST | `/api/reviews` | Gửi đánh giá sau chuyến | ✅ |
| GET | `/api/reviews/received/:userId` | Đánh giá mà user nhận được | ✅ |
| GET | `/api/reviews/given/:userId` | Đánh giá do user đã gửi | ✅ |
| GET | `/api/reviews/ride/:rideId` | Đánh giá của một chuyến | ✅ |
| GET | `/api/reviews/stats/:userId` | Thống kê rating của user | ✅ |
| GET | `/api/reviews/driver/:driverId/stats` | Thống kê rating của tài xế | ✅ |
| PUT | `/api/reviews/:reviewId` | Cập nhật đánh giá | ✅ |
| DELETE | `/api/reviews/:reviewId` | Xóa đánh giá | ✅ |
| GET | `/api/reviews/top-drivers` | Danh sách tài xế rating cao | ✅ |

---

## 5. Luồng Đánh giá

```
ride.completed event
        │
        ▼
Cho phép review trong cửa sổ 24h sau khi chuyến hoàn thành
        │
Customer đánh giá tài xế:
    POST /reviews {rideId, type: "CUSTOMER_TO_DRIVER", rating: 5, comment: "..."}
        │
        ├─ Kiểm tra: rideId đúng, customerId khớp, chưa review lần nào
        ├─ INSERT review document
        └─ Publish driver.rating_updated {driverId, newAverage}
                   │
                   ▼
           [Driver Service] cập nhật ratingAverage, ratingCount

Driver đánh giá khách:
    POST /reviews {rideId, type: "DRIVER_TO_CUSTOMER", rating: 4}
        └─ INSERT review document
```

---

## 6. Cấu hình & Biến môi trường

| Biến | Mô tả |
|------|-------|
| `MONGODB_URI` | MongoDB → `review_db` |
| `RABBITMQ_URL` | Publish rating_updated events |
| `REVIEW_WINDOW_HOURS` | Cửa sổ cho phép review (mặc định 24) |

---

## 7. Khởi động & Vận hành

```bash
npm run dev:review

GET http://localhost:3010/health
```
