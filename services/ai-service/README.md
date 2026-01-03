# AI Service - Cab Booking System

AI-powered microservice for ride estimation, driver matching, and surge pricing.

## Features

- **Ride Estimation**: Calculate distance, duration, and fare
- **Driver Matching**: Find and rank best drivers using ML scoring
- **Surge Pricing**: Dynamic pricing based on supply/demand

## Tech Stack

- Python 3.11
- FastAPI
- Redis (for geospatial queries)
- NumPy / Scikit-learn

## Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Run development server
uvicorn app.main:app --reload --port 3006
```

## API Endpoints

### POST /api/ride/estimate
Estimate ride details including distance, duration, and fare.

```json
{
  "pickup": { "lat": 10.762622, "lng": 106.660172 },
  "destination": { "lat": 10.773831, "lng": 106.704893 }
}
```

### POST /api/match/drivers
Find best matching drivers for a ride request.

```json
{
  "ride_id": "uuid",
  "pickup": { "lat": 10.762622, "lng": 106.660172 },
  "max_distance_km": 5.0
}
```

### POST /api/surge/pricing
Get surge pricing for a location.

```json
{
  "location": { "lat": 10.762622, "lng": 106.660172 },
  "radius_km": 3.0
}
```

## Docker

```bash
docker build -t ai-service .
docker run -p 3006:3006 ai-service
```
