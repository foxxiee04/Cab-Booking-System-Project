'use client';

import { MapPin, Navigation, DollarSign, Star, User, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface AvailableRide {
  id: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  distance: number; // km from driver
  estimatedFare: number;
  customerRating?: number;
  vehicleType: string;
}

interface Props {
  rides: AvailableRide[];
  loading: boolean;
  onAccept: (rideId: string) => void;
  onViewDetails: (ride: AvailableRide) => void;
}

export default function AvailableRidesList({ rides, loading, onAccept, onViewDetails }: Props) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (rides.length === 0) {
    return (
      <div className="text-center py-12">
        <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 text-lg font-medium">Không có cuốc xe nào</p>
        <p className="text-gray-400 text-sm mt-2">Các cuốc xe mới sẽ hiển thị ở đây</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          Cuốc xe khả dụng ({rides.length})
        </h3>
      </div>

      {rides.map((ride) => (
        <Card key={ride.id} className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-800 line-clamp-1">
                  {ride.pickupAddress}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span className="text-sm text-gray-600 line-clamp-1">
                  {ride.dropoffAddress}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Navigation className="w-3 h-3" />
                {ride.distance.toFixed(1)} km
              </span>
              {ride.customerRating && (
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  {ride.customerRating.toFixed(1)}
                </span>
              )}
              <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded text-xs font-medium">
                {ride.vehicleType}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="text-lg font-bold text-primary-600">
              {formatCurrency(ride.estimatedFare)}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewDetails(ride)}
              >
                Chi tiết
              </Button>
              <Button
                size="sm"
                onClick={() => onAccept(ride.id)}
                className="bg-green-600 hover:bg-green-700"
              >
                Nhận cuốc
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
