export enum RideStatus {
  CREATED = 'CREATED',
  FINDING_DRIVER = 'FINDING_DRIVER',
  ASSIGNED = 'ASSIGNED',
  ACCEPTED = 'ACCEPTED',
  PICKING_UP = 'PICKING_UP',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
}

export enum VehicleType {
  MOTORBIKE = 'MOTORBIKE',
  SCOOTER = 'SCOOTER',
  CAR_4 = 'CAR_4',
  CAR_7 = 'CAR_7',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  WALLET = 'WALLET',
  MOMO = 'MOMO',
  VNPAY = 'VNPAY',
}

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN',
}

export enum CancellationType {
  CUSTOMER = 'CUSTOMER',
  DRIVER = 'DRIVER',
  SYSTEM = 'SYSTEM',
}
