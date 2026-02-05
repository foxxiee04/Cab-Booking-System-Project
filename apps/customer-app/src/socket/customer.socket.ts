import { io, Socket } from 'socket.io-client';
import { store } from '../store';
import { setCurrentRide, setDriver, updateRideStatus, updateDriverLocation } from '../store/ride.slice';
import { showNotification } from '../store/ui.slice';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;

  /**
   * Connect to socket server
   */
  connect(token: string) {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.setupEventListeners();
  }

  /**
   * Setup socket event listeners
   */
  private setupEventListeners() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
      this.isConnected = true;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      store.dispatch(
        showNotification({
          type: 'error',
          message: 'Connection error. Please check your internet connection.',
        })
      );
    });

    // Ride events
    this.socket.on('ride:assigned', (data: { ride: any; driver: any }) => {
      console.log('🚗 Ride assigned:', data);
      store.dispatch(setCurrentRide(data.ride));
      store.dispatch(setDriver(data.driver));
      store.dispatch(
        showNotification({
          type: 'success',
          message: `Driver ${data.driver.firstName} has been assigned to your ride!`,
        })
      );
    });

    this.socket.on('ride:accepted', (data: { rideId: string }) => {
      console.log('✅ Ride accepted:', data);
      store.dispatch(updateRideStatus({ rideId: data.rideId, status: 'ACCEPTED' }));
      store.dispatch(
        showNotification({
          type: 'success',
          message: 'Driver is on the way!',
        })
      );
    });

    this.socket.on('ride:status', (data: { rideId: string; status: string }) => {
      console.log('📝 Ride status update:', data);
      store.dispatch(updateRideStatus(data));

      const statusMessages: Record<string, string> = {
        IN_PROGRESS: 'Ride has started',
        COMPLETED: 'Ride completed',
        CANCELLED: 'Ride was cancelled',
      };

      if (statusMessages[data.status]) {
        store.dispatch(
          showNotification({
            type: data.status === 'CANCELLED' ? 'warning' : 'info',
            message: statusMessages[data.status],
          })
        );
      }
    });

    this.socket.on('driver:location', (data: { lat: number; lng: number }) => {
      // console.log('📍 Driver location update:', data);
      store.dispatch(updateDriverLocation(data));
    });

    this.socket.on('ride:cancelled', (data: { rideId: string; reason: string }) => {
      console.log('❌ Ride cancelled:', data);
      store.dispatch(updateRideStatus({ rideId: data.rideId, status: 'CANCELLED' }));
      store.dispatch(
        showNotification({
          type: 'warning',
          message: `Ride cancelled: ${data.reason}`,
        })
      );
    });

    this.socket.on('ride:timeout', (data: { rideId: string }) => {
      console.log('⏱️ Ride timeout:', data);
      store.dispatch(
        showNotification({
          type: 'warning',
          message: 'Searching for another driver...',
        })
      );
    });
  }

  /**
   * Disconnect from socket server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      console.log('Socket disconnected');
    }
  }

  /**
   * Check if socket is connected
   */
  isSocketConnected(): boolean {
    return this.isConnected && !!this.socket?.connected;
  }

  /**
   * Emit event to server
   */
  emit(event: string, data?: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected. Cannot emit event:', event);
    }
  }
}

export const socketService = new SocketService();
