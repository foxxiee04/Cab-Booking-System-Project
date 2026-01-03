import math
from typing import Tuple

def haversine_distance(
    lat1: float, lon1: float, 
    lat2: float, lon2: float
) -> float:
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees).
    Returns distance in kilometers.
    """
    # Convert to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    # Earth's radius in kilometers
    r = 6371
    
    return c * r

def estimate_duration(distance_km: float, traffic_factor: float = 1.0) -> int:
    """
    Estimate travel duration in minutes based on distance.
    Assumes average speed of 30 km/h in city traffic.
    """
    avg_speed_kmh = 30 / traffic_factor
    duration_hours = distance_km / avg_speed_kmh
    return max(1, int(duration_hours * 60))

def calculate_fare(
    distance_km: float,
    duration_minutes: int,
    surge_multiplier: float = 1.0,
    base_fare: int = 15000,
    per_km_rate: int = 12000,
    per_minute_rate: int = 2000
) -> Tuple[int, dict]:
    """
    Calculate fare based on distance and duration.
    Returns (total_fare, breakdown_dict)
    """
    distance_fare = int(distance_km * per_km_rate)
    time_fare = int(duration_minutes * per_minute_rate)
    subtotal = base_fare + distance_fare + time_fare
    total = int(subtotal * surge_multiplier)
    
    return total, {
        "base_fare": base_fare,
        "distance_fare": distance_fare,
        "time_fare": time_fare,
        "subtotal": subtotal,
        "surge_multiplier": surge_multiplier,
        "total": total
    }
