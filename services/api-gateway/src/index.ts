import { createServer } from 'http';
import { config } from './config';
import { createApp } from './app';
import { logger } from './utils/logger';
import { SocketServer } from './socket/socket-server';
import { EventConsumer } from './events/consumer';

export async function start() {
  const app = createApp({
    getReadiness: async () => ({
      redis: socketServer.isReady(),
      rabbitmq: eventConsumer.isConnected(),
    }),
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

    const shutdown = async () => {
      logger.info('Shutting down API Gateway gracefully');
      await eventConsumer.close();
      await socketServer.close();
      httpServer.close();
    };

    process.on('SIGTERM', async () => {
      await shutdown();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      await shutdown();
      process.exit(0);
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
