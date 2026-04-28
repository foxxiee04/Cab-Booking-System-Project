# Pricing Service

> **Cổng HTTP:** 3009 | **Cổng gRPC:** 50057 | **Database:** Không có (Redis cache)

---

## 1. Tổng quan

Pricing Service là **service tính giá cước stateless** — không lưu dữ liệu trong database quan hệ, chỉ tính toán và trả về kết quả. Service:
- Tính giá ước tính cho chuyến đi (dùng khi khách xem giá trước khi đặt)
- Tính giá thực tế sau chuyến (dùng bởi Payment Service)
- Gọi AI Service để lấy dự đoán ETA và surge multiplier
- Cache surge multiplier trong Redis (admin/AI có thể cập nhật)

---

## 2. Công nghệ

| Thành phần | Công nghệ |
|-----------|----------|
| Runtime | Node.js 20, TypeScript |
| HTTP Framework | Express.js |
| Cache | Redis (surge multiplier) |
| gRPC Server | `@grpc/grpc-js` |
| Distance | OSRM (routing engine), fallback Haversine |
| AI Integration | HTTP call đến AI Service (timeout 150ms) |

---

## 3. Công thức Tính Giá

```
subtotal = baseFare
         + vehicleServiceFee
         + distanceKm × perKmRate
         + durationMinutes × perMinuteRate
         + shortTripFee  (nếu distance < 2.5km)

totalFare = max(round(subtotal × surgeMultiplier), minimumFare)
```

### Bảng giá theo loại xe

| Loại xe | Base | Service Fee | /km | /phút | Short Trip Fee |
|---------|------|-------------|-----|-------|---------------|
| MOTORBIKE | 10.000đ | 0 | 6.200đ | 450đ | 0 |
| SCOOTER | 14.000đ | 1.500đ | 8.400đ | 700đ | 1.500đ |
| CAR_4 | 24.000đ | 6.000đ | 15.000đ | 1.900đ | 6.000đ |
| CAR_7 | 32.000đ | 10.000đ | 18.500đ | 2.400đ | 9.000đ |

- **Short Trip Threshold:** < 2.5 km
- **Minimum Fare:** 15.000đ
- **Surge range:** 1.0 – 2.0

---

## 4. Tích hợp AI Service

```
POST http://ai-service:8000/api/predict
{
  distance_km: 8.2,
  time_of_day: "RUSH_HOUR",   // 7-9h, 17-20h → RUSH_HOUR, còn lại OFF_PEAK
  day_type: "WEEKDAY"         // Sat/Sun → WEEKEND
}

Response (timeout 150ms, fallback về surge từ Redis):
{
  eta_minutes: 24,
  price_multiplier: 1.12,
  insights: {
    demand_level: "MEDIUM",
    eta_confidence: "HIGH",
    recommended_driver_radius_km: 3
  }
}
```

**Fallback strategy**: Nếu AI không phản hồi trong 150ms, dùng surge từ Redis (hoặc 1.0 nếu Redis cũng không có).

---

## 5. API Endpoints (HTTP)

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/pricing/estimate` | Ước tính giá trước chuyến |
| GET | `/api/pricing/surge` | Surge multiplier hiện tại |
| POST | `/api/pricing/surge` | Cập nhật surge (admin) |
| GET | `/api/pricing/surge-zones` | Khu vực surge (theo địa lý) |

### Request `/estimate`

```json
{
  "pickupLat": 10.7726,
  "pickupLng": 106.6980,
  "dropoffLat": 10.8185,
  "dropoffLng": 106.6588,
  "vehicleType": "CAR_4"
}
```

### Response `/estimate`

```json
{
  "fare": 210000,
  "distance": 8.17,
  "duration": 1680,
  "durationMinutes": 28,
  "surgeMultiplier": 1.12,
  "estimatedWaitMinutes": 4.2,
  "breakdown": {
    "baseFare": 24000,
    "vehicleServiceFee": 6000,
    "distanceFare": 122550,
    "timeFare": 53200,
    "subtotal": 205750,
    "surgeAmount": 23046
  },
  "operationalHints": {
    "predictionSource": "AI",
    "demandLevel": "MEDIUM",
    "recommendedDriverRadiusKm": 3
  }
}
```

---

## 6. gRPC Interface

```protobuf
service PricingService {
  rpc EstimateFare (FareRequest) returns (FareResponse);
  rpc GetSurgeMultiplier (Empty) returns (SurgeResponse);
}

message FareRequest {
  double pickup_lat = 1;
  double pickup_lng = 2;
  double dropoff_lat = 3;
  double dropoff_lng = 4;
  string vehicle_type = 5;
}

message FareResponse {
  double fare = 1;
  double distance = 2;
  int32 duration = 3;
  double surge_multiplier = 4;
  FareBreakdown breakdown = 5;
}
```

API Gateway gọi gRPC thay vì HTTP cho `/api/pricing/estimate` để giảm latency (không qua JSON serialization overhead).

---

## 7. Distance Calculation

```
Ưu tiên 1: OSRM routing engine
  GET /route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=false
  → Trả về khoảng cách thực tế theo đường đi (chính xác hơn)

Ưu tiên 2 (fallback): Haversine formula
  → Khoảng cách đường thẳng (ước tính khi OSRM không available)
```

---

## 8. Dynamic Surge

```
Định kỳ (hoặc do API Gateway trigger):
  activeRides / availableDrivers > 3.0 → surge = 2.0 (peak)
  activeRides / availableDrivers > 2.0 → surge = 1.5 (high)
  activeRides / availableDrivers > 1.0 → surge = 1.3 (medium)
  giờ cao điểm (7-9h, 17-20h) → ×1.2
  cuối tuần đêm (20h+) → ×1.15
  tổng cắt ở 3.0
```

---

## 9. Cấu hình & Biến môi trường

| Biến | Mô tả |
|------|-------|
| `REDIS_URL` | Lưu surge multiplier |
| `OSRM_BASE_URL` | OSRM routing server |
| `AI_SERVICE_URL` | `http://ai-service:8000` |
| `AI_SERVICE_TIMEOUT_MS` | Timeout gọi AI (mặc định `150`) |
| `AI_SURGE_MIN` | Surge tối thiểu từ AI (mặc định `1.0`) |
| `AI_SURGE_MAX` | Surge tối đa từ AI (mặc định `2.0`) |
| `AI_RADIUS_MIN_KM` | Radius tài xế tối thiểu (mặc định `2.0`) |
| `AI_RADIUS_MAX_KM` | Radius tài xế tối đa (mặc định `5.0`) |
| `GRPC_PORT` | Cổng gRPC (mặc định `50057`) |

---

## 10. Khởi động & Vận hành

```bash
npm run dev:pricing

# Không có Prisma migration (stateless)
GET http://localhost:3009/health
```

> **Build context**: Cần build từ **root** (phụ thuộc `shared/` và gRPC proto files).
