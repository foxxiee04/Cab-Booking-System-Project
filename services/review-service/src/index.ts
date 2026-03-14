import mongoose from 'mongoose';
import { createApp } from './app';
import { config } from './config';

export async function start() {
  console.log('📦 Connecting to MongoDB...');
  await mongoose.connect(config.mongodbUri);
  console.log('✅ MongoDB connected');

  const app = createApp({
    getReadiness: async () => ({
      mongodb: mongoose.connection.readyState === 1,
    }),
  });

  const server = app.listen(config.port, () => {
    console.log(`🚀 ${config.serviceName} running on port ${config.port}`);
  });

  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing connections...');
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
