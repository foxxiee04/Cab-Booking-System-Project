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
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "eta_minutes": 22,
                    "price_multiplier": 1.08,
                    "distance_km": 8.5,
                    "time_of_day": "RUSH_HOUR",
                    "day_type": "WEEKDAY"
                }
            ]
        }
    }


class HealthResponse(BaseModel):
    """Health check response"""
    
    status: str = Field(default="healthy", description="Service status")
    service: str = Field(default="ai-service", description="Service name")
    version: str = Field(..., description="Service version")
