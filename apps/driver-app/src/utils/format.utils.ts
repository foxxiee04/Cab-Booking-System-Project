import { format, formatDistanceToNow } from 'date-fns';
import { VehicleType, PaymentMethod, RideStatus } from '../types';
import i18n from '../i18n';

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
    ECONOMY: i18n.t('vehicle.ECONOMY'),
    COMFORT: i18n.t('vehicle.COMFORT'),
    PREMIUM: i18n.t('vehicle.PREMIUM'),
    CAR: i18n.t('vehicle.CAR'),
    SUV: i18n.t('vehicle.SUV'),
    MOTORCYCLE: i18n.t('vehicle.MOTORCYCLE'),
  };
  return labels[type] || type;
};

// Get payment method label
export const getPaymentMethodLabel = (method: PaymentMethod): string => {
  const labels: Record<PaymentMethod, string> = {
    CASH: i18n.t('payment.CASH'),
    CARD: i18n.t('payment.CARD'),
    WALLET: i18n.t('payment.WALLET'),
  };
  return labels[method] || method;
};

// Get ride status label
export const getRideStatusLabel = (status: RideStatus): string => {
  const labels: Record<RideStatus, string> = {
    PENDING: i18n.t('status.PENDING'),
    ASSIGNED: i18n.t('status.ASSIGNED'),
    ACCEPTED: i18n.t('status.ACCEPTED'),
    IN_PROGRESS: i18n.t('status.IN_PROGRESS'),
    COMPLETED: i18n.t('status.COMPLETED'),
    CANCELLED: i18n.t('status.CANCELLED'),
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
