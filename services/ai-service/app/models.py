from pydantic import BaseModel
from typing import Optional, List

class Location(BaseModel):
    lat: float
    lng: float

class RideEstimateRequest(BaseModel):
    pickup: Location
    destination: Location
    vehicle_type: Optional[str] = "standard"

class RideEstimateResponse(BaseModel):
    distance_km: float
    duration_minutes: int
    estimated_fare: int
    surge_multiplier: float
    fare_breakdown: dict

class DriverMatchRequest(BaseModel):
    ride_id: str
    pickup: Location
    vehicle_type: Optional[str] = "standard"
    max_distance_km: Optional[float] = 5.0

class DriverInfo(BaseModel):
    driver_id: str
    distance_km: float
    eta_minutes: int
    rating: Optional[float] = None
    score: float

class DriverMatchResponse(BaseModel):
    ride_id: str
    matched_drivers: List[DriverInfo]
    total_available: int

class SurgePricingRequest(BaseModel):
    location: Location
    radius_km: Optional[float] = 3.0

class SurgePricingResponse(BaseModel):
    surge_multiplier: float
    demand_level: str
    active_rides: int
    available_drivers: int
