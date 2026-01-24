'use client';

import { CreditCard, Wallet, Banknote } from 'lucide-react';
import { PaymentMethod } from '@/stores/ride-store';

interface PaymentOption {
  method: PaymentMethod;
  name: string;
  icon: React.ReactNode;
}

const paymentOptions: PaymentOption[] = [
  {
    method: 'CASH',
    name: 'Tiền mặt',
    icon: <Banknote className="w-5 h-5" />,
  },
  {
    method: 'CARD',
    name: 'Thẻ',
    icon: <CreditCard className="w-5 h-5" />,
  },
  {
    method: 'WALLET',
    name: 'Ví điện tử',
    icon: <Wallet className="w-5 h-5" />,
  },
];

interface Props {
  selected: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  disabled?: boolean;
}

export default function PaymentMethodSelector({ selected, onChange, disabled }: Props) {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Phương thức thanh toán
      </label>
      <div className="grid grid-cols-3 gap-2">
        {paymentOptions.map((option) => (
          <button
            key={option.method}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.method)}
            className={`
              relative p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2
              ${selected === option.method
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 bg-white hover:border-gray-300'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className={selected === option.method ? 'text-primary-600' : 'text-gray-400'}>
              {option.icon}
            </div>
            <div className="text-xs font-medium text-gray-800">{option.name}</div>
            {selected === option.method && (
              <div className="absolute top-1 right-1 w-2 h-2 bg-primary-500 rounded-full"></div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
