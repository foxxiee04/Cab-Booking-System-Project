import { format, formatDistanceToNow } from 'date-fns';
import { VehicleType, PaymentMethod, RideStatus } from '../types';

// Format currency (VND)
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
};

// Format date
export const formatDate = (date: string | Date): string => {
  return format(new Date(date), 'dd/MM/yyyy HH:mm');
};

// Format time ago
export const formatTimeAgo = (date: string | Date): string => {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
};

// Format phone number
export const formatPhoneNumber = (phone: string): string => {
  if (!phone) return '';
  // Format Vietnamese phone: 0912345678 -> 091 234 5678
  return phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
};

// Get vehicle type label
export const getVehicleTypeLabel = (type: VehicleType): string => {
  const labels: Record<VehicleType, string> = {
    ECONOMY: 'Economy',
    COMFORT: 'Comfort',
    PREMIUM: 'Premium',
  };
  return labels[type] || type;
};

// Get payment method label
export const getPaymentMethodLabel = (method: PaymentMethod): string => {
  const labels: Record<PaymentMethod, string> = {
    CASH: 'Cash',
    MOMO: 'MoMo',
    VISA: 'Visa/Mastercard',
  };
  return labels[method] || method;
};

// Get ride status label
export const getRideStatusLabel = (status: RideStatus): string => {
  const labels: Record<RideStatus, string> = {
    PENDING: 'Finding driver...',
    ASSIGNED: 'Driver assigned',
    ACCEPTED: 'Driver on the way',
    IN_PROGRESS: 'In progress',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  };
  return labels[status] || status;
};

// Get ride status color
export const getRideStatusColor = (
  status: RideStatus
): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' => {
  const colors: Record<RideStatus, any> = {
    PENDING: 'warning',
    ASSIGNED: 'info',
    ACCEPTED: 'primary',
    IN_PROGRESS: 'secondary',
    COMPLETED: 'success',
    CANCELLED: 'error',
  };
  return colors[status] || 'default';
};

// Format earnings
export const formatEarnings = (amount: number): string => {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M VND`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}K VND`;
  }
  return `${amount} VND`;
};
