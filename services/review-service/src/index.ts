import mongoose from 'mongoose';
import { createApp } from './app';
import { config } from './config';
import { createHealthServiceRegistration, createHttpBridgeServiceRegistration, shutdownGrpcServer, startGrpcServer } from '../../../shared/dist';

export async function start() {
  console.log('📦 Connecting to MongoDB...');
  await mongoose.connect(config.mongodbUri);
  console.log('✅ MongoDB connected');
  const getReadiness = async () => ({
    mongodb: mongoose.connection.readyState === 1,
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
    await mongoose.connection.close();
    server.close();
    process.exit(0);
  });

  return { app, server };
}

if (require.main === module) {
  start().catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
}
