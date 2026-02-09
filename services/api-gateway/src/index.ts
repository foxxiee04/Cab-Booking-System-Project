import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { authMiddleware } from './middleware/auth';
import { generalLimiter } from './middleware/rate-limit';
import proxyRoutes from './routes/proxy';
import mapRoutes from './routes/map';
import adminRoutes from './routes/admin';
import { logger } from './utils/logger';
import { SocketServer } from './socket/socket-server';
import { EventConsumer } from './events/consumer';
import { swaggerSpec } from './swagger';

const app = express();
const httpServer = createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for Swagger UI
}));
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

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Check API Gateway health
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 service:
 *                   type: string
 *                   example: api-gateway
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @swagger
 * /health/services:
 *   get:
 *     summary: Check all microservices health
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Health status of all services
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 gateway:
 *                   type: string
 *                   example: healthy
 *                 services:
 *                   type: object
 *                   additionalProperties:
 *                     type: string
 *                     enum: [healthy, unhealthy, unreachable]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
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

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Cab Booking System API',
}));

// Map proxy endpoints (public)
app.use('/api/map', mapRoutes);

// Authentication middleware
app.use(authMiddleware);

// Admin aggregation routes
app.use('/api/admin', adminRoutes);

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

// Initialize Socket.io server
const socketServer = new SocketServer(httpServer);

// Initialize event consumer
const eventConsumer = new EventConsumer(socketServer);

// Start server
async function startServer() {
  try {
    // Connect to RabbitMQ
    await eventConsumer.connect();
    logger.info('Connected to RabbitMQ event bus');

    // Start HTTP server
    httpServer.listen(config.port, () => {
      logger.info(`API Gateway running on port ${config.port}`);
      logger.info(`WebSocket server ready`);
      logger.info(`Environment: ${config.nodeEnv}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await eventConsumer.close();
      await socketServer.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      await eventConsumer.close();
      await socketServer.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
