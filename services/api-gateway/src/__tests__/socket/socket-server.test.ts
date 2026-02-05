import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { SocketServer } from '../../socket/socket-server';
import { config } from '../../config';

describe('SocketServer', () => {
  let httpServer: HttpServer;
  let socketServer: SocketServer;
  let clientSocket: ClientSocket;
  let port: number;

  beforeAll((done) => {
    httpServer = require('http').createServer();
    httpServer.listen(() => {
      port = (httpServer.address() as any).port;
      socketServer = new SocketServer(httpServer);
      done();
    });
  });

  afterAll((done) => {
    socketServer.close().then(() => {
      httpServer.close(done);
    });
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Authentication', () => {
    it('should accept connection with valid JWT token', (done) => {
      const token = jwt.sign(
        { userId: 'customer-123', role: 'CUSTOMER' },
        config.jwtSecret
      );

      clientSocket = ioClient(`http://localhost:${port}`, {
        auth: { token },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('connect_error', (error) => {
        done(error);
      });
    });

    it('should reject connection without token', (done) => {
      clientSocket = ioClient(`http://localhost:${port}`, {
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not connect without token'));
      });

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication token required');
        done();
      });
    });

    it('should reject connection with invalid token', (done) => {
      clientSocket = ioClient(`http://localhost:${port}`, {
        auth: { token: 'invalid-token' },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not connect with invalid token'));
      });

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Invalid or expired token');
        done();
      });
    });

    it('should reject connection with expired token', (done) => {
      const expiredToken = jwt.sign(
        { userId: 'customer-123', role: 'CUSTOMER' },
        config.jwtSecret,
        { expiresIn: '-1h' } // Already expired
      );

      clientSocket = ioClient(`http://localhost:${port}`, {
        auth: { token: expiredToken },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not connect with expired token'));
      });

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Invalid or expired token');
        done();
      });
    });
  });

  describe('Room Management', () => {
    it('should join customer room after authentication', (done) => {
      const customerId = 'customer-456';
      const token = jwt.sign(
        { userId: customerId, role: 'CUSTOMER' },
        config.jwtSecret
      );

      clientSocket = ioClient(`http://localhost:${port}`, {
        auth: { token },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        // Wait a bit for room join
        setTimeout(() => {
          expect(socketServer.isUserOnline(customerId)).toBe(true);
          done();
        }, 100);
      });
    });

    it('should join driver room after authentication', (done) => {
      const driverId = 'driver-789';
      const token = jwt.sign(
        { userId: driverId, role: 'DRIVER' },
        config.jwtSecret
      );

      clientSocket = ioClient(`http://localhost:${port}`, {
        auth: { token },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        setTimeout(() => {
          expect(socketServer.isUserOnline(driverId)).toBe(true);
          done();
        }, 100);
      });
    });

    it('should handle multiple connections from same user', (done) => {
      const userId = 'multi-user-123';
      const token = jwt.sign(
        { userId, role: 'CUSTOMER' },
        config.jwtSecret
      );

      const socket1 = ioClient(`http://localhost:${port}`, {
        auth: { token },
        transports: ['websocket'],
      });

      const socket2 = ioClient(`http://localhost:${port}`, {
        auth: { token },
        transports: ['websocket'],
      });

      let connectedCount = 0;

      const checkConnections = () => {
        connectedCount++;
        if (connectedCount === 2) {
          setTimeout(() => {
            expect(socketServer.isUserOnline(userId)).toBe(true);
            socket1.disconnect();
            socket2.disconnect();
            done();
          }, 100);
        }
      };

      socket1.on('connect', checkConnections);
      socket2.on('connect', checkConnections);
    });
  });

  describe('Event Emission', () => {
    it('should emit event to specific customer', (done) => {
      const customerId = 'customer-emit-test';
      const token = jwt.sign(
        { userId: customerId, role: 'CUSTOMER' },
        config.jwtSecret
      );

      clientSocket = ioClient(`http://localhost:${port}`, {
        auth: { token },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        clientSocket.on('RIDE_STATUS_UPDATE', (data) => {
          expect(data.rideId).toBe('ride-123');
          expect(data.status).toBe('ACCEPTED');
          done();
        });

        // Wait for room join, then emit
        setTimeout(() => {
          socketServer.emitToCustomer(customerId, 'RIDE_STATUS_UPDATE', {
            rideId: 'ride-123',
            status: 'ACCEPTED',
          });
        }, 100);
      });
    });

    it('should emit event to specific driver', (done) => {
      const driverId = 'driver-emit-test';
      const token = jwt.sign(
        { userId: driverId, role: 'DRIVER' },
        config.jwtSecret
      );

      clientSocket = ioClient(`http://localhost:${port}`, {
        auth: { token },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        clientSocket.on('NEW_RIDE_AVAILABLE', (data) => {
          expect(data.bookingId).toBe('booking-456');
          expect(data.estimatedFare).toBe(25.5);
          done();
        });

        setTimeout(() => {
          socketServer.emitToDriver(driverId, 'NEW_RIDE_AVAILABLE', {
            bookingId: 'booking-456',
            estimatedFare: 25.5,
          });
        }, 100);
      });
    });

    it('should emit to both customer and driver', (done) => {
      const customerId = 'customer-both';
      const driverId = 'driver-both';

      const customerToken = jwt.sign(
        { userId: customerId, role: 'CUSTOMER' },
        config.jwtSecret
      );

      const driverToken = jwt.sign(
        { userId: driverId, role: 'DRIVER' },
        config.jwtSecret
      );

      const customerSocket = ioClient(`http://localhost:${port}`, {
        auth: { token: customerToken },
        transports: ['websocket'],
      });

      const driverSocket = ioClient(`http://localhost:${port}`, {
        auth: { token: driverToken },
        transports: ['websocket'],
      });

      let receivedCount = 0;
      const checkReceived = (data: any) => {
        expect(data.rideId).toBe('ride-both-test');
        receivedCount++;
        if (receivedCount === 2) {
          customerSocket.disconnect();
          driverSocket.disconnect();
          done();
        }
      };

      customerSocket.on('connect', () => {
        customerSocket.on('RIDE_COMPLETED', checkReceived);
      });

      driverSocket.on('connect', () => {
        driverSocket.on('RIDE_COMPLETED', checkReceived);
      });

      setTimeout(() => {
        socketServer.emitToCustomerAndDriver(
          customerId,
          driverId,
          'RIDE_COMPLETED',
          { rideId: 'ride-both-test' }
        );
      }, 200);
    });
  });

  describe('Connection Management', () => {
    it('should handle reconnection after disconnect', (done) => {
      const userId = 'reconnect-user';
      const token = jwt.sign(
        { userId, role: 'CUSTOMER' },
        config.jwtSecret
      );

      clientSocket = ioClient(`http://localhost:${port}`, {
        auth: { token },
        transports: ['websocket'],
        reconnection: false, // Disable auto-reconnect for manual control
      });

      let connectCount = 0;

      clientSocket.on('connect', () => {
        connectCount++;
        
        if (connectCount === 1) {
          // First connection
          expect(socketServer.isUserOnline(userId)).toBe(true);
          
          // Disconnect
          clientSocket.disconnect();
        } else if (connectCount === 2) {
          // Second connection (after manual reconnect)
          setTimeout(() => {
            expect(socketServer.isUserOnline(userId)).toBe(true);
            done();
          }, 200);
        }
      });

      clientSocket.on('disconnect', () => {
        setTimeout(() => {
          expect(socketServer.isUserOnline(userId)).toBe(false);
          
          // Manually reconnect
          clientSocket.connect();
        }, 200);
      });
    });

    it('should respond to ping with pong', (done) => {
      const token = jwt.sign(
        { userId: 'ping-user', role: 'CUSTOMER' },
        config.jwtSecret
      );

      clientSocket = ioClient(`http://localhost:${port}`, {
        auth: { token },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('ping');
        
        clientSocket.on('pong', () => {
          expect(true).toBe(true);
          done();
        });
      });
    });
  });

  describe('User Status Tracking', () => {
    it('should track user as online when connected', (done) => {
      const userId = 'online-user';
      const token = jwt.sign(
        { userId, role: 'CUSTOMER' },
        config.jwtSecret
      );

      clientSocket = ioClient(`http://localhost:${port}`, {
        auth: { token },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        setTimeout(() => {
          expect(socketServer.isUserOnline(userId)).toBe(true);
          done();
        }, 100);
      });
    });

    it('should track user as offline when disconnected', (done) => {
      const userId = 'offline-user';
      const token = jwt.sign(
        { userId, role: 'CUSTOMER' },
        config.jwtSecret
      );

      clientSocket = ioClient(`http://localhost:${port}`, {
        auth: { token },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        setTimeout(() => {
          expect(socketServer.isUserOnline(userId)).toBe(true);
          
          clientSocket.disconnect();
          
          setTimeout(() => {
            expect(socketServer.isUserOnline(userId)).toBe(false);
            done();
          }, 100);
        }, 100);
      });
    });
  });
});
