import dotenv from 'dotenv';

dotenv.config();

export const config = {
  serviceName: 'review-service',
  port: parseInt(process.env.PORT || '3010', 10),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/review_db',
};
