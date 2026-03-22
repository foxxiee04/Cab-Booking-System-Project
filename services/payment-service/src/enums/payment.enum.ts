export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  WALLET = 'WALLET',
  MOMO = 'MOMO',
  VNPAY = 'VNPAY',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

export enum PaymentProvider {
  CASH = 'CASH',
  MOCK = 'MOCK',
  STRIPE = 'STRIPE',
  MOMO = 'MOMO',
  VNPAY = 'VNPAY',
}

export enum Currency {
  VND = 'VND',
  USD = 'USD',
}

export enum RefundStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}
