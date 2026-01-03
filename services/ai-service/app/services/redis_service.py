import redis.asyncio as redis
from typing import List, Tuple, Optional
from app.config import config

class RedisClient:
    def __init__(self):
        self.client: Optional[redis.Redis] = None
    
    async def connect(self):
        self.client = redis.from_url(config.REDIS_URL, decode_responses=True)
    
    async def close(self):
        if self.client:
            await self.client.close()
    
    async def get_nearby_drivers(
        self, 
        lat: float, 
        lng: float, 
        radius_km: float = 5.0
    ) -> List[Tuple[str, float]]:
        """
        Get nearby available drivers from Redis GEO.
        Returns list of (driver_id, distance_km)
        """
        if not self.client:
            return []
        
        try:
            results = await self.client.georadius(
                "drivers:locations",
                lng, lat,
                radius_km, unit="km",
                withdist=True,
                sort="ASC"
            )
            return [(driver_id, float(dist)) for driver_id, dist in results]
        except Exception:
            return []
    
    async def get_active_rides_count(
        self, 
        lat: float, 
        lng: float, 
        radius_km: float = 3.0
    ) -> int:
        """
        Get count of active rides in an area (for surge pricing).
        """
        if not self.client:
            return 0
        
        try:
            # In production, use a separate GEO index for active rides
            count = await self.client.get(f"stats:active_rides:{int(lat*10)}:{int(lng*10)}")
            return int(count) if count else 0
        except Exception:
            return 0
    
    async def get_available_drivers_count(
        self, 
        lat: float, 
        lng: float, 
        radius_km: float = 3.0
    ) -> int:
        """
        Get count of available drivers in an area.
        """
        drivers = await self.get_nearby_drivers(lat, lng, radius_km)
        return len(drivers)

redis_client = RedisClient()
