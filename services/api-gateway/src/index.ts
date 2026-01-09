import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { authMiddleware } from './middleware/auth';
import { generalLimiter } from './middleware/rate-limit';
import proxyRoutes from './routes/proxy';
import { logger } from './utils/logger';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: '*', // Configure for production
  credentials: true,
}));

// Request logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) },
}));

// Rate limiting - DISABLED FOR TESTING
// app.use(generalLimiter);

// Health check (before auth)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
  });
});

// Service health aggregation
app.get('/health/services', async (req, res) => {
  const services = config.services;
  const results: Record<string, string> = {};

  for (const [name, url] of Object.entries(services)) {
    try {
      const response = await fetch(`${url}/health`);
      results[name] = response.ok ? 'healthy' : 'unhealthy';
    } catch {
      results[name] = 'unreachable';
    }
  }

  res.json({
    gateway: 'healthy',
    services: results,
    timestamp: new Date().toISOString(),
  });
});

// Authentication middleware
app.use(authMiddleware);

// Proxy routes to microservices
app.use(proxyRoutes);

// Parse JSON for any non-proxy routes below (avoid consuming body before proxying)
app.use(express.json({ limit: '10mb' }));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.path,
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
});

// Start server
app.listen(config.port, () => {
  logger.info(`API Gateway running on port ${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
});
