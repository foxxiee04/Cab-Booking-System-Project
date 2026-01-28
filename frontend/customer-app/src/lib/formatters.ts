export const vehicleIcons = {
  ECONOMY: '🚗',
  COMFORT: '🚙', 
  PREMIUM: '🚘',
  SUV: '🚐',
  BIKE: '🏍️',
  CAR: '🚕',
} as const;

export const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  ACCEPTED: 'bg-blue-100 text-blue-800 border-blue-200',
  ARRIVED: 'bg-purple-100 text-purple-800 border-purple-200',
  IN_PROGRESS: 'bg-green-100 text-green-800 border-green-200',
  COMPLETED: 'bg-gray-100 text-gray-800 border-gray-200',
  CANCELLED: 'bg-red-100 text-red-800 border-red-200',
} as const;

export const statusLabels = {
  PENDING: 'Đang tìm tài xế',
  ACCEPTED: 'Đã nhận chuyến',
  ARRIVED: 'Tài xế đã đến',
  IN_PROGRESS: 'Đang di chuyển',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
} as const;

export const paymentMethodLabels = {
  CASH: 'Tiền mặt',
  CARD: 'Thẻ',
  WALLET: 'Ví điện tử',
  MOMO: 'MoMo',
  ZALOPAY: 'ZaloPay',
} as const;

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.ceil(minutes)} phút`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.ceil(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}p` : `${hours}h`;
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function getStatusColor(status: keyof typeof statusColors): string {
  return statusColors[status] || statusColors.PENDING;
}

export function getStatusLabel(status: keyof typeof statusLabels): string {
  return statusLabels[status] || status;
}

export function getVehicleIcon(vehicleType: string): string {
  return vehicleIcons[vehicleType as keyof typeof vehicleIcons] || '🚗';
}

export function truncateAddress(address: string, maxLength: number = 50): string {
  if (address.length <= maxLength) return address;
  return address.substring(0, maxLength) + '...';
}
