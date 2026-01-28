// Mock dependencies before imports
const mockSocketManager = {
  emitToUser: jest.fn(),
  emitToDriver: jest.fn(),
  emitToRoom: jest.fn(),
  notifyUser: jest.fn(),
  notifyDriver: jest.fn(),
  notifyRide: jest.fn(),
};

jest.mock('amqplib');
jest.mock('axios');
jest.mock('../socket/socket-manager', () => ({
  SocketManager: jest.fn(() => mockSocketManager),
}));
jest.mock('../config', () => ({
  config: {
    rabbitmqUrl: 'amqp://localhost:5672',
    internalToken: 'test-token',
    services: {
      ride: 'http://ride-service:3002',
      driver: 'http://driver-service:3003',
      user: 'http://user-service:3004',
    },
  },
}));

import { EventConsumer } from '../events/consumer';
import { SocketManager } from '../socket/socket-manager';

describe('NotificationService - EventConsumer Tests', () => {
  let eventConsumer: EventConsumer;
  let mockChannel: any;
  let mockConnection: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockChannel = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      assertQueue: jest.fn().mockResolvedValue(undefined),
      bindQueue: jest.fn().mockResolvedValue(undefined),
      prefetch: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn(),
      ack: jest.fn(),
      nack: jest.fn(),
    };

    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
    };

    const amqplib = require('amqplib');
    amqplib.connect = jest.fn().mockResolvedValue(mockConnection);

    mockSocketManager.emitToUser.mockReset();
    mockSocketManager.emitToDriver.mockReset();
    mockSocketManager.emitToRoom.mockReset();
    mockSocketManager.notifyUser.mockReset();
    mockSocketManager.notifyDriver.mockReset();
    mockSocketManager.notifyRide.mockReset();

    eventConsumer = new EventConsumer(mockSocketManager as any);
  });

  describe('CONNECTION', () => {
    it('should connect to RabbitMQ successfully', async () => {
      await eventConsumer.connect();

      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.assertExchange).toHaveBeenCalledWith(
        'domain-events',
        'topic',
        { durable: true }
      );
      expect(mockChannel.assertQueue).toHaveBeenCalled();
    });

    it('should bind to all relevant events', async () => {
      await eventConsumer.connect();

      const events = [
        'ride.created',
        'ride.assigned',
        'ride.accepted',
        'ride.started',
        'ride.completed',
        'ride.cancelled',
        'ride.assignment.requested',
        'payment.completed',
        'payment.failed',
        'driver.location.updated',
      ];

      events.forEach(event => {
        expect(mockChannel.bindQueue).toHaveBeenCalledWith(
          'notification-service-queue',
          'domain-events',
          event
        );
      });
    });

    it('should throw error if connection fails', async () => {
      const amqplib = require('amqplib');
      amqplib.connect = jest.fn().mockRejectedValue(new Error('Connection failed'));

      await expect(eventConsumer.connect()).rejects.toThrow('Connection failed');
    });
  });

  describe('EVENT HANDLING', () => {
    it('should process ride.created event', async () => {
      await eventConsumer.connect();

      const consumeCallback = mockChannel.consume.mock.calls[0][1];
      
      const message = {
        content: Buffer.from(JSON.stringify({
          eventType: 'ride.created',
          payload: {
            rideId: 'ride-123',
            customerId: 'customer-123',
          },
        })),
      };

      await consumeCallback(message);

      expect(mockChannel.ack).toHaveBeenCalledWith(message);
    });

    it('should handle invalid message format', async () => {
      await eventConsumer.connect();

      const consumeCallback = mockChannel.consume.mock.calls[0][1];
      
      const message = {
        content: Buffer.from('invalid json'),
      };

      await consumeCallback(message);

      expect(mockChannel.nack).toHaveBeenCalledWith(message, false, false);
    });

    it('should ignore null messages', async () => {
      await eventConsumer.connect();

      const consumeCallback = mockChannel.consume.mock.calls[0][1];
      
      await consumeCallback(null);

      expect(mockChannel.ack).not.toHaveBeenCalled();
      expect(mockChannel.nack).not.toHaveBeenCalled();
    });
  });

  describe('SOCKET NOTIFICATIONS', () => {
    it('should notify users through socket manager', () => {
      expect(mockSocketManager.notifyUser).toBeDefined();
      expect(mockSocketManager.notifyDriver).toBeDefined();
      expect(mockSocketManager.notifyRide).toBeDefined();
    });
  });
});
