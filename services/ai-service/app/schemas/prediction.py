"""Prediction request/response schemas"""

from enum import Enum
from pydantic import BaseModel, Field


class TimeOfDayEnum(str, Enum):
    """Time of day categories"""
    OFF_PEAK = "OFF_PEAK"
    RUSH_HOUR = "RUSH_HOUR"


class DayTypeEnum(str, Enum):
    """Day type categories"""
    WEEKDAY = "WEEKDAY"
    WEEKEND = "WEEKEND"


class DemandLevelEnum(str, Enum):
    """Demand classification inferred from prediction context"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class ConfidenceLevelEnum(str, Enum):
    """Prediction confidence bucket"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class ReasonCodeEnum(str, Enum):
    """Reason code for prediction outcome and fallback awareness"""
    AI_OK = "AI_OK"
    AI_TIMEOUT = "AI_TIMEOUT"
    AI_HTTP_ERROR = "AI_HTTP_ERROR"
    AI_INVALID_RESPONSE = "AI_INVALID_RESPONSE"
    AI_LOW_CONFIDENCE = "AI_LOW_CONFIDENCE"
    AI_DISABLED_BY_FLAG = "AI_DISABLED_BY_FLAG"


class PredictionRequest(BaseModel):
    """Request schema for prediction endpoint"""
    
    distance_km: float = Field(
        ...,
        gt=0,
        le=100,
        description="Distance in kilometers (0 < distance <= 100)"
    )
    time_of_day: TimeOfDayEnum = Field(
        ...,
        description="Time of day: OFF_PEAK or RUSH_HOUR"
    )
    day_type: DayTypeEnum = Field(
        ...,
        description="Day type: WEEKDAY or WEEKEND"
    )
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "distance_km": 8.5,
                    "time_of_day": "RUSH_HOUR",
                    "day_type": "WEEKDAY"
                },
                {
                    "distance_km": 15.2,
                    "time_of_day": "OFF_PEAK",
                    "day_type": "WEEKEND"
                }
            ]
        }
    }


class PredictionResponse(BaseModel):
    """Response schema for prediction endpoint"""

    class PredictionInsights(BaseModel):
        demand_level: DemandLevelEnum = Field(
            ...,
            description="Predicted demand intensity for operational decisions"
        )
        eta_confidence: ConfidenceLevelEnum = Field(
            ...,
            description="Confidence bucket for ETA prediction"
        )
        recommended_driver_radius_km: float = Field(
            ...,
            ge=1.0,
            le=10.0,
            description="Recommended driver search radius in kilometers"
        )
        surge_reason: str = Field(
            ...,
            description="Human-readable explanation for the predicted surge"
        )
    
    eta_minutes: int = Field(
        ...,
        ge=1,
        le=120,
        description="Estimated time of arrival in minutes"
    )
    price_multiplier: float = Field(
        ...,
        ge=1.0,
        le=2.0,
        description="Price multiplier (surge pricing factor)"
    )
    recommended_driver_radius_km: float = Field(
        ...,
        ge=1.0,
        le=10.0,
        description="AI suggested driver search radius in kilometers"
    )
    surge_hint: float = Field(
        ...,
        ge=1.0,
        le=3.0,
        description="AI suggested surge hint before downstream clamp"
    )
    confidence_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Prediction confidence score in range [0, 1]"
    )
    reason_code: ReasonCodeEnum = Field(
        default=ReasonCodeEnum.AI_OK,
        description="Reason code for the prediction response"
    )
    model_version: str = Field(
        ...,
        description="Model version used for this prediction"
    )
    feature_version: str = Field(
        ...,
        description="Feature schema version used for this prediction"
    )
    inference_ms: int = Field(
        ...,
        ge=0,
        description="Model inference latency in milliseconds"
    )
    distance_km: float = Field(
        ...,
        description="Input distance in kilometers"
    )
    time_of_day: str = Field(
        ...,
        description="Input time of day"
    )
    day_type: str = Field(
        ...,
        description="Input day type"
    )
    insights: PredictionInsights = Field(
        ...,
        description="Operational hints derived from the prediction"
    )
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "eta_minutes": 22,
                    "price_multiplier": 1.08,
                    "recommended_driver_radius_km": 3.5,
                    "surge_hint": 1.08,
                    "confidence_score": 0.83,
                    "reason_code": "AI_OK",
                    "model_version": "eta-rf-v2",
                    "feature_version": "features-v1",
                    "inference_ms": 18,
                    "distance_km": 8.5,
                    "time_of_day": "RUSH_HOUR",
                    "day_type": "WEEKDAY",
                    "insights": {
                        "demand_level": "MEDIUM",
                        "eta_confidence": "HIGH",
                        "recommended_driver_radius_km": 3.5,
                        "surge_reason": "Rush hour demand is increasing ETA and fare pressure"
                    }
                }
            ]
        }
    }


class HealthResponse(BaseModel):
    """Health check response"""
    
    status: str = Field(default="healthy", description="Service status")
    service: str = Field(default="ai-service", description="Service name")
    version: str = Field(..., description="Service version")
