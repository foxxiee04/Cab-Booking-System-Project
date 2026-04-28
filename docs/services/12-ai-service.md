# AI Service

> **Cổng HTTP:** 8000 | **Runtime:** Python / FastAPI | **Database:** File-based (`.joblib` models)

---

## 1. Tổng quan

AI Service cung cấp **ba khả năng dự đoán ML** phục vụ hệ thống:

| Model | Đầu vào | Đầu ra | Dùng bởi |
|-------|---------|--------|---------|
| **ETA & Price Multiplier** | distance, time_of_day, day_type | eta_minutes, surge | Pricing Service |
| **Accept Probability** | driver stats, fare, demand, zone | P(driver accepts) | API Gateway (matching) |
| **Wait Time** | demand, available drivers, hour | wait_time_minutes | Pricing Service |

Ngoài ra, service còn có **RAG Chatbot** — trợ lý hỗ trợ khách hàng dựa trên knowledge base và mô hình embedding.

---

## 2. Công nghệ

| Thành phần | Công nghệ |
|-----------|----------|
| Runtime | Python 3.11 |
| API Framework | FastAPI (ASGI) |
| Server | Uvicorn |
| ML | scikit-learn (RandomForest, GradientBoosting) |
| Serialization | joblib |
| Embedding (RAG) | `sentence-transformers` (paraphrase-multilingual-MiniLM-L12-v2) |
| Vector Search | FAISS (fallback: NumPy cosine) |
| Optional LLM | Groq API hoặc OpenAI API |
| Validation | Pydantic v2 |

---

## 3. Cấu trúc thư mục

```
services/ai-service/
├── app/
│   ├── main.py                    # FastAPI app, startup events
│   ├── core/config.py             # Settings (Pydantic BaseSettings)
│   ├── api/predict.py             # Tất cả API endpoints
│   ├── models/
│   │   ├── eta_price_model.joblib # Model ETA + Surge
│   │   ├── accept_model.joblib    # Model Accept Probability
│   │   └── wait_model.joblib      # Model Wait Time
│   ├── services/
│   │   ├── prediction_service.py  # Logic inference ETA/Surge
│   │   ├── accept_service.py      # Logic inference Accept Prob
│   │   ├── wait_service.py        # Logic inference Wait Time
│   │   └── rag_service.py         # RAG chatbot pipeline
│   ├── schemas/
│   │   ├── prediction.py          # ETA/Surge request/response
│   │   ├── accept_prediction.py   # Accept prob batch schema
│   │   ├── wait_prediction.py     # Wait time schema
│   │   └── chat.py                # Chat request/response
│   └── data/knowledge/            # Knowledge base cho RAG
│       ├── 01_booking_guide.txt
│       ├── 02_pricing.txt         # Bảng giá chính xác
│       ├── 03_payment.txt
│       ├── 04_vouchers.txt
│       ├── 05_cancellation.txt
│       ├── 06_driver_registration.txt
│       ├── 07_safety_support.txt
│       └── 08_account_wallet.txt
└── training/
    ├── train_model.py             # Train ETA + Surge model
    ├── train_accept_model.py      # Train Accept Prob model
    └── train_wait_model.py        # Train Wait Time model
```

---

## 4. Model 1: ETA & Price Multiplier

**Algorithm:** Random Forest Regressor (Multi-Output)

**Features:**
| Feature | Mô tả |
|---------|-------|
| `distance_km` | Khoảng cách chuyến đi (km) |
| `time_of_day` | 0=OFF_PEAK, 1=RUSH_HOUR (7–9h, 17–20h) |
| `day_type` | 0=WEEKDAY, 1=WEEKEND |

**Targets:**
- `eta_minutes`: Thời gian ước tính (1–120 phút)
- `price_multiplier`: Hệ số surge (1.0–2.0)

**Training data:** 1.000 mẫu synthetic (đủ để validate hành vi, không cần dữ liệu thật)

