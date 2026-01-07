'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuthStore } from '@/stores/auth-store';
import { useRideStore } from '@/stores/ride-store';
import { apiClient } from '@/lib/api-client';
import { socketClient } from '@/lib/socket-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  MapPin, 
  Navigation, 
  Search, 
  Car, 
  Clock, 
  DollarSign,
  Loader2,
  X,
  Phone,
  Star,
  User,
  LogOut
} from 'lucide-react';

// Dynamic import for Map (SSR issue with Leaflet)
const MapComponent = dynamic(() => import('@/components/Map'), { 
  ssr: false,
  loading: () => <div className="h-full bg-gray-200 animate-pulse rounded-xl" />
});

export default function BookPage() {
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuthStore();
  const ride = useRideStore();

  const [pickupInput, setPickupInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check auth
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Connect socket when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      socketClient.connect();
    }
    return () => {
      socketClient.disconnect();
    };
  }, [isAuthenticated]);

  // Socket event listeners
  useEffect(() => {
    if (!ride.rideId) return;

    socketClient.joinRideRoom(ride.rideId);

    const handleDriverAssigned = (data: any) => {
      ride.setDriverAssigned(data, data.eta);
    };

    const handleRideAccepted = (data: any) => {
      ride.setDriverAccepted();
    };

    const handleRideStarted = () => {
      ride.setRideStarted();
    };

    const handleRideCompleted = (data: any) => {
      ride.setRideCompleted(data.fare);
    };

    const handleDriverLocation = (data: any) => {
      ride.updateDriverLocation({ lat: data.lat, lng: data.lng });
    };

    socketClient.on('ride:driver_assigned', handleDriverAssigned);
    socketClient.on('ride:accepted', handleRideAccepted);
    socketClient.on('ride:started', handleRideStarted);
    socketClient.on('ride:completed', handleRideCompleted);
    socketClient.on('driver:location', handleDriverLocation);

    return () => {
      socketClient.leaveRideRoom(ride.rideId!);
      socketClient.off('ride:driver_assigned', handleDriverAssigned);
      socketClient.off('ride:accepted', handleRideAccepted);
      socketClient.off('ride:started', handleRideStarted);
      socketClient.off('ride:completed', handleRideCompleted);
      socketClient.off('driver:location', handleDriverLocation);
    };
  }, [ride.rideId]);

  // Get user's current location
  const getCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          ride.setPickup({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            address: 'Vị trí hiện tại',
          });
          setPickupInput('Vị trí hiện tại');
        },
        (error) => {
          console.error('Geolocation error:', error);
          // Default to Ho Chi Minh City center
          ride.setPickup({
            lat: 10.762622,
            lng: 106.660172,
            address: 'Trung tâm TP.HCM',
          });
          setPickupInput('Trung tâm TP.HCM');
        }
      );
    }
  }, [ride]);

  useEffect(() => {
    if (!ride.pickup) {
      getCurrentLocation();
    }
  }, []);

  // Estimate ride
  const handleEstimate = async () => {
    if (!ride.pickup || !ride.destination) {
      setError('Vui lòng chọn điểm đón và điểm đến');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiClient.estimateRide(
        { lat: ride.pickup.lat, lng: ride.pickup.lng },
        { lat: ride.destination.lat, lng: ride.destination.lng }
      );
      
      const data = response.data;
      ride.setEstimate({
        distanceKm: data.distance_km,
        durationMinutes: data.duration_minutes,
        estimatedFare: data.estimated_fare,
        surgeMultiplier: data.surge_multiplier,
      });
    } catch (err: any) {
      setError('Không thể ước tính chuyến đi');
    } finally {
      setLoading(false);
    }
  };

  // Book ride
  const handleBookRide = async () => {
    if (!ride.pickup || !ride.destination) return;

    setLoading(true);
    setError('');
    ride.startSearching();

    try {
      const response = await apiClient.createRide({
        pickup: {
          lat: ride.pickup.lat,
          lng: ride.pickup.lng,
          address: ride.pickup.address || pickupInput,
        },
        dropoff: {
          lat: ride.destination.lat,
          lng: ride.destination.lng,
          address: ride.destination.address || destinationInput,
        },
      });

      ride.setRideCreated(response.data.data.ride.id);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể đặt xe');
      ride.reset();
    } finally {
      setLoading(false);
    }
  };

  // Cancel ride
  const handleCancelRide = async () => {
    if (!ride.rideId) return;

    try {
      await apiClient.cancelRide(ride.rideId, 'Khách hàng hủy');
      ride.setRideCancelled();
      setTimeout(() => ride.reset(), 2000);
    } catch (err: any) {
      setError('Không thể hủy chuyến đi');
    }
  };

  // Handle map click for destination
  const handleMapClick = (lat: number, lng: number) => {
    if (!ride.destination) {
      ride.setDestination({ lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
      setDestinationInput(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await apiClient.logout();
    } catch {}
    logout();
    socketClient.disconnect();
    router.push('/');
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  if (!isAuthenticated) return null;

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary-600">
          <Car className="w-6 h-6" />
          <span className="font-bold">CabBooking</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/rides">
            <Button variant="ghost" size="sm">Lịch sử chuyến</Button>
          </Link>
          <Link href="/payments">
            <Button variant="ghost" size="sm">Thanh toán</Button>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Xin chào, {user?.name}</span>
          <Button
            onClick={handleLogout}
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0 text-gray-500 hover:text-gray-700"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-96 bg-white shadow-lg p-6 overflow-y-auto">
          {/* Idle / Booking State */}
          {(ride.status === 'IDLE' || ride.status === 'SEARCHING') && (
            <>
              <h2 className="text-xl font-bold text-gray-800 mb-6">Đặt xe</h2>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {error}
                </div>
              )}

              {/* Pickup */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Điểm đón
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                  <Input
                    type="text"
                    value={pickupInput}
                    onChange={(e) => setPickupInput(e.target.value)}
                    className="pl-10 pr-10"
                    placeholder="Chọn điểm đón"
                  />
                  <Button
                    onClick={getCurrentLocation}
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 p-0 text-gray-400 hover:text-primary-500"
                  >
                    <Navigation className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Destination */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Điểm đến
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
                  <Input
                    type="text"
                    value={destinationInput}
                    onChange={(e) => setDestinationInput(e.target.value)}
                    className="pl-10"
                    placeholder="Nhập hoặc click trên bản đồ"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Click trên bản đồ để chọn điểm đến
                </p>
              </div>

              {/* Estimate Button */}
              {!ride.estimate && (
                <Button
                  onClick={handleEstimate}
                  disabled={loading || !ride.destination}
                  variant="secondary"
                  className="w-full mb-4"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Search className="w-5 h-5" />
                  )}
                  Ước tính giá
                </Button>
              )}

              {/* Estimate Result */}
              {ride.estimate && (
                <Card className="bg-gray-50 mb-4">
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-800 mb-3">Ước tính chuyến đi</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Khoảng cách:</span>
                      <span className="font-medium">{ride.estimate.distanceKm.toFixed(1)} km</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Thời gian:</span>
                      <span className="font-medium">{ride.estimate.durationMinutes} phút</span>
                    </div>
                    {ride.estimate.surgeMultiplier > 1 && (
                      <div className="flex justify-between text-sm text-orange-600">
                        <span>Surge:</span>
                        <span className="font-medium">x{ride.estimate.surgeMultiplier}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t flex justify-between">
                      <span className="font-medium text-gray-700">Giá ước tính:</span>
                      <span className="font-bold text-primary-600 text-lg">
                        {formatCurrency(ride.estimate.estimatedFare)}
                      </span>
                    </div>
                  </div>
                  </div>
                </Card>
              )}

              {/* Book Button */}
              <Button
                onClick={handleBookRide}
                disabled={loading || !ride.estimate}
                size="lg"
                className="w-full rounded-xl font-bold"
              >
                {ride.status === 'SEARCHING' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Đang tìm tài xế...
                  </>
                ) : (
                  <>
                    <Car className="w-5 h-5" />
                    Đặt xe ngay
                  </>
                )}
              </Button>
            </>
          )}

          {/* Pending / Assigned State */}
          {(ride.status === 'PENDING' || ride.status === 'ASSIGNED') && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                {ride.status === 'PENDING' ? 'Đang tìm tài xế...' : 'Đã tìm thấy tài xế!'}
              </h2>
              <p className="text-gray-600 mb-6">
                Vui lòng chờ trong giây lát
              </p>
              <Button
                onClick={handleCancelRide}
                variant="ghost"
                className="border border-red-500 text-red-600 hover:bg-red-50"
              >
                Hủy chuyến
              </Button>
            </div>
          )}

          {/* Driver Arriving / In Progress */}
          {(ride.status === 'DRIVER_ARRIVING' || ride.status === 'IN_PROGRESS') && ride.driver && (
            <div>
              <div className="text-center mb-6">
                <Badge
                  variant={ride.status === 'DRIVER_ARRIVING' ? 'info' : 'success'}
                  className="px-4 py-1 text-sm"
                >
                  {ride.status === 'DRIVER_ARRIVING' ? 'Tài xế đang đến' : 'Đang di chuyển'}
                </Badge>
              </div>

              {/* Driver Info */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 bg-gray-300 rounded-full flex items-center justify-center">
                    <User className="w-7 h-7 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{ride.driver.name}</h3>
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span>{ride.driver.rating.toFixed(1)}</span>
                    </div>
                  </div>
                  <a
                    href={`tel:${ride.driver.phone}`}
                    className="ml-auto p-3 bg-green-500 text-white rounded-full hover:bg-green-600 transition"
                  >
                    <Phone className="w-5 h-5" />
                  </a>
                </div>

                {/* Vehicle Info */}
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
                  <Car className="w-8 h-8 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-800">{ride.driver.vehicle.model}</p>
                    <p className="text-sm text-gray-500">
                      {ride.driver.vehicle.color} • {ride.driver.vehicle.licensePlate}
                    </p>
                  </div>
                </div>
              </div>

              {/* ETA */}
              {ride.eta && ride.status === 'DRIVER_ARRIVING' && (
                <div className="flex items-center justify-center gap-2 text-gray-600 mb-4">
                  <Clock className="w-5 h-5" />
                  <span>Đến trong {ride.eta} phút</span>
                </div>
              )}

              {ride.status === 'DRIVER_ARRIVING' && (
                <Button
                  onClick={handleCancelRide}
                  variant="ghost"
                  className="w-full border border-red-500 text-red-600 hover:bg-red-50"
                >
                  Hủy chuyến
                </Button>
              )}
            </div>
          )}

          {/* Completed State */}
          {ride.status === 'COMPLETED' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Chuyến đi hoàn thành!</h2>
              <p className="text-3xl font-bold text-primary-600 mb-6">
                {formatCurrency(ride.fare || 0)}
              </p>
              <Button
                onClick={() => ride.reset()}
                className="w-full"
              >
                Đặt chuyến mới
              </Button>
            </div>
          )}

          {/* Cancelled State */}
          {ride.status === 'CANCELLED' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Chuyến đi đã hủy</h2>
              <Button
                onClick={() => ride.reset()}
                variant="secondary"
                className="mt-4"
              >
                Đặt chuyến mới
              </Button>
            </div>
          )}
        </div>

        {/* Map */}
        <div className="flex-1 p-4">
          <MapComponent
            pickup={ride.pickup}
            destination={ride.destination}
            driverLocation={ride.driver?.location}
            onMapClick={handleMapClick}
          />
        </div>
      </div>
    </div>
  );
}
