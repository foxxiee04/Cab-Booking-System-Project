import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { createClient } from 'redis';
import { config } from './config';
import routes from './routes';
import { connectRabbitMQ, closeRabbitMQ } from './events/rabbitmq.consumer';
import { emailService } from './services/email.service';
import { smsService } from './services/sms.service';

async function main() {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(morgan('dev'));

  // Health check
  app.get('/health', (_, res) => {
    res.json({ 
      status: 'ok', 
      service: config.serviceName,
      timestamp: new Date().toISOString(),
    });
  });

  // Connect to MongoDB
  console.log('📦 Connecting to MongoDB...');
  await mongoose.connect(config.mongodbUri);
  console.log('✅ MongoDB connected');

  // Connect to Redis
  console.log('📦 Connecting to Redis...');
  const redisClient = createClient({ url: config.redis.url });
  redisClient.on('error', (err) => {
    console.error('Redis Client Error', err);
  });
  await redisClient.connect();
  console.log('✅ Redis connected');

  // Initialize notification services
  await emailService.initialize();
  await smsService.initialize();

  // Connect to RabbitMQ and start consuming events
  await connectRabbitMQ();

  // API Routes
  app.use('/api', routes);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  // Start server
  app.listen(config.port, () => {
    console.log(`🚀 ${config.serviceName} running on port ${config.port}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing connections...');
    await closeRabbitMQ();
    await mongoose.connection.close();
    await redisClient.quit();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