**API:**
```http
POST /api/predict
{
  "distance_km": 8.2,
  "time_of_day": "RUSH_HOUR",
  "day_type": "WEEKDAY"
}
```

**Response:**
```json
{
  "eta_minutes": 24,
  "price_multiplier": 1.12,
  "recommended_driver_radius_km": 3.0,
  "surge_hint": 1.12,
  "confidence_score": 0.87,
  "model_version": "eta-rf-v2",
  "insights": {
    "demand_level": "MEDIUM",
    "eta_confidence": "HIGH",
    "surge_reason": "Rush hour demand detected"
  }
}
```

---

## 5. Model 2: Accept Probability

**Algorithm:** Gradient Boosting Classifier (GBM)

**15 Features (sau encoding):**
| Feature | Mô tả |
|---------|-------|
| `eta_log` | log1p(eta_minutes) |
| `distance_log` | log1p(distance_km) |
| `fare_k_log` | log1p(fare/1000) |
| `surge` | surge_multiplier (1.0–3.0) |
| `accept_rate` | Tỷ lệ chấp nhận lịch sử tài xế |
| `cancel_rate` | Tỷ lệ hủy lịch sử tài xế |
| `hour_sin` + `hour_cos` | Cyclical encoding giờ trong ngày |
| `zone_A/B/C` | One-hot encoding khu vực đón |
| `demand_score` | Ordinal: LOW=0, MEDIUM=1, HIGH=2 |
| `avail_log` | log1p(available_driver_count) |
| `fare_per_eta` | fare_k / max(1, eta) |
| `demand_supply_ratio` | demand_score / max(1, avail_log) |

**Quy luật label:**
- Tài xế yêu thích chuyến gần (eta < 5 → +15% prob)
- Tài xế tránh chuyến xa (eta > 15 → -20% prob)
- Fare > 80k → +8%, Fare < 30k → -10%
- Demand HIGH → +10%, LOW → -5%

**API (Batch):**
```http
POST /api/predict/accept/batch
{
  "context": {
    "distance_km": 3.0,
    "fare_estimate": 111000,
    "surge_multiplier": 1.2,
    "hour_of_day": 8,
    "pickup_zone": "A",
    "demand_level": "HIGH",
    "available_driver_count": 5
  },
  "drivers": [
    { "driver_id": "drv-001", "eta_minutes": 3, "driver_accept_rate": 0.92, "driver_cancel_rate": 0.03 },
    { "driver_id": "drv-002", "eta_minutes": 15, "driver_accept_rate": 0.55, "driver_cancel_rate": 0.20 }
  ]
}
```

**Response:**
```json
{
  "results": [
    { "driver_id": "drv-001", "p_accept": 0.822, "p_accept_clamped": 0.822, "confidence": 0.644 },
    { "driver_id": "drv-002", "p_accept": 0.591, "p_accept_clamped": 0.591, "confidence": 0.371 }
  ],
  "model_version": "accept-gbm-v1",
  "reason_code": "AI_OK",
  "inference_ms": 3
}
```

---

## 6. Model 3: Wait Time Prediction

**Algorithm:** Gradient Boosting Regressor (Huber loss)

**12 Features:**
| Feature | Mô tả |
|---------|-------|
| `demand_score` | LOW=0, MEDIUM=1, HIGH=2 |
| `active_booking_log` | log1p(số booking đang chờ) |
| `avail_driver_log` | log1p(số tài xế online) |
| `hour_sin/cos` | Cyclical giờ |
| `dow_sin/cos` | Cyclical ngày trong tuần |
| `surge_multiplier` | Giá tăng → tài xế ra nhiều hơn → chờ ít hơn |
| `avg_accept_rate` | Tỷ lệ chấp nhận trung bình vùng |
| `historical_wait_p50` | Median wait time lịch sử |
| `zone_A` | Khu vực trung tâm (A = nhanh hơn) |
| `demand_supply_ratio` | demand_score - avail_log |

