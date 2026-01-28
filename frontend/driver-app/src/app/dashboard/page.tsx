'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Power, MapPin, Navigation, Car, DollarSign } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { ApiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, accessToken, refreshToken, setTokens, logout } = useAuthStore();
  
  const [driver, setDriver] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [availableRides, setAvailableRides] = useState<any[]>([]);
  const [currentRide, setCurrentRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const initialLoadDone = useRef(false);

  const api = new ApiClient({
    getTokens: () => (accessToken && refreshToken ? { accessToken, refreshToken } : null),
    setTokens: (tokens) => setTokens(tokens.accessToken, tokens.refreshToken),
    onLogout: logout,
  });

  const loadAvailableRides = useCallback(async () => {
    console.log('Loading available rides with location:', currentLocation);
    try {
      if (!currentLocation) {
        console.warn('No location available for fetching rides');
        return;
      }
      const res = await api.getAvailableRides(currentLocation.lat, currentLocation.lng, 5);
      // Nếu API trả về { rides: [...] } thì chỉ lấy rides
      const ridesArr = Array.isArray(res.data.data)
        ? res.data.data
        : Array.isArray(res.data.data?.rides)
          ? res.data.data.rides
          : [];
      console.log('Available rides loaded:', ridesArr);
      setAvailableRides(ridesArr);
    } catch (err) {
      console.error('Load rides error:', err);
    }
  }, [currentLocation, api]);

  const loadData = useCallback(async () => {
    console.log('Loading driver data...');
    try {
      const [driverRes, activeRideRes] = await Promise.all([
        api.getDriverProfile(),
        api.getActiveRide().catch(() => ({ data: { data: null } })),
      ]);

      console.log('Driver data loaded:', driverRes.data.data);
      setDriver(driverRes.data.data);
      setIsOnline(driverRes.data.data.availabilityStatus === 'ONLINE');
      setCurrentRide(activeRideRes.data.data);

      if (driverRes.data.data.availabilityStatus === 'ONLINE' && !activeRideRes.data.data && currentLocation) {
        loadAvailableRides();
      }
    } catch (err: any) {
      console.error('Load data error:', err);
      setError(err.response?.data?.message || 'Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [api, currentLocation, loadAvailableRides]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    
    // Load driver data first
    loadData();
    
    // Get current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCurrentLocation(location);
          console.log('Location obtained:', location);
        },
        (error) => {
          console.error('Geolocation error:', error);
          // Use default location (Ho Chi Minh City center)
          setCurrentLocation({ lat: 10.7769, lng: 106.7009 });
        }
      );
    } else {
      console.warn('Geolocation not supported, using default location');
      // Use default location
      setCurrentLocation({ lat: 10.7769, lng: 106.7009 });
    }
  }, [isAuthenticated, router, loadData]);

  // Load available rides when location is available

  // Chỉ load available rides khi online chuyển từ false -> true hoặc location thay đổi rõ rệt
  const prevOnline = useRef(isOnline);
  const prevLocation = useRef(currentLocation);
  useEffect(() => {
    if (
      isOnline &&
      (
        !prevOnline.current ||
        (currentLocation &&
          (!prevLocation.current ||
            prevLocation.current.lat !== currentLocation.lat ||
            prevLocation.current.lng !== currentLocation.lng))
      )
    ) {
      loadAvailableRides();
    }
    prevOnline.current = isOnline;
    prevLocation.current = currentLocation;
  }, [isOnline, currentLocation, loadAvailableRides]);

  const toggleOnline = async () => {
    try {
      if (isOnline) {
        await api.setOffline();
      } else {
        await api.setOnline();
      }
      setIsOnline(!isOnline);
      if (!isOnline) {
        loadAvailableRides();
      } else {
        setAvailableRides([]);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể thay đổi trạng thái');
    }
  };

  const handleAcceptRide = async (rideId: string) => {
    try {
      console.log('Accepting ride:', rideId);
      const res = await api.acceptRide(rideId);
      console.log('Accept ride response:', res);
      loadData();
    } catch (err: any) {
      console.error('Accept ride error:', err);
      alert(err.response?.data?.message || 'Không thể nhận chuyến');
    }
  };

  const handleStartRide = async () => {
    if (!currentRide) return;
    try {
      await api.startRide(currentRide.id);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể bắt đầu chuyến');
    }
  };

  const handlePickup = async () => {
    if (!currentRide) return;
    try {
      await api.pickupCustomer(currentRide.id);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể xác nhận đón khách');
    }
  };

  const handleComplete = async () => {
    if (!currentRide) return;
    try {
      await api.completeRide(currentRide.id);
      alert('Hoàn thành chuyến đi!');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể hoàn thành chuyến');
    }
  };

  if (!isAuthenticated || loading) return <div className="p-8 text-center">Đang tải...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Bảng điều khiển</h1>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push('/rides')}>
              Lịch sử
            </Button>
            <Button variant="secondary" onClick={() => { logout(); router.push('/'); }}>
              Đăng xuất
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        {/* Driver Info */}
        <Card className="p-6 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold mb-2">
                {driver?.vehicleBrand} {driver?.vehicleModel}
              </h2>
              <p className="text-gray-600">Biển số: {driver?.vehiclePlate}</p>
              <p className="text-gray-600">Loại xe: {driver?.vehicleType}</p>
            </div>
            <Button
              onClick={toggleOnline}
              variant={isOnline ? 'primary' : 'secondary'}
              className={isOnline ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              <Power className="w-4 h-4 mr-2" />
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </Button>
          </div>
        </Card>

        {/* Current Ride */}
        {currentRide && (
          <Card className="p-6 mb-4">
            <h2 className="text-lg font-semibold mb-4">Chuyến đi hiện tại</h2>
            
            <div className="space-y-3 mb-4">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-green-500 mt-1" />
                <div>
                  <div className="text-sm text-gray-500">Điểm đón</div>
                  <div className="text-sm">{currentRide.pickupAddress}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Navigation className="w-4 h-4 text-red-500 mt-1" />
                <div>
                  <div className="text-sm text-gray-500">Điểm đến</div>
                  <div className="text-sm">{currentRide.dropoffAddress}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                <span className="font-semibold text-green-600">
                  {currentRide.fare?.toLocaleString('vi-VN')} ₫
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              {currentRide.status === 'ACCEPTED' && (
                <Button onClick={handleStartRide} className="flex-1">
                  Bắt đầu đến đón
                </Button>
              )}
              {currentRide.status === 'IN_PROGRESS' && (
                <Button onClick={handlePickup} className="flex-1">
                  Đã đón khách
                </Button>
              )}
              {currentRide.status === 'PICKED_UP' && (
                <Button onClick={handleComplete} className="flex-1 bg-green-600 hover:bg-green-700">
                  Hoàn thành chuyến
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Available Rides */}
        {isOnline && !currentRide && (
          <div>
            <h2 className="text-lg font-semibold mb-4">
              Chuyến đi khả dụng ({availableRides.length})
            </h2>
            {availableRides.length === 0 ? (
              <Card className="p-12 text-center text-gray-500">
                Không có chuyến đi nào. Vui lòng chờ...
              </Card>
            ) : (
              <div className="space-y-3">
                {availableRides.map((ride) => (
                  <Card key={ride.id} className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-green-500 mt-1" />
                          <div className="text-sm">{ride.pickupAddress}</div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Navigation className="w-4 h-4 text-red-500 mt-1" />
                          <div className="text-sm">{ride.dropoffAddress}</div>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-lg font-bold text-green-600 mb-2">
                          {ride.fare?.toLocaleString('vi-VN')} ₫
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAcceptRide(ride.id)}
                        >
                          Nhận chuyến
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
