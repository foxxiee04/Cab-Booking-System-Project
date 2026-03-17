import mongoose from 'mongoose';
import { createClient } from 'redis';
import { createApp } from './app';
import { config } from './config';
import { connectRabbitMQ, closeRabbitMQ, isRabbitMQConnected } from './events/rabbitmq.consumer';
import { emailService } from './services/email.service';
import { smsService } from './services/sms.service';
import { createHealthServiceRegistration, createHttpBridgeServiceRegistration, shutdownGrpcServer, startGrpcServer } from '../../../shared/dist';

export async function start() {
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

  await connectRabbitMQ();
  const getReadiness = async () => ({
    mongodb: mongoose.connection.readyState === 1,
    redis: redisClient.isOpen && (await redisClient.ping()) === 'PONG',
    rabbitmq: isRabbitMQConnected(),
  });

  const app = createApp({
    getReadiness,
  });

  const grpcServer = await startGrpcServer({
    address: `0.0.0.0:${config.grpcPort}`,
    registrations: [
      createHealthServiceRegistration(config.serviceName, getReadiness),
      createHttpBridgeServiceRegistration(`http://127.0.0.1:${config.port}`),
    ],
  });

  const server = app.listen(config.port, () => {
    console.log(`🚀 ${config.serviceName} running on port ${config.port}`);
    console.log(`🚀 ${config.serviceName} gRPC running on port ${config.grpcPort}`);
  });

  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing connections...');
    await shutdownGrpcServer(grpcServer);
    await closeRabbitMQ();
    await mongoose.connection.close();
    await redisClient.quit();
    server.close();
    process.exit(0);
  });

  return { app, server, redisClient };
}

if (require.main === module) {
  start().catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
}
