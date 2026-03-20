import { io, Socket } from 'socket.io-client';
import { store } from '../store';
import { logout } from '../store/auth.slice';
import { updateStats } from '../store/admin.slice';
import { showNotification } from '../store/ui.slice';
import { Ride, Payment } from '../types';
import { refreshAuthSession } from '../api/axios.config';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';

export interface AdminRealtimeEvent {
  id: string;
  type: 'ride:created' | 'ride:completed' | 'ride:cancelled' | 'driver:online' | 'driver:offline' | 'payment:completed';
  timestamp: string;
  title: string;
  detail: string;
  tone: 'info' | 'success' | 'warning';
}

class AdminSocketService {
  private socket: Socket | null = null;
  private listeners = new Set<() => void>();
  private eventListeners = new Set<(event: AdminRealtimeEvent) => void>();
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

        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    })();
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }

  private emitRealtimeEvent(event: AdminRealtimeEvent) {
    this.eventListeners.forEach((listener) => listener(event));
  }

  connect(accessToken: string) {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    this.socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log('✅ Admin socket connected:', this.socket?.id);
      this.authFailureHandled = false;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Admin socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      if (this.isAuthError(error)) {
        this.handleAuthFailure();
        return;
      }

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

      this.emitRealtimeEvent({
        id: `ride-created-${data.ride.id}-${Date.now()}`,
        type: 'ride:created',
        timestamp: new Date().toISOString(),
        title: 'Ride created',
        detail: `Chuyến ${data.ride.id.substring(0, 8)} vừa được tạo.`,
        tone: 'info',
      });

      this.notifyListeners();
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
          message: `Chuyến ${data.ride.id.substring(0, 8)} đã hoàn tất`,
        })
      );

      this.emitRealtimeEvent({
        id: `ride-completed-${data.ride.id}-${Date.now()}`,
        type: 'ride:completed',
        timestamp: new Date().toISOString(),
        title: 'Chuyến đi hoàn tất',
        detail: `Chuyến ${data.ride.id.substring(0, 8)} đã hoàn thành với doanh thu ${data.ride.fare.toLocaleString('vi-VN')} VND.`,
        tone: 'success',
      });

      this.notifyListeners();
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

      this.emitRealtimeEvent({
        id: `ride-cancelled-${data.rideId}-${Date.now()}`,
        type: 'ride:cancelled',
        timestamp: new Date().toISOString(),
        title: 'Chuyến đi bị hủy',
        detail: `Chuyến ${data.rideId.substring(0, 8)} đã bị hủy.`,
        tone: 'warning',
      });

      this.notifyListeners();
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

      this.emitRealtimeEvent({
        id: `driver-online-${data.driverId}-${Date.now()}`,
        type: 'driver:online',
        timestamp: new Date().toISOString(),
        title: 'Tài xế trực tuyến',
        detail: `Tài xế ${data.driverId.substring(0, 8)} đã trực tuyến.`,
        tone: 'success',
      });

      this.notifyListeners();
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

      this.emitRealtimeEvent({
        id: `driver-offline-${data.driverId}-${Date.now()}`,
        type: 'driver:offline',
        timestamp: new Date().toISOString(),
        title: 'Tài xế ngoại tuyến',
        detail: `Tài xế ${data.driverId.substring(0, 8)} đã ngoại tuyến.`,
        tone: 'warning',
      });

      this.notifyListeners();
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

      this.emitRealtimeEvent({
        id: `payment-completed-${data.payment.id}-${Date.now()}`,
        type: 'payment:completed',
        timestamp: new Date().toISOString(),
        title: 'Thanh toán hoàn tất',
        detail: `Thanh toán ${data.payment.id.substring(0, 8)} đã thành công.`,
        tone: 'success',
      });

      this.notifyListeners();
    });
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeToEvents(listener: (event: AdminRealtimeEvent) => void) {
    this.eventListeners.add(listener);

    return () => {
      this.eventListeners.delete(listener);
    };
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
