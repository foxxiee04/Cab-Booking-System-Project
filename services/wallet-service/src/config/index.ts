import dotenv from 'dotenv';
dotenv.config();

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} environment variable is required`);
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '3006', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  serviceName: process.env.SERVICE_NAME || 'wallet-service',

  database: {
    url: getRequiredEnv('DATABASE_URL'),
  },

  rabbitmq: {
    url: getRequiredEnv('RABBITMQ_URL'),
  },

  jwt: {
    secret: getRequiredEnv('JWT_SECRET'),
  },

  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN || 'change-me',

  services: {
    payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004',
  },

  wallet: {
    debtLimit:                  parseInt(process.env.DEBT_LIMIT                  || '-200000', 10),
    warningThreshold:           parseInt(process.env.WARNING_THRESHOLD           || '-100000', 10),
    initialActivationBalance:   parseInt(process.env.INITIAL_ACTIVATION_BALANCE  || '300000',  10),
    minWithdrawal:              parseInt(process.env.MIN_WITHDRAWAL               || '50000',   10),
  },

  bankSimulation: {
    // Set BANK_SIMULATION_ENABLED=false in production when a real payout API is wired up.
    enabled: (process.env.BANK_SIMULATION_ENABLED ?? 'true') !== 'false',
  },
};
