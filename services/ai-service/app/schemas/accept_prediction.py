"""Accept probability prediction request/response schemas"""

from typing import List, Optional
from pydantic import BaseModel, Field


class AcceptPredictionDriverInput(BaseModel):
    """Per-driver input features for accept probability prediction"""

    driver_id: str = Field(..., description="Unique driver identifier for result mapping")

    eta_minutes: float = Field(
        ...,
        ge=0,
        le=120,
        description="Estimated driver arrival time in minutes",
    )
    driver_accept_rate: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Driver's historical acceptance rate this week (0–1)",
    )
    driver_cancel_rate: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Driver's historical cancellation rate this week (0–1)",
    )


class AcceptPredictionContext(BaseModel):
    """Ride-level context shared across all drivers in a batch"""

    distance_km: float = Field(
        ...,
        ge=0.1,
        le=100,
        description="Ride distance in kilometers",
    )
    fare_estimate: float = Field(
        ...,
        ge=0,
        description="Estimated fare in VND",
    )
    surge_multiplier: float = Field(
        default=1.0,
        ge=1.0,
        le=3.0,
        description="Current surge pricing multiplier",
    )
    hour_of_day: int = Field(
        ...,
        ge=0,
        le=23,
        description="Current hour of day (0–23)",
    )
    pickup_zone: str = Field(
        default="D",
        description="Pickup zone: A (central), B (inner), C (outer), D (suburban)",
    )
    demand_level: str = Field(
        default="MEDIUM",
        description="Current demand level: LOW, MEDIUM, HIGH",
    )
    available_driver_count: int = Field(
        ...,
        ge=0,
        description="Number of available drivers within search radius",
    )


class AcceptPredictionBatchRequest(BaseModel):
    """Batch request for accept probability — one context, multiple drivers"""

    context: AcceptPredictionContext
    drivers: List[AcceptPredictionDriverInput] = Field(
        ...,
        min_length=1,
        max_length=20,
        description="List of driver inputs (max 20 per batch)",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "context": {
                        "distance_km": 7.5,
                        "fare_estimate": 85000,
                        "surge_multiplier": 1.3,
                        "hour_of_day": 8,
                        "pickup_zone": "A",
                        "demand_level": "HIGH",
                        "available_driver_count": 4,
                    },
                    "drivers": [
                        {
                            "driver_id": "drv-001",
                            "eta_minutes": 3,
                            "driver_accept_rate": 0.92,
                            "driver_cancel_rate": 0.03,
                        },
                        {
                            "driver_id": "drv-002",
                            "eta_minutes": 9,
                            "driver_accept_rate": 0.61,
                            "driver_cancel_rate": 0.18,
                        },
                    ],
                }
            ]
        }
    }


class AcceptPredictionDriverResult(BaseModel):
    """Per-driver accept probability result"""

    driver_id: str
    p_accept: float = Field(..., ge=0.0, le=1.0, description="Raw predicted acceptance probability")
    p_accept_clamped: float = Field(..., ge=0.3, le=1.2, description="Clamped multiplier [0.3, 1.2]")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model confidence for this prediction")


class AcceptPredictionBatchResponse(BaseModel):
    """Batch response with per-driver accept probabilities"""

    results: List[AcceptPredictionDriverResult]
    model_version: str
    reason_code: str = Field(
        default="AI_OK",
        description="AI_OK | AI_FALLBACK (model not loaded, returned defaults)",
    )
    inference_ms: int = Field(..., ge=0, description="Total batch inference latency in ms")
