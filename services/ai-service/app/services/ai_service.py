from typing import List
from app.models import (
    RideEstimateRequest, RideEstimateResponse,
    DriverMatchRequest, DriverMatchResponse, DriverInfo,
    SurgePricingRequest, SurgePricingResponse,
    FindDriversRequest, FindDriversResponse, DriverSuggestion
)
from app.utils.geo import haversine_distance, estimate_duration, calculate_fare
from app.services.redis_service import redis_client
from app.config import config

class AIService:
    
    async def estimate_ride(self, request: RideEstimateRequest) -> RideEstimateResponse:
        """
        Estimate ride distance, duration, and fare.
        """
        # Calculate distance
        distance_km = haversine_distance(
            request.pickup.lat, request.pickup.lng,
            request.destination.lat, request.destination.lng
        )
        
        # Estimate duration (with traffic factor)
        traffic_factor = await self._get_traffic_factor(request.pickup.lat, request.pickup.lng)
        duration_minutes = estimate_duration(distance_km, traffic_factor)
        
        # Get surge multiplier
        surge = await self._calculate_surge(request.pickup.lat, request.pickup.lng)
        
        # Calculate fare
        total_fare, breakdown = calculate_fare(
            distance_km, 
            duration_minutes, 
            surge
        )
        
        return RideEstimateResponse(
            distance_km=round(distance_km, 2),
            duration_minutes=duration_minutes,
            estimated_fare=total_fare,
            surge_multiplier=surge,
            fare_breakdown=breakdown
        )
    
    async def match_drivers(self, request: DriverMatchRequest) -> DriverMatchResponse:
        """
        Find and rank best matching drivers for a ride.
        """
        # Get nearby drivers from Redis
        nearby_drivers = await redis_client.get_nearby_drivers(
            request.pickup.lat,
            request.pickup.lng,
            request.max_distance_km
        )
        
        # Score and rank drivers
        matched_drivers: List[DriverInfo] = []
        
        for driver_id, distance_km in nearby_drivers[:10]:  # Top 10
            eta_minutes = estimate_duration(distance_km)
            
            # Calculate matching score (lower is better)
            # In production, include rating, acceptance rate, etc.
            score = self._calculate_driver_score(distance_km, eta_minutes)
            
            matched_drivers.append(DriverInfo(
                driver_id=driver_id,
                distance_km=round(distance_km, 2),
                eta_minutes=eta_minutes,
                score=round(score, 3)
            ))
        
        # Sort by score (higher is better)
        matched_drivers.sort(key=lambda d: d.score, reverse=True)
        
        return DriverMatchResponse(
            ride_id=request.ride_id,
            matched_drivers=matched_drivers[:5],  # Return top 5
            total_available=len(nearby_drivers)
        )
    
    async def get_surge_pricing(self, request: SurgePricingRequest) -> SurgePricingResponse:
        """
        Calculate surge pricing for an area.
        """
        lat, lng = request.location.lat, request.location.lng
        radius = request.radius_km
        
        # Get demand/supply metrics
        active_rides = await redis_client.get_active_rides_count(lat, lng, radius)
        available_drivers = await redis_client.get_available_drivers_count(lat, lng, radius)
        
        # Calculate surge
        surge = await self._calculate_surge(lat, lng)
        demand_level = self._get_demand_level(surge)
        
        return SurgePricingResponse(
            surge_multiplier=surge,
            demand_level=demand_level,
            active_rides=active_rides,
            available_drivers=available_drivers
        )
    
    async def find_drivers(self, request: FindDriversRequest) -> FindDriversResponse:
        """
        Find available drivers near pickup location based on vehicle type.
        Returns suggested drivers sorted by distance and rating.
        """
        lat, lng = request.pickup.lat, request.pickup.lng
        search_radius = request.search_radius_km
        vehicle_type = request.vehicle_type.upper()
        
        # Get nearby drivers from Redis
        # In production, filter by vehicle type and status (ONLINE)
        nearby_drivers = await redis_client.get_nearby_drivers(lat, lng, search_radius)
        
        # Mock driver data - in production, fetch from driver-service
        suggested_drivers: List[DriverSuggestion] = []
        
        for driver_id, distance_km in nearby_drivers[:10]:  # Top 10 closest
            eta_minutes = estimate_duration(distance_km)
            
            # Mock rating and acceptance rate (in production: fetch from database)
            rating = 4.0 + (hash(driver_id) % 10) / 10  # 4.0-4.9
            acceptance_rate = 0.75 + (hash(driver_id) % 20) / 100  # 0.75-0.94
            
            suggested_drivers.append(DriverSuggestion(
                driver_id=driver_id,
                distance_km=round(distance_km, 2),
                eta_minutes=eta_minutes,
                rating=round(rating, 1),
                acceptance_rate=round(acceptance_rate, 2)
            ))
        
        # Sort by distance first, then by rating
        suggested_drivers.sort(key=lambda d: (d.distance_km, -d.rating))
        
        return FindDriversResponse(
            suggested_drivers=suggested_drivers[:5],  # Return top 5
            total_found=len(nearby_drivers)
        )
    
    async def _calculate_surge(self, lat: float, lng: float) -> float:
        """
        Calculate surge multiplier based on supply/demand.
        """
        active_rides = await redis_client.get_active_rides_count(lat, lng)
        available_drivers = await redis_client.get_available_drivers_count(lat, lng)
        
        # Default to normal surge when no data available
        if available_drivers == 0 and active_rides == 0:
            return 1.0
        
        if available_drivers == 0:
            return config.MAX_SURGE_MULTIPLIER
        
        # Demand ratio
        ratio = active_rides / max(available_drivers, 1)
        
        if ratio <= config.SURGE_THRESHOLD:
            return 1.0
        
        # Linear surge increase
        surge = 1.0 + (ratio - config.SURGE_THRESHOLD) * 0.5
        return min(surge, config.MAX_SURGE_MULTIPLIER)
    
    async def _get_traffic_factor(self, lat: float, lng: float) -> float:
        """
        Get traffic factor for an area.
        In production, integrate with traffic APIs.
        """
        # Mock: Return based on time of day
        from datetime import datetime
        hour = datetime.now().hour
        
        # Rush hours
        if 7 <= hour <= 9 or 17 <= hour <= 19:
            return 1.5
        # Night
        elif 22 <= hour or hour <= 5:
            return 0.8
        # Normal
        return 1.0
    
    def _calculate_driver_score(
        self, 
        distance_km: float, 
        eta_minutes: int,
        rating: float = 4.5,
        acceptance_rate: float = 0.85
    ) -> float:
        """
        Calculate driver matching score.
        Higher score = better match.
        """
        # Weights
        distance_weight = 0.4
        rating_weight = 0.3
        acceptance_weight = 0.3
        
        # Normalize distance (closer is better)
        distance_score = max(0, 1 - (distance_km / 10))
        
        # Normalize rating (0-5 scale)
        rating_score = rating / 5
        
        # Combined score
        score = (
            distance_score * distance_weight +
            rating_score * rating_weight +
            acceptance_rate * acceptance_weight
        )
        
        return score
    
    def _get_demand_level(self, surge: float) -> str:
        """
        Convert surge multiplier to demand level string.
        """
        if surge <= 1.0:
            return "normal"
        elif surge <= 1.5:
            return "moderate"
        elif surge <= 2.0:
            return "high"
        else:
            return "very_high"

ai_service = AIService()
