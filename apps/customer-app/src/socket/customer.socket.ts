import { io, Socket } from 'socket.io-client';
import { store } from '../store';
import { logout } from '../store/auth.slice';
import { setCurrentRide, setDriver, updateRideStatus, updateDriverLocation } from '../store/ride.slice';
import { showNotification } from '../store/ui.slice';
import { refreshAuthSession } from '../api/axios.config';
import { driverApi } from '../api/driver.api';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';

const hasDriverIdentity = (driver?: {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  avatar?: string;
} | null) => Boolean(
  driver
  && (
    `${driver.firstName || ''} ${driver.lastName || ''}`.trim()
    || driver.phoneNumber
    || driver.avatar
  ),
);

const mergeRideSnapshot = (incomingRide: any) => {
  if (!incomingRide?.id) {
    return incomingRide;
  }

  const currentRide = store.getState().ride.currentRide;
  if (!currentRide || currentRide.id !== incomingRide.id) {
    return incomingRide;
  }

  return {
    ...currentRide,
    ...incomingRide,
    pickup: incomingRide.pickup || currentRide.pickup,
    dropoff: incomingRide.dropoff || currentRide.dropoff,
    pickupLocation: incomingRide.pickupLocation || currentRide.pickupLocation || currentRide.pickup,
    dropoffLocation: incomingRide.dropoffLocation || currentRide.dropoffLocation || currentRide.dropoff,
    fare: incomingRide.fare ?? currentRide.fare,
    estimatedFare: incomingRide.estimatedFare ?? currentRide.estimatedFare,
    distance: incomingRide.distance ?? currentRide.distance,
    duration: incomingRide.duration ?? currentRide.duration,
    estimatedDistance: incomingRide.estimatedDistance ?? currentRide.estimatedDistance,
    estimatedDuration: incomingRide.estimatedDuration ?? currentRide.estimatedDuration,
    paymentMethod: incomingRide.paymentMethod || currentRide.paymentMethod,
    vehicleType: incomingRide.vehicleType || currentRide.vehicleType,
  };
};

const normalizeCancelledMessage = (message?: string) => {
  const raw = (message || '').trim();
  if (!raw) {
    return 'Bạn có thể quay lại trang chủ để đặt chuyến mới.';
  }

  if (/ride has been cancelled|cancelled/i.test(raw)) {
    return 'Chuyến đi đã bị hủy. Bạn có thể quay lại trang chủ để đặt chuyến mới.';
  }

  return raw;
};

const toVietnameseMessage = (message: string | undefined, fallback: string): string => {
  const raw = (message || '').trim();
  if (!raw) {
    return fallback;
  }

  const normalized = raw.toLowerCase();

  if (/ride has been cancelled|trip has been cancelled|cancelled/i.test(normalized)) {
    return 'Chuyến đi đã bị hủy. Bạn có thể quay lại trang chủ để đặt chuyến mới.';
  }
  if (/driver assigned|driver accepted|driver is on the way|heading to pickup/i.test(raw)) {
    return 'Tài xế đã nhận chuyến và đang tới điểm đón của bạn.';
  }
  if (/driver arrived|arrived at pickup/i.test(raw)) {
    return 'Tài xế đã tới điểm đón. Hãy chuẩn bị lên xe.';
  }
  if (/ride completed|trip completed|payment completed/i.test(raw)) {
    return 'Chuyến đi đã hoàn tất thành công.';
  }
  if (/timeout|no driver|no available driver|searching for driver/i.test(raw)) {
    return 'Chưa có tài xế nhận chuyến, hệ thống đang tiếp tục tìm tài xế khác.';
  }

  const isAsciiOnly = !/[^\u0020-\u007E]/.test(raw);
  if (isAsciiOnly) {
    return fallback;
  }

  return raw;
};

