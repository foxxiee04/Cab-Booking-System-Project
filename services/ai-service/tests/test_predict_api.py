"""Test cases for AI prediction API"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.prediction import TimeOfDayEnum, DayTypeEnum

client = TestClient(app)


class TestHealthEndpoint:
    """Test health check endpoint"""
    
    def test_health_check_returns_200(self):
        """Test health check returns 200 status"""
        response = client.get("/api/health")
        assert response.status_code == 200
    
    def test_health_check_response_structure(self):
        """Test health check response has correct structure"""
        response = client.get("/api/health")
        data = response.json()
        
        assert "status" in data
        assert "service" in data
        assert "version" in data
        assert data["status"] == "healthy"
        assert data["service"] == "ai-service"


class TestPredictEndpoint:
    """Test prediction endpoint"""
    
    def test_predict_valid_request(self):
        """Test predict with valid request"""
        payload = {
            "distance_km": 8.5,
            "time_of_day": "RUSH_HOUR",
            "day_type": "WEEKDAY"
        }
        response = client.post("/api/predict", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        # Check response structure
        assert "eta_minutes" in data
        assert "price_multiplier" in data
        assert "distance_km" in data
        assert "time_of_day" in data
        assert "day_type" in data
        
        # Check value ranges
        assert 1 <= data["eta_minutes"] <= 120
        assert 1.0 <= data["price_multiplier"] <= 2.0
        assert data["distance_km"] == 8.5
    
    def test_predict_off_peak_weekday(self):
        """Test predict for off-peak weekday (low multiplier expected)"""
        payload = {
            "distance_km": 5.0,
            "time_of_day": "OFF_PEAK",
            "day_type": "WEEKDAY"
        }
        response = client.post("/api/predict", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["time_of_day"] == "OFF_PEAK"
        assert data["day_type"] == "WEEKDAY"
        assert data["eta_minutes"] >= 1
    
    def test_predict_rush_hour_weekend(self):
        """Test predict for rush hour weekend (higher multiplier expected)"""
        payload = {
            "distance_km": 15.0,
            "time_of_day": "RUSH_HOUR",
            "day_type": "WEEKEND"
        }
        response = client.post("/api/predict", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["time_of_day"] == "RUSH_HOUR"
        assert data["day_type"] == "WEEKEND"
        assert data["eta_minutes"] >= 1
    
    def test_predict_min_distance(self):
        """Test predict with minimum valid distance"""
        payload = {
            "distance_km": 0.1,
            "time_of_day": "OFF_PEAK",
            "day_type": "WEEKDAY"
        }
        response = client.post("/api/predict", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["eta_minutes"] >= 1
    
    def test_predict_max_distance(self):
        """Test predict with maximum valid distance"""
        payload = {
            "distance_km": 100.0,
            "time_of_day": "RUSH_HOUR",
            "day_type": "WEEKEND"
        }
        response = client.post("/api/predict", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["eta_minutes"] <= 120
    
    def test_predict_multiple_requests(self):
        """Test multiple predictions in sequence"""
        payloads = [
            {"distance_km": 5.0, "time_of_day": "OFF_PEAK", "day_type": "WEEKDAY"},
            {"distance_km": 10.0, "time_of_day": "RUSH_HOUR", "day_type": "WEEKDAY"},
            {"distance_km": 20.0, "time_of_day": "OFF_PEAK", "day_type": "WEEKEND"},
            {"distance_km": 25.0, "time_of_day": "RUSH_HOUR", "day_type": "WEEKEND"},
        ]
        
        for payload in payloads:
            response = client.post("/api/predict", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert 1 <= data["eta_minutes"] <= 120
            assert 1.0 <= data["price_multiplier"] <= 2.0


class TestValidation:
    """Test input validation"""
    
    def test_missing_distance_km(self):
        """Test missing distance_km field returns 422"""
        payload = {
            "time_of_day": "RUSH_HOUR",
            "day_type": "WEEKDAY"
        }
        response = client.post("/api/predict", json=payload)
        assert response.status_code == 422
    
    def test_missing_time_of_day(self):
        """Test missing time_of_day field returns 422"""
        payload = {
            "distance_km": 8.5,
            "day_type": "WEEKDAY"
        }
        response = client.post("/api/predict", json=payload)
        assert response.status_code == 422
    
    def test_missing_day_type(self):
        """Test missing day_type field returns 422"""
        payload = {
            "distance_km": 8.5,
            "time_of_day": "RUSH_HOUR"
        }
        response = client.post("/api/predict", json=payload)
        assert response.status_code == 422
    
    def test_invalid_time_of_day(self):
        """Test invalid time_of_day value returns 422"""
        payload = {
            "distance_km": 8.5,
            "time_of_day": "INVALID_TIME",
            "day_type": "WEEKDAY"
        }
        response = client.post("/api/predict", json=payload)
        assert response.status_code == 422
    
    def test_invalid_day_type(self):
        """Test invalid day_type value returns 422"""
        payload = {
            "distance_km": 8.5,
            "time_of_day": "RUSH_HOUR",
            "day_type": "INVALID_DAY"
        }
        response = client.post("/api/predict", json=payload)
        assert response.status_code == 422
    
    def test_negative_distance(self):
        """Test negative distance returns 422"""
        payload = {
            "distance_km": -5.0,
            "time_of_day": "RUSH_HOUR",
            "day_type": "WEEKDAY"
        }
        response = client.post("/api/predict", json=payload)
        assert response.status_code == 422
    
    def test_zero_distance(self):
        """Test zero distance returns 422"""
        payload = {
            "distance_km": 0.0,
            "time_of_day": "RUSH_HOUR",
            "day_type": "WEEKDAY"
        }
        response = client.post("/api/predict", json=payload)
        assert response.status_code == 422
    
    def test_distance_exceeds_max(self):
        """Test distance exceeding max returns 422"""
        payload = {
            "distance_km": 150.0,
            "time_of_day": "RUSH_HOUR",
            "day_type": "WEEKDAY"
        }
        response = client.post("/api/predict", json=payload)
        assert response.status_code == 422


class TestStatsEndpoint:
    """Test stats endpoint"""
    
    def test_stats_returns_200(self):
        """Test stats endpoint returns 200"""
        response = client.get("/api/stats")
        assert response.status_code == 200
    
    def test_stats_response_structure(self):
        """Test stats response has correct structure"""
        response = client.get("/api/stats")
        data = response.json()
        
        assert "service" in data
        assert "version" in data
        assert "status" in data
        assert "model_loaded" in data
        assert "model_path" in data


class TestRootEndpoint:
    """Test root endpoint"""
    
    def test_root_returns_200(self):
        """Test root endpoint returns 200"""
        response = client.get("/")
        assert response.status_code == 200
    
    def test_root_response_structure(self):
        """Test root response has correct structure"""
        response = client.get("/")
        data = response.json()
        
        assert "service" in data
        assert "version" in data
        assert "docs" in data
        assert "redoc" in data


class TestOpenAPI:
    """Test OpenAPI documentation"""
    
    def test_docs_endpoint_accessible(self):
        """Test Swagger UI docs endpoint is accessible"""
        response = client.get("/docs")
        assert response.status_code == 200
    
    def test_redoc_endpoint_accessible(self):
        """Test ReDoc endpoint is accessible"""
        response = client.get("/redoc")
        assert response.status_code == 200
    
    def test_openapi_schema_accessible(self):
        """Test OpenAPI schema is accessible"""
        response = client.get("/openapi.json")
        assert response.status_code == 200
        schema = response.json()
        assert "paths" in schema
        assert "/api/predict" in schema["paths"]
        assert "/api/health" in schema["paths"]
