import { io, Socket } from 'socket.io-client';
import { store } from '../store';
import { updateStats } from '../store/admin.slice';
import { showNotification } from '../store/ui.slice';
import { Ride, Payment } from '../types';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';

class AdminSocketService {
  private socket: Socket | null = null;

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
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log('✅ Admin socket connected:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Admin socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // Listen for new rides
    this.socket.on('ride:created', (data: { ride: Ride }) => {
      console.log('🚗 New ride created:', data.ride.id);
      
      const state = store.getState();
      if (state.admin.stats) {
        store.dispatch(
          updateStats({
            rides: {
              ...state.admin.stats.rides,
              total: state.admin.stats.rides.total + 1,
              pending: state.admin.stats.rides.pending + 1,
            },
          })
        );
      }

      store.dispatch(
        showNotification({
          type: 'info',
          message: `New ride created: ${data.ride.id.substring(0, 8)}`,
        })
      );
    });

    // Listen for completed rides
    this.socket.on('ride:completed', (data: { ride: Ride }) => {
      console.log('✅ Ride completed:', data.ride.id);

      const state = store.getState();
      if (state.admin.stats) {
        store.dispatch(
          updateStats({
            rides: {
              ...state.admin.stats.rides,
              active: Math.max(0, state.admin.stats.rides.active - 1),
              completed: state.admin.stats.rides.completed + 1,
            },
            revenue: {
              ...state.admin.stats.revenue,
              today: state.admin.stats.revenue.today + data.ride.fare,
            },
          })
        );
      }

      store.dispatch(
        showNotification({
          type: 'success',
          message: `Ride completed: ${data.ride.id.substring(0, 8)}`,
        })
      );
    });

    // Listen for cancelled rides
    this.socket.on('ride:cancelled', (data: { rideId: string }) => {
      console.log('❌ Ride cancelled:', data.rideId);

      const state = store.getState();
      if (state.admin.stats) {
        store.dispatch(
          updateStats({
            rides: {
              ...state.admin.stats.rides,
              cancelled: state.admin.stats.rides.cancelled + 1,
            },
          })
        );
      }
    });

    // Listen for driver status changes
    this.socket.on('driver:online', (data: { driverId: string }) => {
      console.log('🟢 Driver online:', data.driverId);

      const state = store.getState();
      if (state.admin.stats) {
        store.dispatch(
          updateStats({
            drivers: {
              ...state.admin.stats.drivers,
              online: state.admin.stats.drivers.online + 1,
              offline: Math.max(0, state.admin.stats.drivers.offline - 1),
            },
          })
        );
      }
    });

    this.socket.on('driver:offline', (data: { driverId: string }) => {
      console.log('🔴 Driver offline:', data.driverId);

      const state = store.getState();
      if (state.admin.stats) {
        store.dispatch(
          updateStats({
            drivers: {
              ...state.admin.stats.drivers,
              online: Math.max(0, state.admin.stats.drivers.online - 1),
              offline: state.admin.stats.drivers.offline + 1,
            },
          })
        );
      }
    });

    // Listen for payments
    this.socket.on('payment:completed', (data: { payment: Payment }) => {
      console.log('💰 Payment completed:', data.payment.id);

      const state = store.getState();
      if (state.admin.stats) {
        store.dispatch(
          updateStats({
            payments: {
              ...state.admin.stats.payments,
              pending: Math.max(0, state.admin.stats.payments.pending - 1),
              completed: state.admin.stats.payments.completed + 1,
            },
          })
        );
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

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const adminSocketService = new AdminSocketService();
