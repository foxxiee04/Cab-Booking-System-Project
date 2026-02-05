# AI Service - ETA & Price Multiplier Prediction

An independent AI microservice for predicting Estimated Time of Arrival (ETA) and surge price multipliers in the Cab Booking System.

## 🎯 Purpose

- **Independent Service**: Standalone FastAPI application, no core domain logic
- **Prediction Models**: Predict ETA (minutes) and price multiplier (surge pricing)
- **Clean Integration**: Communicates only with Pricing Service via HTTP REST
- **Production Ready**: Proper error handling, logging, validation

## 🏗️ Architecture

```
Pricing Service (Port 3009)
    ↓
    → POST /api/predict
    ← AI Service (Port 8000)
       - FastAPI
       - ML Model (joblib)
       - Pydantic validation
```

## 📋 API Specification

### Health Check
```bash
GET /api/health
```

Response:
```json
{
  "status": "healthy",
  "service": "ai-service",
  "version": "1.0.0"
}
```

### Predict ETA & Price Multiplier
```bash
POST /api/predict
Content-Type: application/json

{
  "distance_km": 8.5,
  "time_of_day": "RUSH_HOUR",
  "day_type": "WEEKDAY"
}
```

Response:
```json
{
  "eta_minutes": 22,
  "price_multiplier": 1.08,
  "distance_km": 8.5,
  "time_of_day": "RUSH_HOUR",
  "day_type": "WEEKDAY"
}
```

### Statistics
```bash
GET /api/stats
```

## 🚀 Quick Start

### 1. Train Model

```bash
cd training
python train_model.py
```

This generates:
- Synthetic training data (1000 samples)
- Trains Random Forest model
- Saves to `app/models/eta_price_model.joblib`

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Run Service

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Or with reload:
```bash
uvicorn app.main:app --reload
```

### 4. Access Documentation

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 🐳 Docker Deployment

### Build Image
```bash
docker build -t ai-service:latest .
```

### Run Container
```bash
docker run -p 8000:8000 ai-service:latest
```

### Docker Compose
```bash
docker-compose up -d ai-service
```

## 🧪 Testing

### Run All Tests
```bash
pytest
```

### Run Specific Test Class
```bash
pytest tests/test_predict_api.py::TestPredictEndpoint
```

### Run with Coverage
```bash
pytest --cov=app tests/
```

### Test Categories

**Health Checks**
```bash
pytest tests/test_predict_api.py::TestHealthEndpoint
```

**Prediction Tests**
```bash
pytest tests/test_predict_api.py::TestPredictEndpoint
```

**Validation Tests**
```bash
pytest tests/test_predict_api.py::TestValidation
```

## 📊 Model Details

### Features
- `distance_km`: Distance in kilometers (0 < distance <= 100)
- `time_of_day`: OFF_PEAK or RUSH_HOUR
- `day_type`: WEEKDAY or WEEKEND

### Targets
- `eta_minutes`: Estimated time of arrival (1-120 minutes)
- `price_multiplier`: Surge pricing factor (1.0-2.0)

### Algorithm
- **Model**: Multi-Output Random Forest Regression
- **Estimators**: 100 trees
- **Max Depth**: 10
- **Feature Scaling**: StandardScaler

### Performance
- Training R² Score: ~0.95
- Test R² Score: ~0.92

## 🔄 Integration with Pricing Service

### Call AI Service from Pricing Service

```typescript
// In Pricing Service (Node.js/TypeScript)
async function getPriceMultiplier(
  distanceKm: number,
  timeOfDay: string,
  dayType: string
): Promise<{ etaMinutes: number; priceMultiplier: number }> {
  const response = await fetch('http://ai-service:8000/api/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      distance_km: distanceKm,
      time_of_day: timeOfDay,
      day_type: dayType
    })
  });
  
  return response.json();
}
```

## 🛠️ Configuration

### Environment Variables

See `.env.example`:
```
APP_NAME=AI Prediction Service
APP_VERSION=1.0.0
DEBUG=False
HOST=0.0.0.0
PORT=8000
MODEL_PATH=app/models/eta_price_model.joblib
```

## 📁 Project Structure

```
ai-service/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application
│   ├── api/
│   │   └── predict.py          # API endpoints
│   ├── schemas/
│   │   └── prediction.py       # Pydantic models
│   ├── services/
│   │   └── prediction_service.py  # ML prediction logic
│   ├── models/
│   │   └── eta_price_model.joblib  # Trained model
│   └── core/
│       └── config.py           # Configuration
├── training/
│   └── train_model.py          # Model training script
├── tests/
│   └── test_predict_api.py     # Test suite
├── requirements.txt            # Dependencies
├── Dockerfile                  # Container image
└── README.md                   # This file
```

## 🔒 Security Considerations

- ✅ Input validation with Pydantic
- ✅ Type hints for safety
- ✅ Error handling and logging
- ✅ CORS enabled for service-to-service communication
- ✅ No sensitive data in logs

## 📊 Logging

All requests and predictions are logged:

```
2024-02-04 10:30:45 - app.services.prediction_service - INFO - Model loaded successfully
2024-02-04 10:30:46 - app.api.predict - INFO - Prediction: distance=8.5km, time=RUSH_HOUR, day=WEEKDAY -> ETA=22min, multiplier=1.08
```

## 🚨 Error Handling

### Model Not Found
```
HTTPException: 500 - Model file not found at app/models/eta_price_model.joblib
```

**Solution**: Run training script to generate model

### Invalid Input
```
HTTPException: 422 - Validation Error
```

**Solution**: Check request schema against API documentation

### Prediction Error
```
HTTPException: 500 - Prediction error: <error details>
```

**Solution**: Check service logs, verify model file integrity

## 📈 Future Enhancements

- [ ] Real-time model retraining
- [ ] Feature importance analysis
- [ ] Model versioning
- [ ] Batch prediction endpoint
- [ ] Metrics collection and monitoring
- [ ] A/B testing support
- [ ] Custom model upload

## 🤝 Integration Checklist

- [x] FastAPI application created
- [x] Pydantic schemas for validation
- [x] ML model training pipeline
- [x] Comprehensive test suite
- [x] Docker support
- [x] OpenAPI documentation
- [x] Error handling
- [x] Logging

## 📚 Documentation

- [Swagger UI](http://localhost:8000/docs) - Interactive API documentation
- [ReDoc](http://localhost:8000/redoc) - Alternative API documentation
- OpenAPI Schema: http://localhost:8000/openapi.json

## 🐛 Debugging

### Check Service Health
```bash
curl http://localhost:8000/api/health
```

### Test Prediction
```bash
curl -X POST http://localhost:8000/api/predict \
  -H "Content-Type: application/json" \
  -d '{
    "distance_km": 8.5,
    "time_of_day": "RUSH_HOUR",
    "day_type": "WEEKDAY"
  }'
```

### View Logs
```bash
docker compose logs -f ai-service
```

## 📝 License

Same as main project

## 👥 Support

For issues or questions:
1. Check API documentation (/docs)
2. Review test cases for usage examples
3. Check service logs
4. Verify model file exists

---

**Version**: 1.0.0
**Status**: Production Ready
**Last Updated**: 2024-02-04
