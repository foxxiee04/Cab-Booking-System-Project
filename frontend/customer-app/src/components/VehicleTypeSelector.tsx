'use client';

import { Car } from 'lucide-react';
import { VehicleType } from '@/stores/ride-store';

interface VehicleOption {
  type: VehicleType;
  name: string;
  description: string;
  baseFare: string;
  icon: string;
}

const vehicleOptions: VehicleOption[] = [
  {
    type: 'ECONOMY',
    name: 'Economy',
    description: 'Giá rẻ, tiết kiệm',
    baseFare: '15k',
    icon: '🚗',
  },
  {
    type: 'COMFORT',
    name: 'Comfort',
    description: 'Thoải mái hơn',
    baseFare: '25k',
    icon: '🚙',
  },
  {
    type: 'PREMIUM',
    name: 'Premium',
    description: 'Sang trọng, cao cấp',
    baseFare: '35k',
    icon: '🚘',
  },
];

interface Props {
  selected: VehicleType;
  onChange: (type: VehicleType) => void;
  disabled?: boolean;
}

export default function VehicleTypeSelector({ selected, onChange, disabled }: Props) {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Loại xe
      </label>
      <div className="grid grid-cols-3 gap-2">
        {vehicleOptions.map((option) => (
          <button
            key={option.type}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.type)}
            className={`
              relative p-3 rounded-lg border-2 transition-all
              ${selected === option.type
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 bg-white hover:border-gray-300'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className="text-2xl mb-1">{option.icon}</div>
            <div className="text-xs font-semibold text-gray-800">{option.name}</div>
            <div className="text-xs text-gray-500 mt-1">{option.baseFare}</div>
            {selected === option.type && (
              <div className="absolute top-1 right-1 w-2 h-2 bg-primary-500 rounded-full"></div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
