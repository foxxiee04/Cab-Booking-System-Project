'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MapPin, 
  Navigation, 
  Car, 
  Loader2, 
  ArrowLeft, 
  LogOut,
  Clock
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { ApiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import LocationSearchInput from '@/components/LocationSearchInput';
import VehicleSelector, { type VehicleType } from '@/components/VehicleSelector';
import MapGoogle from '@/components/MapGoogle';
import type { LocationSuggestion } from '@/lib/geocoding';

interface Location {
  lat: number;
  lng: number;
  address: string;
}

export default function BookPage() {
  const router = useRouter();
  const { isAuthenticated, accessToken, refreshToken, setTokens, logout } = useAuthStore();
  
  // Location states
  const [pickupLocation, setPickupLocation] = useState<Location | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<Location | null>(null);
  const [pickupInput, setPickupInput] = useState('');
  const [dropoffInput, setDropoffInput] = useState('');
  
  // Booking states
  const [vehicleType, setVehicleType] = useState<VehicleType>('ECONOMY');
  const [estimate, setEstimate] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPanel, setShowPanel] = useState(true);
  const [panelStep, setPanelStep] = useState<'location' | 'vehicle'>('location');

  const api = new ApiClient({
    getTokens: () => (accessToken && refreshToken ? { accessToken, refreshToken } : null),
    setTokens: (tokens) => setTokens(tokens.accessToken, tokens.refreshToken),
    onLogout: logout,
  });

  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated, router]);

  const handlePickupSelect = (location: LocationSuggestion) => {
    setPickupLocation({
      lat: location.lat,
      lng: location.lng,
      address: location.address,
    });
    setPickupInput(location.address);
  };

  const handleDropoffSelect = (location: LocationSuggestion) => {
    setDropoffLocation({
      lat: location.lat,
      lng: location.lng,
      address: location.address,
    });
    setDropoffInput(location.address);
  };

  const handleEstimate = async () => {
    if (!pickupLocation || !dropoffLocation) {
      setError('Vui lòng chọn điểm đón và điểm đến');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.estimateRide(
        { lat: pickupLocation.lat, lng: pickupLocation.lng },
        { lat: dropoffLocation.lat, lng: dropoffLocation.lng }
      );
      setEstimate(res.data);
      setPanelStep('vehicle');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể ước tính chuyến đi');
      console.error('Estimate error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBookRide = async () => {
    if (!pickupLocation || !dropoffLocation) return;

    setLoading(true);
    setError('');

    try {
      const res = await api.createRide({
        pickup: {
          lat: pickupLocation.lat,
          lng: pickupLocation.lng,
          address: pickupLocation.address,
        },
        dropoff: {
          lat: dropoffLocation.lat,
          lng: dropoffLocation.lng,
          address: dropoffLocation.address,
        },
        vehicleType: vehicleType,
        paymentMethod: 'CASH',
      });
      
      router.push('/rides');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Không thể đặt xe');
      console.error('Booking error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPickupLocation(null);
    setDropoffLocation(null);
    setPickupInput('');
    setDropoffInput('');
    setEstimate(null);
    setVehicleType('ECONOMY');
    setPanelStep('location');
    setError('');
  };

  if (!isAuthenticated) return null;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <Car className="w-6 h-6 text-primary-600" />
            <span className="text-lg font-bold text-gray-900">Đặt xe</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push('/rides')}
          >
            <Clock className="w-4 h-4 mr-1" />
            Chuyến đi
          </Button>
          <button
            onClick={() => {
              logout();
              router.push('/login');
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Đăng xuất"
          >
            <LogOut className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Map Background */}
        <div className="absolute inset-0">
          <MapGoogle
            pickup={pickupLocation}
            destination={dropoffLocation}
            showControls={true}
          />
        </div>

        {/* Sliding Panel */}
        <div
          className={`
            absolute bottom-0 left-0 right-0 md:left-4 md:bottom-4 md:right-auto
            md:w-[440px] bg-white rounded-t-3xl md:rounded-2xl shadow-2xl
            transition-transform duration-300 ease-out z-10
            ${showPanel ? 'translate-y-0' : 'translate-y-[calc(100%-60px)]'}
          `}
        >
          {/* Panel Handle */}
          <button
            onClick={() => setShowPanel(!showPanel)}
            className="w-full py-4 flex justify-center md:hidden"
          >
            <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
          </button>

          {/* Panel Content */}
          <div className="px-6 pb-6 max-h-[calc(100vh-200px)] overflow-y-auto">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            {/* Step 1: Location Selection */}
            {panelStep === 'location' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Bạn muốn đi đâu?</h2>
                
                <LocationSearchInput
                  type="pickup"
                  value={pickupInput}
                  onChange={setPickupInput}
                  onLocationSelect={handlePickupSelect}
                  selectedLocation={pickupLocation as any}
                  placeholder="Nhập điểm đón..."
                />

                <LocationSearchInput
                  type="dropoff"
                  value={dropoffInput}
                  onChange={setDropoffInput}
                  onLocationSelect={handleDropoffSelect}
                  selectedLocation={dropoffLocation as any}
                  placeholder="Nhập điểm đến..."
                />

                <Button
                  onClick={handleEstimate}
                  disabled={!pickupLocation || !dropoffLocation || loading}
                  className="w-full py-6 text-base font-semibold"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Đang tính toán...
                    </>
                  ) : (
                    <>
                      <Navigation className="w-5 h-5 mr-2" />
                      Tìm xe
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Step 2: Vehicle Selection */}
            {panelStep === 'vehicle' && estimate && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Chọn loại xe</h2>
                  <button
                    onClick={handleReset}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Đổi địa điểm
                  </button>
                </div>

                {/* Route Summary */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 flex-1">{pickupLocation?.address}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Navigation className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 flex-1">{dropoffLocation?.address}</span>
                  </div>
                </div>

                <VehicleSelector
                  selected={vehicleType}
                  onChange={setVehicleType}
                  estimatedPrice={estimate?.data?.estimatedPrice || estimate?.estimatedPrice}
                  distance={estimate?.data?.distance || estimate?.distance}
                  duration={estimate?.data?.duration || estimate?.duration}
                  disabled={loading}
                />

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="secondary"
                    onClick={() => setPanelStep('location')}
                    className="flex-1"
                    disabled={loading}
                  >
                    Quay lại
                  </Button>
                  <Button
                    onClick={handleBookRide}
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Đang đặt...
                      </>
                    ) : (
                      <>
                        <Car className="w-4 h-4 mr-2" />
                        Đặt xe
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
