import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { createClient } from 'redis';
import { config } from './config';

async function main() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(morgan('dev'));

  app.get('/health', (_, res) => {
    res.json({ status: 'ok', service: config.serviceName });
  });

  await mongoose.connect(config.mongodbUri);

  const redisClient = createClient({ url: config.redis.url });
  redisClient.on('error', (err) => {
    console.error('Redis Client Error', err);
  });
  await redisClient.connect();

  app.listen(config.port, () => {
    console.log(`Notification Service running on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
