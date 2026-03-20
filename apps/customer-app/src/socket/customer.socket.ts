import { io, Socket } from 'socket.io-client';
import { store } from '../store';
import { logout } from '../store/auth.slice';
import { setCurrentRide, setDriver, updateRideStatus, updateDriverLocation } from '../store/ride.slice';
import { showNotification } from '../store/ui.slice';
import { refreshAuthSession } from '../api/axios.config';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private authFailureHandled = false;

  private isAuthError(error: unknown) {
    const message = typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: string }).message || '')
        : '';

    return /invalid|expired|authentication|required|jwt/i.test(message);
  }

  private handleAuthFailure() {
    if (this.authFailureHandled) {
      return;
    }

    this.authFailureHandled = true;
    this.disconnect();

    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      store.dispatch(logout());
      store.dispatch(
        showNotification({
          type: 'warning',
          message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
        })
      );
      window.location.href = '/login';
      return;
    }

    void (async () => {
      try {
        const tokens = await refreshAuthSession();
        this.authFailureHandled = false;
        this.connect(tokens.accessToken);
      } catch {
        store.dispatch(logout());
        store.dispatch(
          showNotification({
            type: 'warning',
            message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
          })
        );
        window.location.href = '/login';
      }
    })();
  }

  /**
   * Connect to socket server
   */
  connect(token: string) {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
      upgrade: true,
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
      this.isConnected = true;
      this.authFailureHandled = false;
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      if (this.isAuthError(error)) {
        this.handleAuthFailure();
        return;
      }

      console.error('Socket connection error:', error);
      store.dispatch(
        showNotification({
          type: 'error',
          message: 'Connection error. Please check your internet connection.',
        })
      );
    });

    // Ride events - matching backend event names
    this.socket.on('RIDE_STATUS_UPDATE', (data: { rideId: string; status: string; message?: string; driverId?: string }) => {
      store.dispatch(updateRideStatus({ rideId: data.rideId, status: data.status }));

      if (data.message) {
        store.dispatch(
          showNotification({
            type: data.status === 'CANCELLED' ? 'warning' : data.status === 'COMPLETED' ? 'success' : 'info',
            message: data.message,
          })
        );
      }
    });

    this.socket.on('RIDE_COMPLETED', (data: { rideId: string; status: string; fare?: number; message: string }) => {
      store.dispatch(updateRideStatus({ rideId: data.rideId, status: 'COMPLETED' }));
      store.dispatch(
        showNotification({
          type: 'success',
          message: data.message || 'Ride completed successfully!',
        })
      );
    });

    // Legacy event names for backward compatibility
    this.socket.on('ride:assigned', (data: { ride: any; driver: any }) => {
      store.dispatch(setCurrentRide(data.ride));
      store.dispatch(setDriver(data.driver));
      store.dispatch(
        showNotification({
          type: 'success',
          message: `Driver ${data.driver.firstName} has been assigned to your ride!`,
        })
      );
    });

    this.socket.on('driver:location', (data: { lat: number; lng: number }) => {
      // console.log('📍 Driver location update:', data);
      store.dispatch(updateDriverLocation(data));
    });

    this.socket.on('ride:cancelled', (data: { rideId: string; reason: string }) => {
      store.dispatch(updateRideStatus({ rideId: data.rideId, status: 'CANCELLED' }));
      store.dispatch(
        showNotification({
          type: 'warning',
          message: `Ride cancelled: ${data.reason}`,
        })
      );
    });

    this.socket.on('ride:timeout', (data: { rideId: string }) => {
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
      console.warn('Socket not connected. Cannot emit event.');
    }
  }
}

export const socketService = new SocketService();
