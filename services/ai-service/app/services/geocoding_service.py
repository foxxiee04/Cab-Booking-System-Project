import aiohttp
from typing import Optional, List, Dict
from app.config import config
from app.services.redis_service import redis_client

class GeocodingService:
    async def autocomplete(self, query: str, lat: Optional[float] = None, lng: Optional[float] = None, limit: int = 5) -> List[Dict]:
        provider = 'mapbox' if config.MAPBOX_TOKEN else ('google' if config.GOOGLE_API_KEY else 'nominatim')
        cache_key = f"geo:ac:{provider}:{query}:{lat or ''}:{lng or ''}:{limit}"
        # Try cache first
        if redis_client.client:
            cached = await redis_client.client.get(cache_key)
            if cached:
                try:
                    import json
                    return json.loads(cached)
                except Exception:
                    pass
        # Fetch live
        if provider == 'mapbox':
            results = await self._mapbox_forward(query, lat, lng, limit)
        elif provider == 'google':
            results = await self._google_places_autocomplete(query, lat, lng, limit)
        else:
            results = await self._nominatim_search(query, lat, lng, limit)
        # Store cache
        if redis_client.client:
            try:
                import json
                await redis_client.client.set(cache_key, json.dumps(results), ex=600)
            except Exception:
                pass
        return results

    async def reverse(self, lat: float, lng: float) -> Dict:
        provider = 'mapbox' if config.MAPBOX_TOKEN else ('google' if config.GOOGLE_API_KEY else 'nominatim')
        cache_key = f"geo:rev:{provider}:{lat}:{lng}"
        if redis_client.client:
            cached = await redis_client.client.get(cache_key)
            if cached:
                try:
                    import json
                    return json.loads(cached)
                except Exception:
                    pass
        if provider == 'mapbox':
            result = await self._mapbox_reverse(lat, lng)
        elif provider == 'google':
            result = await self._google_reverse(lat, lng)
        else:
            result = await self._nominatim_reverse(lat, lng)
        if redis_client.client:
            try:
                import json
                await redis_client.client.set(cache_key, json.dumps(result), ex=600)
            except Exception:
                pass
        return result

    async def _nominatim_search(self, query: str, lat: Optional[float], lng: Optional[float], limit: int) -> List[Dict]:
        params = {
            "q": query,
            "format": "json",
            "addressdetails": 1,
            "limit": limit,
        }
        headers = {"User-Agent": config.USER_AGENT}
        async with aiohttp.ClientSession(headers=headers) as session:
            async with session.get(f"{config.NOMINATIM_BASE}/search", params=params, timeout=10) as resp:
                data = await resp.json()
                results = []
                for item in data:
                    results.append({
                        "place_id": str(item.get("osm_id") or item.get("place_id")),
                        "name": item.get("display_name"),
                        "lat": float(item.get("lat")),
                        "lng": float(item.get("lon")),
                        "address": item.get("display_name"),
                        "source": "nominatim",
                    })
                return results

    async def _nominatim_reverse(self, lat: float, lng: float) -> Dict:
        params = {
            "lat": lat,
            "lon": lng,
            "format": "json",
            "addressdetails": 1,
        }
        headers = {"User-Agent": config.USER_AGENT}
        async with aiohttp.ClientSession(headers=headers) as session:
            async with session.get(f"{config.NOMINATIM_BASE}/reverse", params=params, timeout=10) as resp:
                item = await resp.json()
                return {
                    "place_id": str(item.get("osm_id") or item.get("place_id")),
                    "name": item.get("display_name"),
                    "lat": float(item.get("lat")),
                    "lng": float(item.get("lon")),
                    "address": item.get("display_name"),
                    "source": "nominatim",
                }

    async def _mapbox_forward(self, query: str, lat: Optional[float], lng: Optional[float], limit: int) -> List[Dict]:
        params = {
            "access_token": config.MAPBOX_TOKEN,
            "limit": limit,
            "autocomplete": True,
            "language": "vi",
        }
        if lat is not None and lng is not None:
            params["proximity"] = f"{lng},{lat}"
        url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, timeout=10) as resp:
                data = await resp.json()
                results = []
                for feat in data.get("features", []):
                    center = feat.get("center", [])
                    results.append({
                        "place_id": feat.get("id"),
                        "name": feat.get("text"),
                        "lat": float(center[1]) if len(center) == 2 else None,
                        "lng": float(center[0]) if len(center) == 2 else None,
                        "address": feat.get("place_name"),
                        "source": "mapbox",
                    })
                return results

    async def _mapbox_reverse(self, lat: float, lng: float) -> Dict:
        params = {
            "access_token": config.MAPBOX_TOKEN,
            "language": "vi",
        }
        url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{lng},{lat}.json"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, timeout=10) as resp:
                data = await resp.json()
                feat = (data.get("features") or [{}])[0]
                return {
                    "place_id": feat.get("id"),
                    "name": feat.get("text"),
                    "lat": lat,
                    "lng": lng,
                    "address": feat.get("place_name"),
                    "source": "mapbox",
                }

    async def _google_places_autocomplete(self, query: str, lat: Optional[float], lng: Optional[float], limit: int) -> List[Dict]:
        # Minimal implementation using Places Text Search + Details if needed
        params = {
            "query": query,
            "key": config.GOOGLE_API_KEY,
            "language": "vi",
        }
        if lat is not None and lng is not None:
            params["location"] = f"{lat},{lng}"
            params["radius"] = 5000
        url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, timeout=10) as resp:
                data = await resp.json()
                results = []
                for item in data.get("results", [])[:limit]:
                    loc = item.get("geometry", {}).get("location", {})
                    results.append({
                        "place_id": item.get("place_id"),
                        "name": item.get("name"),
                        "lat": loc.get("lat"),
                        "lng": loc.get("lng"),
                        "address": item.get("formatted_address"),
                        "source": "google",
                    })
                return results

    async def _google_reverse(self, lat: float, lng: float) -> Dict:
        params = {
            "latlng": f"{lat},{lng}",
            "key": config.GOOGLE_API_KEY,
            "language": "vi",
        }
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, timeout=10) as resp:
                data = await resp.json()
                item = (data.get("results") or [{}])[0]
                return {
                    "place_id": item.get("place_id"),
                    "name": item.get("address_components", [{}])[0].get("long_name"),
                    "lat": lat,
                    "lng": lng,
                    "address": item.get("formatted_address"),
                    "source": "google",
                }

geocoding_service = GeocodingService()
