import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.ai_service import AIService
from app.models import RideEstimateRequest, DriverMatchRequest, Location

@pytest.fixture
def ai_service():
    return AIService()

@pytest.fixture
def sample_ride_request():
    return RideEstimateRequest(
        pickup=Location(lat=10.7764, lng=106.7008),
        destination=Location(lat=10.7809, lng=106.6956)
    )

@pytest.fixture
def sample_driver_match_request():
    return DriverMatchRequest(
        ride_id="ride-123",
        pickup=Location(lat=10.7764, lng=106.7008),
        max_distance_km=5.0
    )

class TestAIService:
    
    @pytest.mark.asyncio
    @patch('app.services.ai_service.redis_client')
    @patch('app.utils.geo.haversine_distance', return_value=5.5)
    @patch('app.utils.geo.estimate_duration', return_value=15)
    @patch('app.utils.geo.calculate_fare', return_value=(50000, {}))
    async def test_estimate_ride(self, mock_fare, mock_duration, mock_distance, mock_redis, ai_service, sample_ride_request):
        """Test ride estimation"""
        mock_redis.get_traffic_factor = AsyncMock(return_value=1.0)
        mock_redis.get_surge_multiplier = AsyncMock(return_value=1.0)
        
        result = await ai_service.estimate_ride(sample_ride_request)
        
        assert result.distance_km == 5.5
        assert result.duration_minutes == 15
        assert result.estimated_fare == 50000
        assert result.surge_multiplier >= 1.0
    
    @pytest.mark.asyncio
    @patch('app.services.ai_service.redis_client')
    @patch('app.utils.geo.estimate_duration', return_value=10)
    async def test_match_drivers(self, mock_duration, mock_redis, ai_service, sample_driver_match_request):
        """Test driver matching"""
        mock_redis.get_nearby_drivers = AsyncMock(return_value=[
            ('driver-1', 1.5),
            ('driver-2', 2.3),
            ('driver-3', 3.1),
        ])
        
        result = await ai_service.match_drivers(sample_driver_match_request)
        
        assert len(result.matched_drivers) <= 5
        assert result.total_available == 3
        assert result.ride_id == "ride-123"
        
        # Verify sorted by score
        if len(result.matched_drivers) > 1:
            assert result.matched_drivers[0].score >= result.matched_drivers[1].score
    
    @pytest.mark.asyncio
    @patch('app.services.ai_service.redis_client')
    async def test_get_surge_pricing(self, mock_redis, ai_service):
        """Test surge pricing calculation"""
        from app.models import SurgePricingRequest
        
        request = SurgePricingRequest(
            location=Location(lat=10.7764, lng=106.7008),
            radius_km=5.0
        )
        
        mock_redis.get_active_rides_count = AsyncMock(return_value=50)
        mock_redis.get_available_drivers_count = AsyncMock(return_value=30)
        mock_redis.get_surge_multiplier = AsyncMock(return_value=1.5)
        
        result = await ai_service.get_surge_pricing(request)
        
        assert result.surge_multiplier >= 1.0
        assert result.demand_level in ['low', 'medium', 'high', 'peak']
    
    @pytest.mark.asyncio
    async def test_calculate_driver_score(self, ai_service):
        """Test driver scoring logic"""
        # Close driver should have better score
        score_close = ai_service._calculate_driver_score(1.0, 5)
        score_far = ai_service._calculate_driver_score(5.0, 15)
        
        assert score_close > score_far
    
    @pytest.mark.asyncio
    @patch('app.services.ai_service.redis_client')
    async def test_estimate_ride_with_high_traffic(self, mock_redis, ai_service, sample_ride_request):
        """Test ride estimation with high traffic"""
        mock_redis.get_traffic_factor = AsyncMock(return_value=1.5)
        mock_redis.get_surge_multiplier = AsyncMock(return_value=1.2)
        
        with patch('app.utils.geo.haversine_distance', return_value=5.5):
            with patch('app.utils.geo.estimate_duration', return_value=22):
                with patch('app.utils.geo.calculate_fare', return_value=(60000, {})):
                    result = await ai_service.estimate_ride(sample_ride_request)
        
        assert result.duration_minutes >= 15  # Should be higher with traffic
        assert result.surge_multiplier >= 1.0
    
    @pytest.mark.asyncio
    @patch('app.services.ai_service.redis_client')
    async def test_match_drivers_no_drivers_available(self, mock_redis, ai_service, sample_driver_match_request):
        """Test driver matching when no drivers available"""
        mock_redis.get_nearby_drivers = AsyncMock(return_value=[])
        
        result = await ai_service.match_drivers(sample_driver_match_request)
        
        assert len(result.matched_drivers) == 0
        assert result.total_available == 0
    
    @pytest.mark.asyncio
    @patch('app.services.ai_service.redis_client')
    async def test_surge_pricing_low_demand(self, mock_redis, ai_service):
        """Test surge pricing with low demand"""
        from app.models import SurgePricingRequest
        
        request = SurgePricingRequest(
            location=Location(lat=10.7764, lng=106.7008),
            radius_km=5.0
        )
        
        mock_redis.get_active_rides_count = AsyncMock(return_value=10)
        mock_redis.get_available_drivers_count = AsyncMock(return_value=50)
        mock_redis.get_surge_multiplier = AsyncMock(return_value=1.0)
        
        result = await ai_service.get_surge_pricing(request)
        
        assert result.surge_multiplier == 1.0
        assert result.demand_level == 'low'
