'use client';

import { Car, Users } from 'lucide-react';

export type VehicleType = 'ECONOMY' | 'COMFORT' | 'PREMIUM' | 'SUV';

export interface VehicleOption {
  type: VehicleType;
  name: string;
  description: string;
  capacity: number;
  priceMultiplier: number;
  icon: string;
  features: string[];
}

const vehicleOptions: VehicleOption[] = [
  {
    type: 'ECONOMY',
    name: 'Economy',
    description: 'Tiết kiệm, giá tốt',
    capacity: 4,
    priceMultiplier: 1.0,
    icon: '🚗',
    features: ['4 chỗ', 'Điều hòa', 'Giá rẻ'],
  },
  {
    type: 'COMFORT',
    name: 'Comfort',
    description: 'Thoải mái, rộng rãi',
    capacity: 4,
    priceMultiplier: 1.3,
    icon: '🚙',
    features: ['4 chỗ', 'Xe mới', 'Êm ái'],
  },
  {
    type: 'PREMIUM',
    name: 'Premium',
    description: 'Sang trọng, cao cấp',
    capacity: 4,
    priceMultiplier: 1.6,
    icon: '🚘',
    features: ['4 chỗ', 'Xe sang', 'Dịch vụ VIP'],
  },
  {
    type: 'SUV',
    name: 'SUV',
    description: 'Rộng rãi, 7 chỗ',
    capacity: 7,
    priceMultiplier: 1.8,
    icon: '🚐',
    features: ['7 chỗ', 'Xe lớn', 'Gia đình'],
  },
];

interface VehicleSelectorProps {
  selected: VehicleType;
  onChange: (type: VehicleType) => void;
  estimatedPrice?: number;
  distance?: number;
  duration?: number;
  disabled?: boolean;
}

export default function VehicleSelector({
  selected,
  onChange,
  estimatedPrice,
  distance,
  duration,
  disabled = false,
}: VehicleSelectorProps) {
  const formatPrice = (basePrice: number | undefined, multiplier: number) => {
    if (!basePrice) return null;
    const price = Math.round(basePrice * multiplier);
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  const formatDistance = (dist: number | undefined) => {
    if (!dist) return null;
    return dist >= 1 ? `${dist.toFixed(1)} km` : `${Math.round(dist * 1000)} m`;
  };

  const formatDuration = (dur: number | undefined) => {
    if (!dur) return null;
    const minutes = Math.ceil(dur);
    return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}p` : `${minutes} phút`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-semibold text-gray-700">Chọn loại xe</label>
        {(distance || duration) && (
          <div className="text-xs text-gray-500">
            {distance && <span>{formatDistance(distance)}</span>}
            {distance && duration && <span className="mx-1">•</span>}
            {duration && <span>{formatDuration(duration)}</span>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {vehicleOptions.map((vehicle) => {
          const isSelected = selected === vehicle.type;
          const price = formatPrice(estimatedPrice, vehicle.priceMultiplier);

          return (
            <button
              key={vehicle.type}
              onClick={() => onChange(vehicle.type)}
              disabled={disabled}
              className={`
                relative p-4 rounded-xl border-2 text-left transition-all
                ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Icon and Badge */}
              <div className="flex items-start justify-between mb-2">
                <div className="text-3xl">{vehicle.icon}</div>
                {isSelected && (
                  <div className="px-2 py-0.5 bg-primary-500 text-white text-xs font-medium rounded-full">
                    Đã chọn
                  </div>
                )}
              </div>

              {/* Vehicle Info */}
              <div className="mb-2">
                <h3 className="font-semibold text-gray-900 text-base mb-0.5">
                  {vehicle.name}
                </h3>
                <p className="text-xs text-gray-500">{vehicle.description}</p>
              </div>

              {/* Features */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {vehicle.features.map((feature, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-md"
                  >
                    {feature}
                  </span>
                ))}
              </div>

              {/* Price */}
              {price ? (
                <div className="flex items-baseline justify-between pt-2 border-t border-gray-200">
                  <span className="text-xs text-gray-500">Ước tính</span>
                  <span className="text-lg font-bold text-primary-600">{price}</span>
                </div>
              ) : (
                <div className="pt-2 border-t border-gray-200">
                  <span className="text-xs text-gray-400">Giá sẽ được tính sau khi chọn điểm</span>
                </div>
              )}

              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute top-0 right-0 w-0 h-0 border-t-[40px] border-l-[40px] border-t-primary-500 border-l-transparent rounded-tr-xl">
                  <div className="absolute -top-9 -right-0 text-white">
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { vehicleOptions };
