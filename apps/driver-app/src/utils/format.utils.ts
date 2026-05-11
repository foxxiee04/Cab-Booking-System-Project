import { format, formatDistanceToNow } from 'date-fns';
import { vi as viLocale } from 'date-fns/locale';
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

// Format time ago (Vietnamese)
export const formatTimeAgo = (date: string | Date): string => {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: viLocale });
};

// Format phone number
export const formatPhoneNumber = (phone: string): string => {
  if (!phone) return '';
  // Format Vietnamese phone: 0912345678 -> 091 234 5678
  return phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
};

// Vietnamese license plate formats:
//   Car  (1 letter): 50A-123.45  (2 digits + 1 letter + dash + 3 digits + dot + 2 digits)
//   Moto (2 letters): 50AC-123.45 (2 digits + 2 letters + dash + 3 digits + dot + 2 digits)
//   Legacy (no dot): 50A-12345 / 50AC-12345
const LICENSE_PLATE_REGEX_GENERIC = /^\d{2}[A-Z]{1,2}-(\d{3}\.\d{2}|\d{5})$/;
const LICENSE_PLATE_REGEX_CAR = /^\d{2}[A-Z]{1}-(\d{3}\.\d{2}|\d{5})$/;
const LICENSE_PLATE_REGEX_MOTO = /^\d{2}[A-Z]{2}-(\d{3}\.\d{2}|\d{5})$/;

export const sanitizeLicensePlateInput = (licensePlate: string): string => {
  const normalized = licensePlate.toUpperCase().replace(/\s+/g, '');
  return normalized.replace(/[^0-9A-Z.-]/g, '').slice(0, 11);
};

export const isValidLicensePlate = (licensePlate: string, vehicleType?: VehicleType): boolean => {
  const value = licensePlate.trim().toUpperCase();
  if (vehicleType === 'CAR_4' || vehicleType === 'CAR_7') {
    return LICENSE_PLATE_REGEX_CAR.test(value);
  }
  if (vehicleType === 'MOTORBIKE' || vehicleType === 'SCOOTER') {
    return LICENSE_PLATE_REGEX_MOTO.test(value);
  }
  return LICENSE_PLATE_REGEX_GENERIC.test(value);
};

export const getLicensePlateHint = (vehicleType?: VehicleType): string => {
  if (vehicleType === 'CAR_4' || vehicleType === 'CAR_7') {
    return 'Ô tô: 50A-123.45 (2 số + 1 chữ + 5 số)';
  }
  if (vehicleType === 'MOTORBIKE' || vehicleType === 'SCOOTER') {
    return 'Xe máy/ga: 50AC-123.45 (2 số + 2 chữ + 5 số)';
  }
  return 'Ô tô: 50A-123.45 · Xe máy/ga: 50AC-123.45';
};

export const normalizeLicensePlate = (licensePlate: string): string => {
  const raw = sanitizeLicensePlateInput(licensePlate).trim();
  // Match: PREFIX-NNN.NN (already normalized with dot)
  const matchDot = raw.match(/^(\d{2}[A-Z]{1,2})-?(\d{3})\.?(\d{2})$/);
  if (matchDot) {
    const [, prefix, first3, last2] = matchDot;
    return `${prefix}-${first3}.${last2}`;
  }
  // Match: PREFIX-NNNNN or PREFIX+NNNNN (5 digits no dot) → auto-format with dot
  const matchNoDot = raw.match(/^(\d{2}[A-Z]{1,2})-?(\d{5})$/);
  if (matchNoDot) {
    const [, prefix, digits] = matchNoDot;
    return `${prefix}-${digits.slice(0, 3)}.${digits.slice(3)}`;
  }
  return raw;
};

// Get vehicle type label
export const getVehicleTypeLabel = (type?: VehicleType): string => {
  if (!type) return i18n.t('vehicle.CAR_4');
  const labels: Record<VehicleType, string> = {
    MOTORBIKE: i18n.t('vehicle.MOTORBIKE'),
    SCOOTER: i18n.t('vehicle.SCOOTER'),
    CAR_4: i18n.t('vehicle.CAR_4'),
    CAR_7: i18n.t('vehicle.CAR_7'),
  };
  return labels[type] || type;
};

// Get payment method label
export const getPaymentMethodLabel = (method: PaymentMethod): string => {
  const labels: Record<PaymentMethod, string> = {
    CASH: i18n.t('payment.CASH'),
    CARD: i18n.t('payment.CARD'),
    WALLET: i18n.t('payment.WALLET'),
    MOMO: 'MoMo',
    VNPAY: 'VNPay QR/Ngân hàng',
  };
  return labels[method] || method;
};

// Get ride status label
export const getRideStatusLabel = (status: RideStatus): string => {
  const labels: Record<RideStatus, string> = {
    PENDING: i18n.t('status.PENDING'),
    ASSIGNED: i18n.t('status.ASSIGNED'),
    ACCEPTED: i18n.t('status.ACCEPTED'),
    PICKING_UP: i18n.t('status.PICKING_UP', 'Đang đón khách'),
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
    PICKING_UP: 'primary',
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
