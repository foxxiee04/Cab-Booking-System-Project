import { format, formatDistanceToNow } from 'date-fns';

/**
 * Format currency (VND)
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
};

/**
 * Format date
 */
export const formatDate = (date: string | Date): string => {
  return format(new Date(date), 'dd/MM/yyyy HH:mm');
};

/**
 * Format time ago
 */
export const formatTimeAgo = (date: string | Date): string => {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
};

/**
 * Format phone number
 */
export const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
};

/**
 * Get vehicle type label
 */
export const getVehicleTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    ECONOMY: 'Economy',
    COMFORT: 'Comfort',
    PREMIUM: 'Premium',
  };
  return labels[type] || type;
};

/**
 * Get payment method label
 */
export const getPaymentMethodLabel = (method: string): string => {
  const labels: Record<string, string> = {
    CASH: 'Cash',
    CARD: 'Card',
    WALLET: 'Wallet',
  };
  return labels[method] || method;
};

/**
 * Get ride status label
 */
export const getRideStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    PENDING: 'Finding driver...',
    ASSIGNED: 'Driver assigned',
    ACCEPTED: 'Driver on the way',
    IN_PROGRESS: 'In progress',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    NO_DRIVER_AVAILABLE: 'No driver available',
  };
  return labels[status] || status;
};

/**
 * Get ride status color
 */
export const getRideStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    PENDING: '#FF9800',
    ASSIGNED: '#2196F3',
    ACCEPTED: '#2196F3',
    IN_PROGRESS: '#4CAF50',
    COMPLETED: '#4CAF50',
    CANCELLED: '#F44336',
    NO_DRIVER_AVAILABLE: '#9E9E9E',
  };
  return colors[status] || '#9E9E9E';
};
