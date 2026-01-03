import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import { config } from './config';
import { SocketManager } from './socket/socket-manager';
import { EventConsumer } from './events/consumer';
import { logger } from './utils/logger';

const app = express();
const httpServer = createServer(app);

// Socket.IO setup with CORS
const io = new SocketServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

const socketManager = new SocketManager(io);
const eventConsumer = new EventConsumer(socketManager);

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'notification-service',
    connections: io.engine.clientsCount,
  });
});

// Stats endpoint
app.get('/stats', (req, res) => {
  res.json({
    connections: io.engine.clientsCount,
    rooms: io.sockets.adapter.rooms.size,
  });
});

// Startup
const start = async () => {
  try {
    await socketManager.initialize();
    await eventConsumer.connect();

    httpServer.listen(config.port, () => {
      logger.info(`Notification Service running on port ${config.port}`);
    });
  } catch (error) {
    logger.error('Failed to start Notification Service:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  await eventConsumer.close();
  await socketManager.close();
  httpServer.close();
  process.exit(0);
});

start();