**API:**
```http
POST /api/predict/wait-time
{
  "demand_level": "HIGH",
  "active_booking_count": 40,
  "available_driver_count": 3,
  "hour_of_day": 8,
  "day_of_week": 1,
  "surge_multiplier": 1.3,
  "avg_accept_rate": 0.75,
  "historical_wait_p50": 6.0,
  "pickup_zone": "A"
}
```

**Response:**
```json
{
  "wait_time_minutes": 8.3,
  "confidence": 0.864,
  "model_version": "wait-gbr-v1",
  "reason_code": "AI_OK"
}
```

---

## 7. RAG Chatbot

**Pipeline:**

```
1. Startup:
   Đọc tất cả .txt files từ app/data/knowledge/
   Chunk (400 ký tự, overlap 80)
   Encode bằng sentence-transformer (117MB model)
   Build FAISS index (L2-normalized cosine)

2. Request:
   User message → encode query
   FAISS search top-k=4 chunks (threshold score ≥ 0.25)
   Nếu GROQ_API_KEY hoặc OPENAI_API_KEY: gọi LLM để tổng hợp
   Fallback: trả về chunk text trực tiếp

3. Response:
   { answer, sources, score_max, mode, latency_ms }
```

**Embedding model:** `paraphrase-multilingual-MiniLM-L12-v2` (hỗ trợ tiếng Việt)

**API:**
```http
POST /api/chat
{
  "message": "Giá xe 4 chỗ bao nhiêu tiền một km?",
  "history": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}],
  "top_k": 4
}
```

---

## 8. Training Models

```bash
cd services/ai-service

# Train ETA + Surge model
python training/train_model.py
# → app/models/eta_price_model.joblib

# Train Accept Probability model
python training/train_accept_model.py
# → app/models/accept_model.joblib

# Train Wait Time model
python training/train_wait_model.py
# → app/models/wait_model.joblib
```

Models dùng **synthetic data** được generate ngay trong script training — không cần database thật. Khi deploy, model files được copy vào Docker image.

---

## 9. Fallback khi AI không available

Pricing Service gọi AI với timeout **150ms**. Nếu hết timeout hoặc lỗi:
- `reason_code = "AI_TIMEOUT"` hoặc `"AI_HTTP_ERROR"`
- Dùng surge từ Redis (hoặc 1.0 mặc định)
- ETA dùng công thức đơn giản: `distance / speed × 60`

**Hệ thống hoạt động bình thường** kể cả khi AI service down.

---

## 10. Cấu hình & Biến môi trường

| Biến | Mô tả |
|------|-------|
| `PORT` | Cổng HTTP (mặc định `8000`) |
| `MODEL_PATH` | Path model ETA/Surge |
| `ACCEPT_MODEL_PATH` | Path model Accept Prob |
| `WAIT_MODEL_PATH` | Path model Wait Time |
| `RAG_EMBEDDING_MODEL` | Model embedding (mặc định: multilingual-MiniLM) |
| `RAG_LLM_PROVIDER` | `none` \| `groq` \| `openai` \| `auto` |
| `GROQ_API_KEY` | Key Groq (free tier, fast) |
| `OPENAI_API_KEY` | Key OpenAI |
| `RAG_LLM_MODEL` | Model ID LLM |

---

## 11. Khởi động & Vận hành

```bash
# Development
cd services/ai-service
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000

# Docker
docker compose up ai-service

# Health check
GET http://localhost:8000/health
# → {"status": "healthy", "model_loaded": true, "rag_ready": true}

# Stats (debug)
GET http://localhost:8000/api/stats

# Swagger docs
GET http://localhost:8000/docs
```

> AI Service là **optional** trong kiến trúc — tất cả calls có fallback, hệ thống không phụ thuộc vào nó để hoạt động.
