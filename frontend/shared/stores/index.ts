/**
 * Shared Zustand Stores for all frontend apps
 * Follow pattern: store for state management across apps
 */

// ============ Auth Store ============
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  role: 'CUSTOMER' | 'DRIVER' | 'ADMIN';
  avatar?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setUser: (user) => set({ user }),

      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),

      login: (user, accessToken, refreshToken) =>
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),

      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),
    }),
    {
      name: 'auth-store',
    }
  )
);

// ============ Booking Store ============

export interface LocationData {
  lat: number;
  lng: number;
  address: string;
}

export interface BookingData {
  id?: string;
  pickup?: LocationData;
  dropoff?: LocationData;
  vehicleType?: 'ECONOMY' | 'COMFORT' | 'PREMIUM';
  paymentMethod?: 'CASH' | 'CARD' | 'WALLET';
  status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  estimatedFare?: number;
  estimatedDistance?: number;
  estimatedDuration?: number;
  notes?: string;
}

interface BookingState {
  booking: BookingData;
  bookings: BookingData[];
  setPickup: (location: LocationData) => void;
  setDropoff: (location: LocationData) => void;
  setVehicleType: (type: 'ECONOMY' | 'COMFORT' | 'PREMIUM') => void;
  setPaymentMethod: (method: 'CASH' | 'CARD' | 'WALLET') => void;
  setBooking: (booking: BookingData) => void;
  setBookingStatus: (id: string, status: string) => void;
  addBooking: (booking: BookingData) => void;
  setBookings: (bookings: BookingData[]) => void;
  reset: () => void;
}

export const useBookingStore = create<BookingState>()(
  persist(
    (set) => ({
      booking: {},
      bookings: [],

      setPickup: (location) =>
        set((state) => ({
          booking: { ...state.booking, pickup: location },
        })),

      setDropoff: (location) =>
        set((state) => ({
          booking: { ...state.booking, dropoff: location },
        })),

      setVehicleType: (type) =>
        set((state) => ({
          booking: { ...state.booking, vehicleType: type },
        })),

      setPaymentMethod: (method) =>
        set((state) => ({
          booking: { ...state.booking, paymentMethod: method },
        })),

      setBooking: (booking) => set({ booking }),

      setBookingStatus: (id, status) =>
        set((state) => ({
          booking: { ...state.booking, id, status: status as any },
        })),

      addBooking: (booking) =>
        set((state) => ({
          bookings: [booking, ...state.bookings],
        })),

      setBookings: (bookings) => set({ bookings }),

      reset: () => set({ booking: {}, bookings: [] }),
    }),
    {
      name: 'booking-store',
    }
  )
);

// ============ Ride Store ============

export interface RideData {
  id: string;
  customerId: string;
  driverId?: string;
  pickup: LocationData;
  dropoff: LocationData;
  status: 'FINDING_DRIVER' | 'DRIVER_ASSIGNED' | 'DRIVER_ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  fare: number;
  distance: number;
  duration: number;
  vehicleType: 'ECONOMY' | 'COMFORT' | 'PREMIUM';
  paymentMethod: 'CASH' | 'CARD' | 'WALLET';
  driver?: {
    id: string;
    name: string;
    phone: string;
    vehicle: string;
    plate: string;
    rating: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface RideState {
  activeRide: RideData | null;
  rideHistory: RideData[];
  setActiveRide: (ride: RideData | null) => void;
  updateRideStatus: (rideId: string, status: string) => void;
  addRideToHistory: (ride: RideData) => void;
  setRideHistory: (rides: RideData[]) => void;
  clearActiveRide: () => void;
}

export const useRideStore = create<RideState>((set) => ({
  activeRide: null,
  rideHistory: [],

  setActiveRide: (ride) => set({ activeRide: ride }),

  updateRideStatus: (rideId, status) =>
    set((state) => ({
      activeRide: state.activeRide && state.activeRide.id === rideId
        ? { ...state.activeRide, status: status as any }
        : state.activeRide,
    })),

  addRideToHistory: (ride) =>
    set((state) => ({
      rideHistory: [ride, ...state.rideHistory],
    })),

  setRideHistory: (rides) => set({ rideHistory: rides }),

  clearActiveRide: () => set({ activeRide: null }),
}));

// ============ Driver Store ============

export interface DriverProfile {
  id: string;
  userId: string;
  status: 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'INACTIVE';
  isOnline: boolean;
  currentLocation?: LocationData;
  vehicle: {
    type: string;
    brand: string;
    model: string;
    plate: string;
    color: string;
    year: number;
  };
  license: {
    number: string;
    expiryDate: string;
  };
  rating: number;
  totalRides: number;
  totalEarnings: number;
}

interface DriverState {
  driver: DriverProfile | null;
  setDriver: (driver: DriverProfile) => void;
  updateStatus: (status: 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'INACTIVE') => void;
  setOnline: (isOnline: boolean) => void;
  updateLocation: (location: LocationData) => void;
  updateStats: (totalRides: number, totalEarnings: number, rating: number) => void;
  clear: () => void;
}

export const useDriverStore = create<DriverState>((set) => ({
  driver: null,

  setDriver: (driver) => set({ driver }),

  updateStatus: (status) =>
    set((state) => ({
      driver: state.driver ? { ...state.driver, status } : null,
    })),

  setOnline: (isOnline) =>
    set((state) => ({
      driver: state.driver ? { ...state.driver, isOnline } : null,
    })),

  updateLocation: (location) =>
    set((state) => ({
      driver: state.driver ? { ...state.driver, currentLocation: location } : null,
    })),

  updateStats: (totalRides, totalEarnings, rating) =>
    set((state) => ({
      driver: state.driver
        ? { ...state.driver, totalRides, totalEarnings, rating }
        : null,
    })),

  clear: () => set({ driver: null }),
}));

// ============ UI Store (modal, toast, etc) ============

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

interface UIState {
  toasts: ToastMessage[];
  addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  removeToast: (id: string) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  loading: false,

  addToast: (message, type) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          id: `${Date.now()}`,
          type,
          message,
          duration: 3000,
        },
      ],
    })),

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  setLoading: (loading) => set({ loading }),
}));
