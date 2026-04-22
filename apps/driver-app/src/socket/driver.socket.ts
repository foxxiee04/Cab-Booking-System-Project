import { io, Socket } from 'socket.io-client';
import { driverApi } from '../api/driver.api';
import { store } from '../store';
import { logout } from '../store/auth.slice';
import { setProfile, updateProfile } from '../store/driver.slice';
import { setPendingRide, clearPendingRide, updateRideStatus } from '../store/ride.slice';
import { showNotification } from '../store/ui.slice';
import { Ride, VehicleType } from '../types';
import { refreshAuthSession } from '../api/axios.config';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';

class DriverSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private authFailureHandled = false;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  private async syncDriverProfile() {
    try {
      const response = await driverApi.getProfile();
      store.dispatch(setProfile(response.data.driver));
    } catch {
      // Keep realtime status updates resilient even if profile sync fails.
    }
  }

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
          message: 'Phiên đăng nhập của tài xế đã hết hạn. Vui lòng đăng nhập lại.',
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
            message: 'Phiên đăng nhập của tài xế đã hết hạn. Vui lòng đăng nhập lại.',
          })
        );
        window.location.href = '/login';
      }
    })();
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
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.socket.on('connect', () => {
      console.log('✅ Driver socket connected:', this.socket?.id);
      this.reconnectAttempts = 0;
      this.authFailureHandled = false;
      // Renew Redis presence every 30 seconds
      if (this.pingInterval) clearInterval(this.pingInterval);
      this.pingInterval = setInterval(() => {
        if (this.socket?.connected) this.socket.emit('ping');
      }, 30_000);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Driver socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      if (this.isAuthError(error)) {
        this.handleAuthFailure();
        return;
      }

      console.error('Socket connection error:', error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        store.dispatch(
          showNotification({
            type: 'error',
            message: 'Mất kết nối. Vui lòng kiểm tra mạng Internet.',
          })
        );
      }
    });

    // Listen for new ride requests - match backend event name
    this.socket.on('NEW_RIDE_AVAILABLE', (data: { rideId: string; customerId: string; pickup: any; dropoff: any; estimatedFare?: number; vehicleType?: string; distance?: number; duration?: number; distanceFromDriverMeters?: number; durationFromDriverSeconds?: number; etaMinutes?: number; timeoutSeconds?: number; customer?: any }) => {
      console.log('🚗 New ride available:', data);

      if (!data?.rideId || !data?.customerId) {
        return;
      }
      
      // Convert backend format to frontend Ride format
      const ride: Ride = {
        id: data.rideId,
        customerId: data.customerId,
        driverId: null,
        pickupLocation: {
          lat: data.pickup?.lat || data.pickup?.latitude || 0,
          lng: data.pickup?.lng || data.pickup?.longitude || 0,
          address: data.pickup?.address || 'Điểm đón'
        },
        dropoffLocation: {
          lat: data.dropoff?.lat || data.dropoff?.latitude || 0,
          lng: data.dropoff?.lng || data.dropoff?.longitude || 0,
          address: data.dropoff?.address || 'Điểm đến'
        },
        fare: data.estimatedFare || 0,
        vehicleType: (data.vehicleType as VehicleType) || 'CAR_4',
        distance: data.distance,
        duration: data.duration,
        estimatedDuration: data.duration,
        distanceFromDriverMeters: data.distanceFromDriverMeters,
        durationFromDriverSeconds: data.durationFromDriverSeconds,
        etaMinutes: data.etaMinutes,
        status: 'PENDING',
        customer: data.customer ? {
          firstName: data.customer.firstName || '',
          lastName: data.customer.lastName || '',
          phoneNumber: data.customer.phoneNumber,
          avatar: data.customer.avatar,
          rating: data.customer.rating
        } : undefined
      };
      
      store.dispatch(setPendingRide({ ride, timeoutSeconds: data.timeoutSeconds || 30 }));

      // Play notification sound
      this.playNotificationSound();
    });

    this.socket.on('DRIVER_APPROVAL_UPDATED', (data: { driverId?: string; status: 'APPROVED' | 'REJECTED'; reason?: string }) => {
      const currentProfile = store.getState().driver.profile;
      if (currentProfile) {
        store.dispatch(updateProfile({ status: data.status }));
      }

      void this.syncDriverProfile();
    });

    // Legacy event name for backward compatibility
    this.socket.on('ride:new-request', (data: { ride: Ride; timeoutSeconds: number }) => {
      console.log('🚗 New ride request (legacy):', data);
      store.dispatch(setPendingRide(data));
      this.playNotificationSound();
    });

    // Ride timeout (driver didn't accept in time)
    this.socket.on('ride:timeout', (data: { rideId: string }) => {
      console.log('⏱️ Ride request timeout:', data.rideId);
      
      store.dispatch(clearPendingRide());
      
      store.dispatch(
        showNotification({
          type: 'warning',
          message: 'Yêu cầu chuyến đã hết thời gian phản hồi',
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
          type: 'error',
          message: `Chuyến đi đã bị hủy: ${data.reason}`,
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
          message: 'Chuyến đi đã được gán cho tài xế khác',
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
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('Socket disconnected');
    }
  }

  // Emit location update
  updateLocation(location: { lat: number; lng: number }, rideId?: string) {
    if (this.socket?.connected) {
      const state = store.getState();
      const activeRideId = rideId || state.ride.currentRide?.id;

      this.socket.emit('driver:update-location', {
        rideId: activeRideId,
        location,
        timestamp: Date.now(),
      });
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
