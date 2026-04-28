import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Ride, Driver, Location } from '../types';
import { logout } from './auth.slice';

interface RideState {
  currentRide: Ride | null;
  driver: Driver | null;
  pickupLocation: Location | null;
  dropoffLocation: Location | null;
  fareEstimate: number | null;
  surgeMultiplier: number;
  loading: boolean;
  error: string | null;
}

const initialState: RideState = {
  currentRide: null,
  driver: null,
  pickupLocation: null,
  dropoffLocation: null,
  fareEstimate: null,
  surgeMultiplier: 1.0,
  loading: false,
  error: null,
};

const rideSlice = createSlice({
  name: 'ride',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setPickupLocation: (state, action: PayloadAction<Location | null>) => {
      state.pickupLocation = action.payload;
    },
    setDropoffLocation: (state, action: PayloadAction<Location | null>) => {
      state.dropoffLocation = action.payload;
    },
    setFareEstimate: (state, action: PayloadAction<number | null>) => {
      state.fareEstimate = action.payload;
    },
    setSurgeMultiplier: (state, action: PayloadAction<number>) => {
      state.surgeMultiplier = action.payload;
    },
    setCurrentRide: (state, action: PayloadAction<Ride | null>) => {
      state.currentRide = action.payload;
    },
    setDriver: (state, action: PayloadAction<Driver | null>) => {
      state.driver = action.payload;
    },
    updateRideStatus: (state, action: PayloadAction<{ rideId: string; status: string }>) => {
      if (state.currentRide && state.currentRide.id === action.payload.rideId) {
        state.currentRide.status = action.payload.status as any;
      }
    },
    updateDriverLocation: (state, action: PayloadAction<Location>) => {
      if (!state.driver) {
        state.driver = {
          id: state.currentRide?.driverId || 'unknown-driver',
          firstName: '',
          lastName: '',
          vehicleMake: '',
          vehicleModel: '',
          vehicleColor: '',
          licensePlate: '',
          rating: 5,
          totalRides: 0,
          currentLocation: action.payload,
        };
        return;
      }

      state.driver.currentLocation = action.payload;
    },
    clearRide: (state) => {
      state.currentRide = null;
      state.driver = null;
      state.pickupLocation = null;
      state.dropoffLocation = null;
      state.fareEstimate = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Clear ALL ride/location state when user logs out — prevents account B seeing account A's ride
    builder.addCase(logout, () => ({ ...initialState }));
  },
});

export const {
  setLoading,
  setError,
  setPickupLocation,
  setDropoffLocation,
  setFareEstimate,
  setSurgeMultiplier,
  setCurrentRide,
  setDriver,
  updateRideStatus,
  updateDriverLocation,
  clearRide,
} = rideSlice.actions;

export default rideSlice.reducer;
