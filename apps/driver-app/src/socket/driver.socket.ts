import { io, Socket } from 'socket.io-client';
import { store } from '../store';
import { setPendingRide, clearPendingRide, updateRideStatus } from '../store/ride.slice';
import { showNotification } from '../store/ui.slice';
import { Ride } from '../types';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';

class DriverSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(accessToken: string) {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    this.socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.socket.on('connect', () => {
      console.log('✅ Driver socket connected:', this.socket?.id);
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Driver socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        store.dispatch(
          showNotification({
            type: 'error',
            message: 'Connection lost. Please check your internet.',
          })
        );
      }
    });

    // Listen for new ride requests
    this.socket.on('ride:new-request', (data: { ride: Ride; timeoutSeconds: number }) => {
      console.log('🚗 New ride request:', data);
      
      store.dispatch(setPendingRide(data));
      
      store.dispatch(
        showNotification({
          type: 'info',
          message: `New ride request! ${data.timeoutSeconds}s to accept`,
        })
      );

      // Play notification sound
      this.playNotificationSound();
    });

    // Ride timeout (driver didn't accept in time)
    this.socket.on('ride:timeout', (data: { rideId: string }) => {
      console.log('⏱️ Ride request timeout:', data.rideId);
      
      store.dispatch(clearPendingRide());
      
      store.dispatch(
        showNotification({
          type: 'warning',
          message: 'Ride request expired',
        })
      );
    });

    // Ride cancelled by customer
    this.socket.on('ride:cancelled', (data: { rideId: string; reason: string }) => {
      console.log('❌ Ride cancelled:', data);
      
      const state = store.getState();
      
      // Clear pending or current ride
      if (state.ride.pendingRide?.id === data.rideId) {
        store.dispatch(clearPendingRide());
      }
      if (state.ride.currentRide?.id === data.rideId) {
        store.dispatch(updateRideStatus('CANCELLED'));
      }
      
      store.dispatch(
        showNotification({
          type: 'warning',
          message: `Ride cancelled: ${data.reason}`,
        })
      );
    });

    // Ride reassigned to another driver
    this.socket.on('ride:reassigned', (data: { rideId: string }) => {
      console.log('🔄 Ride reassigned:', data.rideId);
      
      store.dispatch(clearPendingRide());
      
      store.dispatch(
        showNotification({
          type: 'info',
          message: 'Ride assigned to another driver',
        })
      );
    });

    // Ride status updates
    this.socket.on('ride:status', (data: { rideId: string; status: Ride['status'] }) => {
      console.log('📊 Ride status update:', data);
      
      const state = store.getState();
      if (state.ride.currentRide?.id === data.rideId) {
        store.dispatch(updateRideStatus(data.status));
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('Socket disconnected');
    }
  }

  // Emit location update
  updateLocation(location: { lat: number; lng: number }) {
    if (this.socket?.connected) {
      this.socket.emit('driver:update-location', { location });
    }
  }

  // Play notification sound for new rides
  private playNotificationSound() {
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch((err) => {
        console.log('Could not play notification sound:', err);
      });
    } catch (error) {
      console.log('Audio not supported');
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const driverSocketService = new DriverSocketService();
