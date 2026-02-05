import { format, formatDistanceToNow } from 'date-fns';

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

// Format number with K/M suffix
export const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};

// Get ride status color
export const getRideStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'success' => {
  const colors: Record<string, any> = {
    PENDING: 'warning',
    ASSIGNED: 'info',
    ACCEPTED: 'primary',
    IN_PROGRESS: 'secondary',
    COMPLETED: 'success',
    CANCELLED: 'error',
  };
  return colors[status] || 'default';
};

// Get payment status color
export const getPaymentStatusColor = (status: string): 'default' | 'success' | 'error' | 'warning' => {
  const colors: Record<string, any> = {
    PENDING: 'warning',
    COMPLETED: 'success',
    FAILED: 'error',
  };
  return colors[status] || 'default';
};
