'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuthStore } from '@/stores/auth-store';
import { useDriverStore, DriverStatus } from '@/stores/driver-store';
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
  Activity,
  Settings,
  History,
  Wallet,
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
  const pollRidesIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const availablePollRef = useRef<NodeJS.Timeout | null>(null);
  const [loading, setLoading] = useState(false);
  const [driverProfileId, setDriverProfileId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [availableRides, setAvailableRides] = useState<any[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);

  // Auth check
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  // Socket connection and initial sync
  useEffect(() => {
    if (isAuthenticated && !isInitialized) {
      socketClient.connect();
      fetchDriverProfile();
      setIsInitialized(true);
    }
    return () => {
      if (!isAuthenticated) {
        socketClient.disconnect();
      }
    };
  }, [isAuthenticated, isInitialized]);

  const fetchDriverProfile = async () => {
    try {
      const response = await apiClient.get('/drivers/me');
      const profile = response.data?.data?.driver;
      if (profile) {
        const mongoId = profile.id || profile._id;
        setDriverProfileId(mongoId);
        
        // Force sync driver status from backend
        if (profile.status) {
          const backendStatus = profile.status.toUpperCase();
          if (['OFFLINE', 'ONLINE', 'BUSY'].includes(backendStatus)) {
            console.log('Syncing status from backend:', backendStatus);
            driver.setStatus(backendStatus as DriverStatus);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch driver profile:', err);
    }
  };

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

  // Poll for assigned rides when online
  useEffect(() => {
    const pollAssignedRides = async () => {
      if (driver.status === 'ONLINE' && driver.rideStatus === 'NONE' && driverProfileId) {
        try {
          // Check active ride from ride service
          const response = await apiClient.get(`/rides/driver/active?driverId=${driverProfileId}`);
          const assignedRide = response.data?.data?.ride;
          
          if (assignedRide && assignedRide.status === 'ASSIGNED') {
            driver.setRideRequest({
              rideId: assignedRide.id,
              customer: {
                id: assignedRide.customerId,
                name: 'Khách hàng',
                phone: '',
              },
              pickup: {
                lat: assignedRide.pickup.coordinates[1],
                lng: assignedRide.pickup.coordinates[0],
                address: assignedRide.pickupAddress,
              },
              destination: {
                lat: assignedRide.dropoff.coordinates[1],
                lng: assignedRide.dropoff.coordinates[0],
                address: assignedRide.dropoffAddress,
              },
              estimatedFare: assignedRide.fare || 0,
              distance: assignedRide.distance || 0,
            });
          }
        } catch (err: any) {
          // 404 means no active ride - this is OK
          if (err?.response?.status !== 404) {
            console.error('Failed to poll assigned rides:', err);
          }
        }
      }
    };

    if (driver.status === 'ONLINE' && driver.rideStatus === 'NONE' && driverProfileId) {
      // Poll immediately
      pollAssignedRides();
      // Poll every 3 seconds
      pollRidesIntervalRef.current = setInterval(pollAssignedRides, 3000);
    } else {
      if (pollRidesIntervalRef.current) {
        clearInterval(pollRidesIntervalRef.current);
        pollRidesIntervalRef.current = null;
      }
    }

    return () => {
      if (pollRidesIntervalRef.current) {
        clearInterval(pollRidesIntervalRef.current);
      }
    };
  }, [driver.status, driver.rideStatus, driverProfileId]);

  // Poll available rides for browse mode (hybrid)
  useEffect(() => {
    const pollAvailable = async () => {
      if (driver.status !== 'ONLINE' || driver.rideStatus !== 'NONE') return;
      if (!driver.currentLocation) return;
      try {
        setLoadingAvailable(true);
        const res = await apiClient.getAvailableRides(
          driver.currentLocation.lat,
          driver.currentLocation.lng,
          5
        );
        setAvailableRides(res.data?.data?.rides || []);
      } catch (err) {
        console.error('Failed to fetch available rides:', err);
      } finally {
        setLoadingAvailable(false);
      }
    };

    if (driver.status === 'ONLINE' && driver.rideStatus === 'NONE') {
      pollAvailable();
      availablePollRef.current = setInterval(pollAvailable, 5000);
    } else {
      if (availablePollRef.current) {
        clearInterval(availablePollRef.current);
        availablePollRef.current = null;
      }
      setAvailableRides([]);
    }

    return () => {
      if (availablePollRef.current) {
        clearInterval(availablePollRef.current);
      }
    };
  }, [driver.status, driver.rideStatus, driver.currentLocation]);

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

  // Accept available ride (manual accept from list)
  const handleAcceptAvailableRide = async (ride: any) => {
    setLoading(true);
    try {
      const response = await apiClient.acceptAvailableRide(ride.id);
      const acceptedRide = response.data?.data?.ride || ride;
      driver.setRideRequest({
        rideId: acceptedRide.id,
        customer: {
          id: acceptedRide.customerId,
          name: 'Khách hàng',
          phone: '',
        },
        pickup: {
          lat: acceptedRide.pickupLat || acceptedRide.pickup?.coordinates?.[1],
          lng: acceptedRide.pickupLng || acceptedRide.pickup?.coordinates?.[0],
          address: acceptedRide.pickupAddress,
        },
        destination: {
          lat: acceptedRide.dropoffLat || acceptedRide.dropoff?.coordinates?.[1],
          lng: acceptedRide.dropoffLng || acceptedRide.dropoff?.coordinates?.[0],
          address: acceptedRide.dropoffAddress,
        },
        estimatedFare: acceptedRide.fare || 0,
        distance: acceptedRide.distance || acceptedRide.distanceFromDriver || 0,
      });
      setAvailableRides([]);
    } catch (err) {
      console.error('Failed to accept available ride:', err);
    } finally {
      setLoading(false);
    }
  };

  // Decline ride
  const handleDeclineRide = () => {
    driver.clearRide();
  };

  const handlePickup = async () => {
    if (!driver.currentRide) return;
    setLoading(true);
    try {
      await apiClient.pickupRide(driver.currentRide.rideId);
      driver.acceptRide(); // move to PICKING_UP state locally
    } catch (err) {
      console.error('Failed to mark pickup:', err);
    } finally {
      setLoading(false);
    }
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
    driver.reset();
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
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Modern Header */}
      <header className="bg-white shadow-md border-b border-gray-200">
        <div className="px-6 py-4 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg">
              <Car className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Driver Dashboard</h1>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            <Link href="/rides">
              <Button variant="ghost" size="sm" className="gap-2">
                <History className="w-4 h-4" />
                <span className="hidden md:inline">Lịch sử</span>
              </Button>
            </Link>
            <Link href="/earnings">
              <Button variant="ghost" size="sm" className="gap-2">
                <Wallet className="w-4 h-4" />
                <span className="hidden md:inline">Thu nhập</span>
              </Button>
            </Link>
            <Button variant="ghost" size="sm" className="gap-2">
              <Settings className="w-4 h-4" />
              <span className="hidden md:inline">Cài đặt</span>
            </Button>
          </div>

          {/* Status & Logout */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Activity className={`w-5 h-5 ${
                driver.status === 'ONLINE' ? 'text-green-500 animate-pulse' :
                driver.status === 'BUSY' ? 'text-yellow-500' : 'text-gray-400'
              }`} />
              <Badge
                variant={
                  driver.status === 'ONLINE'
                    ? 'success'
                    : driver.status === 'BUSY'
                      ? 'warning'
                      : 'default'
                }
                className="px-4 py-1.5 text-sm font-semibold"
              >
                {driver.status === 'ONLINE' ? 'Đang hoạt động' :
                 driver.status === 'BUSY' ? 'Đang có khách' : 'Không hoạt động'}
              </Badge>
            </div>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="h-10 w-10 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Modern Sidebar */}
        <div className="w-[420px] bg-white shadow-xl overflow-y-auto">
          {/* Stats Cards */}
          <div className="p-6 bg-gradient-to-br from-primary-50 to-primary-100/50">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-white ring-0 shadow-md hover:shadow-lg transition-shadow">
                <div className="p-5">
                  <div className="flex items-center gap-2 text-green-600 mb-2">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium">Thu nhập hôm nay</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(driver.todayEarnings)}
                  </p>
                </div>
              </Card>
              <Card className="bg-white ring-0 shadow-md hover:shadow-lg transition-shadow">
                <div className="p-5">
                  <div className="flex items-center gap-2 text-blue-600 mb-2">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium">Số chuyến</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {driver.todayTrips}
                  </p>
                </div>
              </Card>
            </div>
          </div>

          {/* Main Control Area */}
          <div className="p-6">
            {/* Online/Offline Toggle */}
            {driver.rideStatus === 'NONE' && (
              <div className="mb-6">
                <Button
                  onClick={handleToggleStatus}
                  disabled={loading}
                  size="lg"
                  className={`w-full h-16 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all ${
                    driver.status === 'OFFLINE' 
                      ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700' 
                      : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                  }`}
                >
                  {loading ? (
                    <Loader2 className="w-7 h-7 animate-spin" />
                  ) : (
                    <Power className="w-7 h-7 mr-2" />
                  )}
                  {driver.status === 'OFFLINE' ? 'BẮT ĐẦU NHẬN CHUYẾN' : 'DỪNG NHẬN CHUYẾN'}
                </Button>
                {driver.status === 'ONLINE' && (
                  <p className="text-center text-sm text-gray-500 mt-3">
                    Đang chờ chuyến đi mới...
                  </p>
                )}
              </div>
            )}

            {/* Available rides list (browse mode) */}
            {driver.status === 'ONLINE' && driver.rideStatus === 'NONE' && (
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">Cuốc xe gần bạn</h3>
                  <span className="text-xs text-gray-500">Cập nhật mỗi 5s</span>
                </div>
                {loadingAvailable && (
                  <div className="text-xs text-gray-500">Đang tải danh sách...</div>
                )}
                {!loadingAvailable && availableRides.length === 0 && (
                  <div className="text-xs text-gray-500">Chưa có cuốc nào quanh bạn.</div>
                )}
                <div className="space-y-3 max-h-96 overflow-auto pr-1">
                  {availableRides.map((ride) => (
                    <Card key={ride.id} className="p-4 shadow-sm border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold text-gray-800">{formatCurrency(ride.fare || 0)}</div>
                        <Badge variant="info" className="text-xs">{(ride.distanceFromDriver ?? ride.distance ?? 0).toFixed(1)} km</Badge>
                      </div>
                      <div className="text-xs text-gray-600 mb-1">Điểm đón</div>
                      <div className="text-sm font-medium text-gray-900 truncate">{ride.pickupAddress}</div>
                      <div className="text-xs text-gray-600 mt-2 mb-1">Điểm đến</div>
                      <div className="text-sm font-medium text-gray-900 truncate">{ride.dropoffAddress}</div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleAcceptAvailableRide(ride)}
                          disabled={loading}
                        >
                          Nhận cuốc
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Ride Request - Modern Design */}
            {driver.rideStatus === 'ASSIGNED' && driver.currentRide && (
              <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-400 ring-0 shadow-2xl animate-pulse">
                <div className="p-6">
                  {/* Header with notification badge */}
                  <div className="flex items-center justify-center mb-4">
                    <div className="bg-yellow-500 text-white px-6 py-2 rounded-full font-bold text-lg shadow-lg">
                      🚖 CHUYẾN ĐI MỚI!
                    </div>
                  </div>

                  {/* Ride details */}
                  <div className="bg-white rounded-xl p-5 mb-5 shadow-sm">
                    <div className="space-y-4">
                      {/* Pickup */}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                            Điểm đón
                          </p>
                          <p className="font-semibold text-gray-900 leading-snug">
                            {driver.currentRide.pickup.address}
                          </p>
                        </div>
                      </div>

                      {/* Divider with arrow */}
                      <div className="flex items-center gap-2 pl-5">
                        <div className="flex-1 h-px bg-gray-200"></div>
                        <Navigation className="w-4 h-4 text-gray-400" />
                        <div className="flex-1 h-px bg-gray-200"></div>
                      </div>

                      {/* Destination */}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-5 h-5 text-red-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                            Điểm đến
                          </p>
                          <p className="font-semibold text-gray-900 leading-snug">
                            {driver.currentRide.destination.address}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Fare and distance */}
                    <div className="flex items-center justify-between mt-5 pt-5 border-t border-gray-100">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Quãng đường</p>
                        <p className="font-bold text-gray-900">{driver.currentRide.distance.toFixed(1)} km</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 mb-1">Giá ước tính</p>
                        <p className="text-2xl font-bold text-primary-600">
                          {formatCurrency(driver.currentRide.estimatedFare)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <Button
                      onClick={handleDeclineRide}
                      variant="ghost"
                      className="flex-1 h-14 border-2 border-red-500 text-red-600 hover:bg-red-50 font-semibold rounded-xl"
                    >
                      <XCircle className="w-5 h-5 mr-2" />
                      Từ chối
                    </Button>
                    <Button
                      onClick={handleAcceptRide}
                      disabled={loading}
                      className="flex-1 h-14 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 font-semibold rounded-xl shadow-lg"
                    >
                      {loading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5 mr-2" />
                          Nhận chuyến
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Picking Up Customer - Modern Design */}
            {driver.rideStatus === 'PICKING_UP' && driver.currentRide && (
              <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 ring-0 shadow-xl">
                <div className="p-6">
                  <div className="text-center mb-5">
                    <Badge variant="info" className="px-6 py-2 text-base font-semibold shadow-sm">
                      🚗 Đang đón khách
                    </Badge>
                  </div>

                  {/* Customer info card */}
                  <div className="bg-white rounded-xl p-5 mb-5 shadow-sm">
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center shadow-md">
                        <User className="w-8 h-8 text-gray-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-lg text-gray-900">{driver.currentRide.customer.name}</p>
                        <p className="text-sm text-gray-500">Khách hàng</p>
                      </div>
                      <a
                        href={`tel:${driver.currentRide.customer.phone}`}
                        className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow"
                      >
                        <Phone className="w-5 h-5" />
                      </a>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Điểm đón
                        </p>
                        <p className="font-semibold text-gray-900 leading-snug">
                          {driver.currentRide.pickup.address}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleStartRide}
                    disabled={loading}
                    size="lg"
                    className="w-full h-14 rounded-xl font-bold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg"
                  >
                    {loading ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        <Navigation className="w-5 h-5 mr-2" />
                        ĐÃ ĐÓN KHÁCH - BẮT ĐẦU
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            )}

            {/* In Progress - Modern Design */}
            {driver.rideStatus === 'IN_PROGRESS' && driver.currentRide && (
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 ring-0 shadow-xl">
                <div className="p-6">
                  <div className="text-center mb-5">
                    <Badge variant="success" className="px-6 py-2 text-base font-semibold shadow-sm">
                      🚙 Đang di chuyển
                    </Badge>
                  </div>

                  <div className="bg-white rounded-xl p-5 mb-5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Điểm đến
                        </p>
                        <p className="font-semibold text-gray-900 leading-snug">
                          {driver.currentRide.destination.address}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleCompleteRide}
                    disabled={loading}
                    size="lg"
                    className="w-full h-14 rounded-xl font-bold bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg"
                  >
                    {loading ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5 mr-2" />
                        HOÀN THÀNH CHUYẾN
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            )}

            {/* Completed - Modern Design */}
            {driver.rideStatus === 'COMPLETED' && (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Hoàn thành!</h2>
                <p className="text-4xl font-bold bg-gradient-to-r from-green-600 to-green-500 bg-clip-text text-transparent mb-6">
                  +{formatCurrency(driver.currentRide?.estimatedFare || 0)}
                </p>
                <Button
                  onClick={() => driver.clearRide()}
                  className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 shadow-lg"
                >
                  Tiếp tục nhận chuyến
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Map with modern styling */}
        <div className="flex-1 p-6">
          <div className="h-full rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
            <MapComponent
              currentLocation={driver.currentLocation}
              pickup={driver.currentRide?.pickup || null}
              destination={driver.currentRide?.destination || null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
