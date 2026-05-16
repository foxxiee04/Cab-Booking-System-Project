import { createServer } from 'http';
import { config } from './config';
import { createApp } from './app';
import { logger } from './utils/logger';
import { SocketServer } from './socket/socket-server';
import { EventConsumer } from './events/consumer';
import { closeMapRedis } from './routes/map';
import { closeLocationRedis } from './location/location.controller';
import { createServiceHealthChecker } from './grpc/health';

export async function start() {
  const serviceHealthChecker = createServiceHealthChecker();
  const app = createApp({
    getReadiness: async () => ({
      redis: socketServer.isReady(),
      rabbitmq: eventConsumer.isConnected(),
    }),
    serviceHealthChecker,
    enableRateLimit: true,
  });
  const httpServer = createServer(app);
  const socketServer = new SocketServer(httpServer);
  const eventConsumer = new EventConsumer(socketServer);

  try {
    await eventConsumer.connect();
    logger.info('Connected to RabbitMQ event bus');

    await new Promise<void>((resolve) => {
      httpServer.listen(config.port, () => {
        logger.info(`API Gateway running on port ${config.port}`);
        logger.info('WebSocket server ready');
        logger.info(`Environment: ${config.nodeEnv}`);
        resolve();
      });
    });

    let shuttingDown = false;
    const shutdown = async () => {
      if (shuttingDown) {
        return;
      }
      shuttingDown = true;
      logger.info('Shutting down API Gateway gracefully');
      try {
        await eventConsumer.close();
      } catch (e) {
        logger.warn('EventConsumer close error (ignored during shutdown)', e);
      }
      try {
        await socketServer.close();
      } catch (e) {
        logger.warn('Socket server close error (ignored during shutdown)', e);
      }
      try {
        await closeMapRedis();
      } catch (e) {
        logger.warn('Map Redis close error (ignored during shutdown)', e);
      }
      try {
        await closeLocationRedis();
      } catch (e) {
        logger.warn('Location Redis close error (ignored during shutdown)', e);
      }

      await new Promise<void>((resolve) => {
        if (!httpServer.listening) {
          resolve();
          return;
        }
        httpServer.close((error) => {
          if (!error) {
            resolve();
            return;
          }
          const code = (error as NodeJS.ErrnoException).code;
          if (code === 'ERR_SERVER_NOT_RUNNING') {
            resolve();
            return;
          }
          logger.error('httpServer.close error during shutdown', error);
          resolve();
        });
      });
    };

    process.on('SIGTERM', () => {
      void shutdown().then(() => process.exit(0)).catch((e) => {
        logger.error('Shutdown error', e);
        process.exit(1);
      });
    });

    process.on('SIGINT', () => {
      void shutdown().then(() => process.exit(0)).catch((e) => {
        logger.error('Shutdown error', e);
        process.exit(1);
      });
    });

    return { app, httpServer, socketServer, eventConsumer };
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  start().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}