const getRideStatusNotification = (status: string, message?: string, cancelledBy?: string) => {
  switch (status) {
    case 'FINDING_DRIVER':
      if (cancelledBy === 'DRIVER') {
        return {
          type: 'warning' as const,
          title: 'Tài xế đã hủy chuyến',
          message: 'Hệ thống đang tìm tài xế mới cho bạn, vui lòng chờ trong giây lát...',
        };
      }
      return null;
    case 'ASSIGNED':
      return {
        type: 'success' as const,
        title: 'Đã có tài xế nhận chuyến',
        message: toVietnameseMessage(message, 'Tài xế đã nhận chuyến và đang chuẩn bị tới điểm đón của bạn.'),
      };
    case 'ACCEPTED':
      return {
        type: 'success' as const,
        title: 'Tài xế đang tới đón',
        message: toVietnameseMessage(message, 'Bạn có thể theo dõi vị trí tài xế theo thời gian thực.'),
      };
    case 'PICKING_UP':
      return {
        type: 'info' as const,
        title: 'Tài xế đã tới điểm đón',
        message: toVietnameseMessage(message, 'Hãy chuẩn bị lên xe để bắt đầu chuyến đi.'),
      };
    case 'COMPLETED':
      return {
        type: 'success' as const,
        title: 'Chuyến đi đã hoàn tất',
        message: toVietnameseMessage(message, 'Bạn có thể xem hóa đơn và đánh giá tài xế ngay bây giờ.'),
      };
    case 'CANCELLED':
      return {
        type: 'error' as const,
        title: 'Chuyến đi đã bị hủy',
        message: normalizeCancelledMessage(toVietnameseMessage(message, 'Bạn có thể quay lại trang chủ để đặt chuyến mới.')),
      };
    default:
      if (!message) {
        return null;
      }

      return {
        type: 'info' as const,
        title: 'Cập nhật chuyến đi',
        message: toVietnameseMessage(message, 'Trạng thái chuyến đi đã được cập nhật.'),
      };
  }
};

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private authFailureHandled = false;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

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

    const refreshToken = store.getState().auth.refreshToken;
    if (!refreshToken) {
      store.dispatch(logout());
      store.dispatch(
        showNotification({
          type: 'warning',
          title: 'Phiên đăng nhập',
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
            title: 'Phiên đăng nhập',
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
      if (this.pingInterval) clearInterval(this.pingInterval);
      this.pingInterval = setInterval(() => {
        if (this.socket?.connected) this.socket.emit('ping');
      }, 30_000);
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
          title: 'Mất kết nối',
          message: 'Lỗi kết nối. Vui lòng kiểm tra mạng Internet của bạn.',
        })
      );
    });

    // Ride events - matching backend event names
    this.socket.on('RIDE_STATUS_UPDATE', (data: { rideId: string; status: string; message?: string; driverId?: string; driver?: any; cancelledBy?: string }) => {
      store.dispatch(updateRideStatus({ rideId: data.rideId, status: data.status }));

      // When driver is assigned/accepted, fetch driver profile if not already in store
      if ((data.status === 'ASSIGNED' || data.status === 'ACCEPTED') && data.driverId) {
        const currentDriver = store.getState().ride.driver;
        if (data.driver) {
          store.dispatch(setDriver(data.driver));
        }

        if (!hasDriverIdentity(data.driver) && (!hasDriverIdentity(currentDriver) || currentDriver?.id !== data.driverId)) {
          driverApi.getDriverPublicProfile(data.driverId).then((driver) => {
            if (driver) store.dispatch(setDriver(driver));
          }).catch(() => {});
        }
      }

      const notification = getRideStatusNotification(data.status, data.message, data.cancelledBy);
      if (notification) {
        store.dispatch(
          showNotification({
            ...notification,
            rideId: data.rideId,
          })
        );
      }
    });

    this.socket.on('RIDE_COMPLETED', (data: { rideId: string; status: string; fare?: number; message: string }) => {
      store.dispatch(updateRideStatus({ rideId: data.rideId, status: 'COMPLETED' }));
      store.dispatch(
        showNotification({
          type: 'success',
          title: 'Chuyến đi đã hoàn tất',
          message: toVietnameseMessage(data.message, 'Chuyến đi đã hoàn tất thành công.'),
          rideId: data.rideId,
        })
      );
    });

    // Legacy event names for backward compatibility
    this.socket.on('ride:assigned', (data: { ride: any; driver: any }) => {
      store.dispatch(setCurrentRide(mergeRideSnapshot(data.ride)));
      if (data.driver) {
        store.dispatch(setDriver(data.driver));
      }
      if (data.ride?.driverId && !hasDriverIdentity(data.driver)) {
        driverApi.getDriverPublicProfile(data.ride.driverId).then((driver) => {
          if (driver) store.dispatch(setDriver(driver));
        }).catch(() => {});
      }
      const assignedDriverName = `${data.driver?.firstName || ''} ${data.driver?.lastName || ''}`.trim()
        || data.driver?.phoneNumber
        || 'tài xế';
      store.dispatch(
        showNotification({
          type: 'success',
          title: 'Đã có tài xế nhận chuyến',
          message: `Tài xế ${assignedDriverName} đã nhận chuyến và đang tới điểm đón của bạn.`,
          rideId: data.ride?.id,
          persistMs: 7000,
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
          type: 'error',
          title: 'Chuyến đi đã bị hủy',
          message: data.reason
            ? `Lý do: ${toVietnameseMessage(data.reason, 'Chuyến đi đã bị hủy bởi hệ thống.')}`
            : 'Bạn có thể quay lại trang chủ để đặt chuyến mới.',
          rideId: data.rideId,
        })
      );
    });

    this.socket.on('ride:timeout', (data: { rideId: string }) => {
      store.dispatch(
        showNotification({
          type: 'warning',
          title: 'Đang mở rộng tìm kiếm',
          message: 'Chưa có tài xế nhận chuyến, hệ thống đang tiếp tục tìm tài xế khác.',
          rideId: data.rideId,
        })
      );
    });

    this.socket.on('RIDE_MATCHING_FAILED', (data: { rideId: string; message?: string }) => {
      store.dispatch(updateRideStatus({ rideId: data.rideId, status: 'NO_DRIVER_AVAILABLE' }));
      store.dispatch(
        showNotification({
          type: 'warning',
          title: 'Chưa tìm thấy tài xế',
          message: data.message || 'Hiện chưa có tài xế phù hợp cho chuyến đi này. Bạn có thể thử lại sau ít phút.',
          rideId: data.rideId,
        })
      );
    });
  }

  /**
   * Disconnect from socket server
   */
  disconnect() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
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
