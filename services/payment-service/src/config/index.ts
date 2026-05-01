import dotenv from 'dotenv';
dotenv.config();

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }

  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '3004', 10),
  grpcPort: parseInt(process.env.GRPC_PORT || '50056', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: getRequiredEnv('DATABASE_URL'),
  },
  
  rabbitmq: {
    url: getRequiredEnv('RABBITMQ_URL'),
  },
  
  jwt: {
    secret: getRequiredEnv('JWT_SECRET'),
  },
  
  serviceName: process.env.SERVICE_NAME || 'payment-service',

  services: {
    driver: process.env.DRIVER_SERVICE_URL || 'http://localhost:3003',
    wallet: process.env.WALLET_SERVICE_URL || 'http://localhost:3006',
  },

  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN || 'change-me',

  booking: {
    callbackUrl: process.env.BOOKING_PAYMENT_CALLBACK_URL || '',
  },
  
  // Fare policy (in VND)
  farePolicy: {
    baseFare: parseInt(process.env.BASE_FARE || '15000', 10),
    perKmRate: parseInt(process.env.PER_KM_RATE || '12000', 10),
    perMinuteRate: parseInt(process.env.PER_MINUTE_RATE || '2000', 10),
  },

  // Commission & earnings policy
  commission: {
    // Base rates per vehicle class (0.0–1.0)
    rateEconomy: parseFloat(process.env.COMMISSION_RATE_ECONOMY || '0.20'),
    rateComfort:  parseFloat(process.env.COMMISSION_RATE_COMFORT  || '0.20'),
    ratePremium:  parseFloat(process.env.COMMISSION_RATE_PREMIUM  || '0.20'),
    // Incentive bonuses (VND)
    peakHourBonus:         parseInt(process.env.INCENTIVE_PEAK_HOUR_BONUS         || '15000', 10),
    tripMilestoneBonus:    parseInt(process.env.INCENTIVE_TRIP_MILESTONE_BONUS    || '50000', 10),
    tripMilestoneInterval: parseInt(process.env.INCENTIVE_TRIP_MILESTONE_INTERVAL || '10',    10),
    highRatingBonus:       parseInt(process.env.INCENTIVE_HIGH_RATING_BONUS       || '10000', 10),
    highRatingThreshold:   parseFloat(process.env.INCENTIVE_HIGH_RATING_THRESHOLD || '4.8'),
    highAcceptanceBonus:   parseInt(process.env.INCENTIVE_HIGH_ACCEPTANCE_BONUS   || '5000',  10),
    acceptanceThreshold:   parseFloat(process.env.INCENTIVE_ACCEPTANCE_THRESHOLD  || '0.95'),
    // Penalty rates (fraction of grossFare)
    highCancelThreshold:      parseFloat(process.env.PENALTY_HIGH_CANCEL_THRESHOLD      || '0.10'),
    highCancelPenalty:        parseFloat(process.env.PENALTY_HIGH_CANCEL_RATE            || '0.05'),
    veryHighCancelThreshold:  parseFloat(process.env.PENALTY_VERY_HIGH_CANCEL_THRESHOLD || '0.20'),
    veryHighCancelPenalty:    parseFloat(process.env.PENALTY_VERY_HIGH_CANCEL_RATE       || '0.10'),
    lowAcceptanceThreshold:   parseFloat(process.env.PENALTY_LOW_ACCEPTANCE_THRESHOLD   || '0.70'),
    lowAcceptancePenalty:     parseFloat(process.env.PENALTY_LOW_ACCEPTANCE_RATE         || '0.05'),
  },
  
  // Stripe removed — not used in this project (Vietnamese market: MoMo + VNPay only)

  // MoMo Configuration
  momo: {
    enabled: process.env.MOMO_ENABLED === 'true',
    partnerCode: process.env.MOMO_PARTNER_CODE || '',
    accessKey: process.env.MOMO_ACCESS_KEY || '',
    secretKey: process.env.MOMO_SECRET_KEY || '',
    endpoint: process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn',
    requestType: process.env.MOMO_REQUEST_TYPE || 'payWithMethod',
    partnerName: process.env.MOMO_PARTNER_NAME || 'CabBooking',
    storeId: process.env.MOMO_STORE_ID || 'CabBookingStore',
    autoCapture: process.env.MOMO_AUTO_CAPTURE !== 'false',
    paymentCode: process.env.MOMO_PAYMENT_CODE || '',
    notifyUrl: process.env.MOMO_NOTIFY_URL || '',
    returnUrl: process.env.MOMO_RETURN_URL || '',
  },
  
  // ZaloPay removed — not used in this project (Vietnamese market: MoMo + VNPay only)

  // VNPay Configuration
  vnpay: {
    enabled: process.env.VNPAY_ENABLED === 'true',
    tmnCode: process.env.VNPAY_TMN_CODE || '',
    hashSecret: process.env.VNPAY_HASH_SECRET || '',
    url: process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    returnUrl: process.env.VNPAY_RETURN_URL || 'http://localhost:3000/payments/vnpay/return',
    apiUrl: process.env.VNPAY_API_URL || 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
  },
};
