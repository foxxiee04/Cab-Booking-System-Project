"""Prediction API endpoints"""

from fastapi import APIRouter, HTTPException
from app.schemas.prediction import PredictionRequest, PredictionResponse, HealthResponse
from app.services.prediction_service import prediction_service
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
            distance_km=request.distance_km,
            time_of_day=request.time_of_day.value,
            day_type=request.day_type.value
        )
        
        return response
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction error: {str(e)}"
        )


@router.get("/stats")
async def get_stats():
    """
    Get AI service statistics (placeholder for future metrics)
    
    Returns:
        Dictionary with service statistics
    """
    return {
        "service": "ai-service",
        "version": settings.APP_VERSION,
        "status": "running",
        "model_loaded": prediction_service.model is not None,
        "model_path": settings.MODEL_PATH
    }
