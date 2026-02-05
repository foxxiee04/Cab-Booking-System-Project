import dotenv from 'dotenv';

dotenv.config();

export const config = {
  serviceName: 'user-service',
  port: parseInt(process.env.PORT || '3007', 10),
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/user_db',
  },
};
