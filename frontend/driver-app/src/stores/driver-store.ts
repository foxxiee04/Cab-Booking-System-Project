import { create } from 'zustand';

export type DriverStatus = 'OFFLINE' | 'ONLINE' | 'BUSY';
export type RideStatus = 'NONE' | 'ASSIGNED' | 'ACCEPTED' | 'PICKING_UP' | 'IN_PROGRESS' | 'COMPLETED';

interface Location {
  lat: number;
  lng: number;
  address?: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface RideRequest {
  rideId: string;
  customer: Customer;
  pickup: Location;
  destination: Location;
  estimatedFare: number;
  distance: number;
}

interface DriverState {
  status: DriverStatus;
  rideStatus: RideStatus;
  currentLocation: Location | null;
  currentRide: RideRequest | null;
  todayEarnings: number;
  todayTrips: number;

  // Actions
  setStatus: (status: DriverStatus) => void;
  setLocation: (location: Location) => void;
  setRideRequest: (ride: RideRequest) => void;
  acceptRide: () => void;
  startRide: () => void;
  completeRide: (fare: number) => void;
  cancelRide: () => void;
  clearRide: () => void;
  updateEarnings: (earnings: number, trips: number) => void;
}

export const useDriverStore = create<DriverState>((set) => ({
  status: 'OFFLINE',
  rideStatus: 'NONE',
  currentLocation: null,
  currentRide: null,
  todayEarnings: 0,
  todayTrips: 0,

  setStatus: (status) => set({ status }),

  setLocation: (location) => set({ currentLocation: location }),

  setRideRequest: (ride) => set({ currentRide: ride, rideStatus: 'ASSIGNED' }),

  acceptRide: () => set({ rideStatus: 'PICKING_UP', status: 'BUSY' }),

  startRide: () => set({ rideStatus: 'IN_PROGRESS' }),

  completeRide: (fare) =>
    set((state) => ({
      rideStatus: 'COMPLETED',
      status: 'ONLINE',
      todayEarnings: state.todayEarnings + fare,
      todayTrips: state.todayTrips + 1,
    })),

  cancelRide: () => set({ currentRide: null, rideStatus: 'NONE', status: 'ONLINE' }),

  clearRide: () => set({ currentRide: null, rideStatus: 'NONE' }),

  updateEarnings: (earnings, trips) => set({ todayEarnings: earnings, todayTrips: trips }),
}));
