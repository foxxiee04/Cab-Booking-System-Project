"""Prediction API endpoints"""

from fastapi import APIRouter, HTTPException
from app.schemas.prediction import (
    PredictionRequest,
    PredictionResponse,
    HealthResponse,
)
from app.schemas.accept_prediction import (
    AcceptPredictionBatchRequest,
    AcceptPredictionBatchResponse,
)
from app.schemas.wait_prediction import (
    WaitTimePredictionRequest,
    WaitTimePredictionResponse,
)
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.prediction_service import prediction_service
from app.services.accept_service import accept_service
from app.services.wait_service import wait_service
from app.services.rag_service import rag_service
from app.core.config import settings

router = APIRouter(prefix="/api", tags=["predictions"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint
    
    Returns:
        HealthResponse with service status
    """
    return HealthResponse(
        status="healthy",
        service="ai-service",
        version=settings.APP_VERSION
    )


@router.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """
    Predict ETA and price multiplier
    
    Args:
        request: PredictionRequest with:
            - distance_km: float (distance in kilometers)
            - time_of_day: str (OFF_PEAK or RUSH_HOUR)
            - day_type: str (WEEKDAY or WEEKEND)
    
    Returns:
        PredictionResponse with:
            - eta_minutes: int (estimated time of arrival in minutes)
            - price_multiplier: float (surge pricing factor)
    
    Raises:
        HTTPException: If prediction fails
    """
    try:
        # Make prediction
        predictions = prediction_service.predict(request)
        
        # Build response
        response = PredictionResponse(
            eta_minutes=predictions['eta_minutes'],
            price_multiplier=predictions['price_multiplier'],
            recommended_driver_radius_km=predictions['recommended_driver_radius_km'],
            surge_hint=predictions['surge_hint'],
            confidence_score=predictions['confidence_score'],
            reason_code=predictions['reason_code'],
            model_version=predictions['model_version'],
            feature_version=predictions['feature_version'],
            inference_ms=predictions['inference_ms'],
            distance_km=request.distance_km,
            time_of_day=request.time_of_day.value,
            day_type=request.day_type.value,
            insights=predictions['insights'],
        )
        
        return response
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction error: {str(e)}"
        )


@router.post("/predict/accept/batch", response_model=AcceptPredictionBatchResponse)
async def predict_accept_batch(request: AcceptPredictionBatchRequest):
    """
    Batch accept probability prediction.

    Returns per-driver P(accept) predictions and a clamped multiplier [0.3, 1.2]
    that can be applied directly to dispatch scores.

    Falls back to p_accept_clamped=1.0 (neutral) if the model is not loaded.
    """
    try:
        return accept_service.predict_batch(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Accept prediction error: {exc}")


@router.post("/predict/wait-time", response_model=WaitTimePredictionResponse)
async def predict_wait_time(request: WaitTimePredictionRequest):
    """
    Predict customer wait time (minutes from booking → driver acceptance).

    Returns wait_time_minutes ∈ [1, 15] with confidence score.
    Falls back to heuristic if model is unavailable.
    """
    try:
        return wait_service.predict(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Wait-time prediction error: {exc}")


@router.get("/stats")
async def get_stats():
    """
    Get AI service statistics.

    Returns:
        Dictionary with service statistics
    """
    return {
        "service": "ai-service",
        "version": settings.APP_VERSION,
        "status": "running",
        "model_loaded": prediction_service.model is not None,
        "accept_model_loaded": accept_service.is_ready,
        "wait_model_loaded": wait_service.model is not None,
        "rag_ready": rag_service.is_ready,
        "model_path": settings.MODEL_PATH,
        "accept_model_path": settings.ACCEPT_MODEL_PATH,
        "wait_model_path": settings.WAIT_MODEL_PATH,
    }


@router.post("/chat", response_model=ChatResponse, tags=["rag"])
async def chat(request: ChatRequest):
    """
    RAG-powered customer support chatbot.

    Uses sentence-transformer embeddings + FAISS retrieval over a Vietnamese
    knowledge base, with optional LLM generation (Groq / OpenAI).

    - Set RAG_LLM_PROVIDER=groq and GROQ_API_KEY for LLM-backed answers.
    - Set RAG_LLM_PROVIDER=openai and OPENAI_API_KEY for OpenAI.
    - Default (RAG_LLM_PROVIDER=none): pure retrieval-based answers.
    """
    try:
        result = await rag_service.chat(
            message=request.message,
            history=[m.model_dump() for m in request.history] if request.history else None,
            top_k=request.top_k,
        )
        return ChatResponse(**result)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Chat error: {exc}")


@router.get("/chat/status", tags=["rag"])
async def chat_status():
    """Return RAG service status and knowledge base statistics."""
    return {
        "ready": rag_service.is_ready,
        "embedding_model": rag_service._model.__class__.__name__ if rag_service._model else None,
        "chunks_indexed": len(rag_service._chunks),
        "llm_provider": __import__("os").getenv("RAG_LLM_PROVIDER", "none"),
    }
