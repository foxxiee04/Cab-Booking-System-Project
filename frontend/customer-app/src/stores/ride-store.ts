import { create } from 'zustand';

export type RideStatus = 
  | 'IDLE' 
  | 'SEARCHING' 
  | 'PENDING' 
  | 'ASSIGNED' 
  | 'ACCEPTED' 
  | 'DRIVER_ARRIVING' 
  | 'IN_PROGRESS' 
  | 'COMPLETED' 
  | 'CANCELLED';

interface Location {
  lat: number;
  lng: number;
  address?: string;
}

interface Driver {
  id: string;
  name: string;
  phone: string;
  rating: number;
  vehicle: {
    model: string;
    color: string;
    licensePlate: string;
  };
  location?: Location;
}

interface RideEstimate {
  distanceKm: number;
  durationMinutes: number;
  estimatedFare: number;
  surgeMultiplier: number;
}

interface RideState {
  status: RideStatus;
  rideId: string | null;
  pickup: Location | null;
  destination: Location | null;
  estimate: RideEstimate | null;
  driver: Driver | null;
  eta: number | null;
  fare: number | null;

  // Actions
  setPickup: (location: Location) => void;
  setDestination: (location: Location) => void;
  setEstimate: (estimate: RideEstimate) => void;
  startSearching: () => void;
  setRideCreated: (rideId: string) => void;
  setDriverAssigned: (driver: Driver, eta: number) => void;
  setDriverAccepted: () => void;
  setRideStarted: () => void;
  setRideCompleted: (fare: number) => void;
  setRideCancelled: () => void;
  updateDriverLocation: (location: Location) => void;
  reset: () => void;
}

const initialState = {
  status: 'IDLE' as RideStatus,
  rideId: null,
  pickup: null,
  destination: null,
  estimate: null,
  driver: null,
  eta: null,
  fare: null,
};

export const useRideStore = create<RideState>((set) => ({
  ...initialState,

  setPickup: (location) => set({ pickup: location }),

  setDestination: (location) => set({ destination: location }),

  setEstimate: (estimate) => set({ estimate }),

  startSearching: () => set({ status: 'SEARCHING' }),

  setRideCreated: (rideId) => set({ rideId, status: 'PENDING' }),

  setDriverAssigned: (driver, eta) =>
    set({ driver, eta, status: 'ASSIGNED' }),

  setDriverAccepted: () => set({ status: 'DRIVER_ARRIVING' }),

  setRideStarted: () => set({ status: 'IN_PROGRESS' }),

  setRideCompleted: (fare) => set({ fare, status: 'COMPLETED' }),

  setRideCancelled: () => set({ status: 'CANCELLED' }),

  updateDriverLocation: (location) =>
    set((state) => ({
      driver: state.driver ? { ...state.driver, location } : null,
    })),

  reset: () => set(initialState),
}));
