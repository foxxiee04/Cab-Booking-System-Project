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
  serviceName: 'user-service',
  port: parseInt(process.env.PORT || '3007', 10),
  database: {
    url: getRequiredEnv('DATABASE_URL'),
  },
};
