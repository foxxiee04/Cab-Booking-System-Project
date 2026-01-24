from fastapi import APIRouter, HTTPException
from app.models import (
    RideEstimateRequest, RideEstimateResponse,
    DriverMatchRequest, DriverMatchResponse,
    SurgePricingRequest, SurgePricingResponse,
    FindDriversRequest, FindDriversResponse
)
from app.services.ai_service import ai_service
from app.services.geocoding_service import geocoding_service

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

@router.post("/ride/find-drivers", response_model=FindDriversResponse)
async def find_drivers(request: FindDriversRequest):
    """
    Find available drivers near pickup location based on vehicle type.
    Returns suggested drivers sorted by distance and rating.
    """
    try:
        return await ai_service.find_drivers(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health_check():
    """
    Health check endpoint.
    """
    return {"status": "healthy", "service": "ai-service"}

# Geocoding / Place search
@router.get("/geo/autocomplete")
async def geo_autocomplete(q: str, lat: float | None = None, lng: float | None = None, limit: int = 5):
    try:
        results = await geocoding_service.autocomplete(q, lat, lng, limit)
        return {"success": True, "data": {"results": results}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/geo/reverse")
async def geo_reverse(lat: float, lng: float):
    try:
        result = await geocoding_service.reverse(lat, lng)
        return {"success": True, "data": {"result": result}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
