"""Wait time prediction request/response schemas"""

from pydantic import BaseModel, Field


class WaitTimePredictionRequest(BaseModel):
    """Request schema for wait-time prediction endpoint"""

    demand_level: str = Field(
        default="MEDIUM",
        description="Current demand level: LOW, MEDIUM, HIGH",
    )
    active_booking_count: int = Field(
        default=0,
        ge=0,
        description="Number of in-flight bookings in the area",
    )
    available_driver_count: int = Field(
        default=5,
        ge=0,
        description="Available drivers within pickup radius",
    )
    hour_of_day: int = Field(
        ...,
        ge=0,
        le=23,
        description="Current hour of day (0–23)",
    )
    day_of_week: int = Field(
        ...,
        ge=0,
        le=6,
        description="Day of week (0=Monday … 6=Sunday)",
    )
    surge_multiplier: float = Field(
        default=1.0,
        ge=1.0,
        le=3.0,
        description="Current surge pricing multiplier",
    )
    avg_accept_rate: float = Field(
        default=0.75,
        ge=0.0,
        le=1.0,
        description="Average acceptance rate of nearby drivers (0–1)",
    )
    historical_wait_p50: float = Field(
        default=4.0,
        ge=1.0,
        le=15.0,
        description="Historical p50 wait time for this zone+hour bucket (minutes)",
    )
    pickup_zone: str = Field(
        default="D",
        description="Pickup zone: A (central), B (inner), C (outer), D (suburban)",
    )


class WaitTimePredictionResponse(BaseModel):
    """Response schema for wait-time prediction endpoint"""

    wait_time_minutes: float = Field(
        ...,
        ge=1.0,
        le=15.0,
        description="Predicted customer wait time in minutes [1, 15]",
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Prediction confidence score [0, 1]",
    )
    model_version: str = Field(
        ...,
        description="Model version used",
    )
    reason_code: str = Field(
        default="AI_OK",
        description="Outcome code: AI_OK | AI_FALLBACK | AI_MODEL_ERROR",
    )
    inference_ms: int = Field(
        ...,
        ge=0,
        description="Inference latency in milliseconds",
    )
