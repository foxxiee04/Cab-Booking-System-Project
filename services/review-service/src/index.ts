import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { config } from './config';
import routes from './routes';

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
    await mongoose.connection.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
