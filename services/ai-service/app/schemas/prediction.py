"""Prediction request/response schemas"""

from enum import Enum
from typing import Optional
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


class RagHealthInfo(BaseModel):
    """RAG / LLM configuration snapshot (no secret values)."""

    ready: bool = Field(description="RAG embedder and index finished initializing")
    chunks: int = Field(description="Knowledge chunks loaded into the index")
    vector_index: bool = Field(description="Hybrid vector index is available")
    init_error: Optional[str] = Field(default=None, description="Last RAG init error when not ready")
    llm_provider: str = Field(description="Backward-compatible alias for RAG_LLM_PROVIDER")
    llm_provider_configured: str = Field(description="Raw RAG_LLM_PROVIDER value")
    llm_provider_order: list[str] = Field(default_factory=list, description="Answer providers with configured keys, in fallback order")
    effective_llm_provider: str = Field(description="Provider the next LLM answer will try first, or template")
    effective_llm_model: Optional[str] = Field(default=None, description="Model for effective_llm_provider")
    llm_models: dict[str, Optional[str]] = Field(default_factory=dict, description="Configured model IDs by provider")
    anthropic_key_configured: bool = Field(default=False, description="ANTHROPIC_API_KEY is non-empty")
    openai_key_configured: bool = Field(default=False, description="OPENAI_API_KEY is non-empty")
    groq_key_configured: bool = Field(default=False, description="GROQ_API_KEY is non-empty")
    gemini_key_configured: bool = Field(default=False, description="GEMINI_API_KEY is non-empty")
    query_rewrite_enabled: bool = Field(default=False, description="Whether LLM query rewriting is enabled")
    query_rewrite_provider_configured: str = Field(default="auto", description="Raw RAG_QUERY_REWRITE_PROVIDER value")
    query_rewrite_provider_order: list[str] = Field(default_factory=list, description="Rewrite providers with configured keys")
    effective_query_rewrite_provider: Optional[str] = Field(default=None, description="Provider used first for rewrite")
    effective_query_rewrite_model: Optional[str] = Field(default=None, description="Model used first for rewrite")
    reranker_enabled: bool = Field(default=False, description="RAG_RERANKER_ENABLED flag")
    reranker_active: bool = Field(default=False, description="Cross-encoder reranker loaded and used by chat")
    reranker_load_attempted: bool = Field(default=False, description="Whether lazy reranker load already ran")
    reranker_model: Optional[str] = Field(default=None, description="Configured reranker model")
    embedding_model: Optional[str] = Field(default=None, description="Configured embedding model name")
    top_k_default: int = Field(default=8, description="Default number of context chunks returned")
    rerank_pool: int = Field(default=20, description="Hybrid candidates passed into reranker")
    min_faiss_prefilter: float = Field(default=0.16, description="Minimum cosine for semantic prefilter")
    cosine_absent: float = Field(default=0.22, description="Below this, answer refuses/no_context")
    cosine_llm: float = Field(default=0.30, description="At/above this, LLM synthesis is allowed")


class HealthResponse(BaseModel):
    """Health check response"""
    
    status: str = Field(default="healthy", description="Service status")
    service: str = Field(default="ai-service", description="Service name")
    version: str = Field(..., description="Service version")
    rag: RagHealthInfo = Field(description="RAG readiness and LLM key presence flags")
