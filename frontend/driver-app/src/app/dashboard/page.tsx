'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuthStore } from '@/stores/auth-store';
import { useDriverStore } from '@/stores/driver-store';
import { apiClient } from '@/lib/api-client';
import { socketClient } from '@/lib/socket-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Car,
  Power,
  MapPin,
  Navigation,
  Phone,
  User,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  LogOut,
  TrendingUp,
} from 'lucide-react';

const MapComponent = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="h-full bg-gray-200 animate-pulse rounded-xl" />,
});

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuthStore();
  const driver = useDriverStore();
  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [loading, setLoading] = useState(false);

  // Auth check
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  // Socket connection
  useEffect(() => {
    if (isAuthenticated) {
      socketClient.connect();
    }
    return () => socketClient.disconnect();
  }, [isAuthenticated]);

  // Listen for ride requests
  useEffect(() => {
    const handleRideRequest = (data: any) => {
      if (driver.status === 'ONLINE' && driver.rideStatus === 'NONE') {
        driver.setRideRequest({
          rideId: data.rideId,
          customer: data.customer,
          pickup: data.pickup,
          destination: data.destination,
          estimatedFare: data.estimatedFare,
          distance: data.distance,
        });
      }
    };

    socketClient.on('ride:assigned', handleRideRequest);
    socketClient.on('ride:new_request', handleRideRequest);

    return () => {
      socketClient.off('ride:assigned', handleRideRequest);
      socketClient.off('ride:new_request', handleRideRequest);
    };
  }, [driver.status, driver.rideStatus]);

  // Location tracking
  useEffect(() => {
    if (driver.status === 'ONLINE' || driver.status === 'BUSY') {
      // Initial location
      updateLocation();

      // Update every 5 seconds
      locationIntervalRef.current = setInterval(updateLocation, 5000);
    } else {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
    }

    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
    };
  }, [driver.status]);

  const updateLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          driver.setLocation({ lat: latitude, lng: longitude });

          try {
            await apiClient.updateLocation(latitude, longitude);
            socketClient.sendLocation(latitude, longitude);
          } catch (err) {
            console.error('Failed to update location:', err);
          }
        },
        (error) => console.error('Geolocation error:', error),
        { enableHighAccuracy: true }
      );
    }
  };

  // Go online/offline
  const handleToggleStatus = async () => {
    setLoading(true);
    try {
      if (driver.status === 'OFFLINE') {
        await apiClient.goOnline();
        driver.setStatus('ONLINE');
      } else {
        await apiClient.goOffline();
        driver.setStatus('OFFLINE');
      }
    } catch (err) {
      console.error('Failed to toggle status:', err);
    } finally {
      setLoading(false);
    }
  };

  // Accept ride
  const handleAcceptRide = async () => {
    if (!driver.currentRide) return;
    setLoading(true);
    try {
      await apiClient.acceptRide(driver.currentRide.rideId);
      driver.acceptRide();
      socketClient.joinRideRoom(driver.currentRide.rideId);
    } catch (err) {
      console.error('Failed to accept ride:', err);
    } finally {
      setLoading(false);
    }
  };

  // Decline ride
  const handleDeclineRide = () => {
    driver.clearRide();
  };

  // Start ride
  const handleStartRide = async () => {
    if (!driver.currentRide) return;
    setLoading(true);
    try {
      await apiClient.startRide(driver.currentRide.rideId);
      driver.startRide();
    } catch (err) {
      console.error('Failed to start ride:', err);
    } finally {
      setLoading(false);
    }
  };

  // Complete ride
  const handleCompleteRide = async () => {
    if (!driver.currentRide) return;
    setLoading(true);
    try {
      await apiClient.completeRide(driver.currentRide.rideId);
      driver.completeRide(driver.currentRide.estimatedFare);
      socketClient.leaveRideRoom(driver.currentRide.rideId);
    } catch (err) {
      console.error('Failed to complete ride:', err);
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      if (driver.status !== 'OFFLINE') {
        await apiClient.goOffline();
      }
      await apiClient.logout();
    } catch {}
    logout();
    driver.setStatus('OFFLINE');
    socketClient.disconnect();
    router.push('/');
  };

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
          <span className="font-bold">Driver</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/rides">
            <Button variant="ghost" size="sm">Lịch sử chuyến</Button>
          </Link>
          <Link href="/earnings">
            <Button variant="ghost" size="sm">Thu nhập</Button>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Badge
            variant={
              driver.status === 'ONLINE'
                ? 'success'
                : driver.status === 'BUSY'
                  ? 'warning'
                  : 'default'
            }
            className="px-3 py-1 text-sm"
          >
            {driver.status === 'ONLINE' ? 'Đang hoạt động' :
             driver.status === 'BUSY' ? 'Đang có khách' : 'Offline'}
          </Badge>
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
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card className="bg-green-50 ring-0">
              <div className="p-4">
                <div className="flex items-center gap-2 text-green-600 mb-1">
                  <DollarSign className="w-5 h-5" />
                  <span className="text-sm">Hôm nay</span>
                </div>
                <p className="text-xl font-bold text-green-700">
                  {formatCurrency(driver.todayEarnings)}
                </p>
              </div>
            </Card>
            <Card className="bg-blue-50 ring-0">
              <div className="p-4">
                <div className="flex items-center gap-2 text-blue-600 mb-1">
                  <TrendingUp className="w-5 h-5" />
                  <span className="text-sm">Chuyến</span>
                </div>
                <p className="text-xl font-bold text-blue-700">
                  {driver.todayTrips}
                </p>
              </div>
            </Card>
          </div>

          {/* Online/Offline Toggle */}
          {driver.rideStatus === 'NONE' && (
            <Button
              onClick={handleToggleStatus}
              disabled={loading}
              size="lg"
              className={`w-full rounded-xl font-bold text-lg ${
                driver.status === 'OFFLINE' ? '' : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Power className="w-6 h-6" />
              )}
              {driver.status === 'OFFLINE' ? 'BẮT ĐẦU NHẬN CHUYẾN' : 'KẾT THÚC'}
            </Button>
          )}

          {/* Ride Request */}
          {driver.rideStatus === 'ASSIGNED' && driver.currentRide && (
            <Card className="bg-yellow-50 border-2 border-yellow-400 ring-0 p-4 animate-pulse">
              <h3 className="font-bold text-yellow-800 mb-3 text-center">
                CHUYẾN ĐI MỚI!
              </h3>
              
              <div className="space-y-3 mb-4">
                <div className="flex items-start gap-2">
                  <MapPin className="w-5 h-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Điểm đón</p>
                    <p className="font-medium">{driver.currentRide.pickup.address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Điểm đến</p>
                    <p className="font-medium">{driver.currentRide.destination.address}</p>
                  </div>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-gray-600">Giá ước tính:</span>
                  <span className="font-bold text-primary-600">
                    {formatCurrency(driver.currentRide.estimatedFare)}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleDeclineRide}
                  variant="ghost"
                  className="flex-1 border-2 border-red-500 text-red-600 hover:bg-red-50"
                >
                  <XCircle className="w-5 h-5" />
                  Từ chối
                </Button>
                <Button
                  onClick={handleAcceptRide}
                  disabled={loading}
                  className="flex-1 bg-green-500 hover:bg-green-600"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
                  Nhận
                </Button>
              </div>
            </Card>
          )}

          {/* Picking Up Customer */}
          {driver.rideStatus === 'PICKING_UP' && driver.currentRide && (
            <Card className="bg-blue-50 ring-0 p-4">
              <div className="text-center mb-4">
                <Badge variant="info" className="px-4 py-1 text-sm">
                  Đang đón khách
                </Badge>
              </div>

              <div className="bg-white rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-semibold">{driver.currentRide.customer.name}</p>
                    <p className="text-sm text-gray-500">Khách hàng</p>
                  </div>
                  <a
                    href={`tel:${driver.currentRide.customer.phone}`}
                    className="ml-auto p-3 bg-green-500 text-white rounded-full"
                  >
                    <Phone className="w-5 h-5" />
                  </a>
                </div>

                <div className="flex items-start gap-2">
                  <MapPin className="w-5 h-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Điểm đón</p>
                    <p className="font-medium">{driver.currentRide.pickup.address}</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleStartRide}
                disabled={loading}
                size="lg"
                className="w-full rounded-xl font-bold bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Navigation className="w-5 h-5" />
                )}
                ĐÃ ĐÓN KHÁCH - BẮT ĐẦU
              </Button>
            </Card>
          )}

          {/* In Progress */}
          {driver.rideStatus === 'IN_PROGRESS' && driver.currentRide && (
            <Card className="bg-green-50 ring-0 p-4">
              <div className="text-center mb-4">
                <Badge variant="success" className="px-4 py-1 text-sm">
                  Đang di chuyển
                </Badge>
              </div>

              <div className="bg-white rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <MapPin className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Điểm đến</p>
                    <p className="font-medium">{driver.currentRide.destination.address}</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleCompleteRide}
                disabled={loading}
                size="lg"
                className="w-full rounded-xl font-bold bg-green-600 hover:bg-green-700"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                HOÀN THÀNH CHUYẾN
              </Button>
            </Card>
          )}

          {/* Completed */}
          {driver.rideStatus === 'COMPLETED' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Hoàn thành!</h2>
              <p className="text-3xl font-bold text-green-600 mb-6">
                +{formatCurrency(driver.currentRide?.estimatedFare || 0)}
              </p>
              <Button
                onClick={() => driver.clearRide()}
              >
                Tiếp tục nhận chuyến
              </Button>
            </div>
          )}
        </div>

        {/* Map */}
        <div className="flex-1 p-4">
          <MapComponent
            currentLocation={driver.currentLocation}
            pickup={driver.currentRide?.pickup || null}
            destination={driver.currentRide?.destination || null}
          />
        </div>
      </div>
    </div>
  );
}
