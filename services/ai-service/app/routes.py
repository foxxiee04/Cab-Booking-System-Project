from fastapi import APIRouter, HTTPException
from app.models import (
    RideEstimateRequest, RideEstimateResponse,
    DriverMatchRequest, DriverMatchResponse,
    SurgePricingRequest, SurgePricingResponse
)
from app.services.ai_service import ai_service

router = APIRouter(prefix="/api", tags=["AI"])

@router.post("/ride/estimate", response_model=RideEstimateResponse)
async def estimate_ride(request: RideEstimateRequest):
    """
    Estimate ride distance, duration, and fare.
    """
    try:
        return await ai_service.estimate_ride(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/match/drivers", response_model=DriverMatchResponse)
async def match_drivers(request: DriverMatchRequest):
    """
    Find and rank best matching drivers for a ride request.
    """
    try:
        return await ai_service.match_drivers(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/surge/pricing", response_model=SurgePricingResponse)
async def get_surge_pricing(request: SurgePricingRequest):
    """
    Get surge pricing information for a location.
    """
    try:
        return await ai_service.get_surge_pricing(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health_check():
    """
    Health check endpoint.
    """
    return {"status": "healthy", "service": "ai-service"}
