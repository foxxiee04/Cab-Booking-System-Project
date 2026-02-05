import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Ride } from '../types';

interface RideState {
  pendingRide: Ride | null; // New ride request
  currentRide: Ride | null; // Active ride (accepted)
  timeoutSeconds: number;
  loading: boolean;
  error: string | null;
}

const initialState: RideState = {
  pendingRide: null,
  currentRide: null,
  timeoutSeconds: 20,
  loading: false,
  error: null,
};

const rideSlice = createSlice({
  name: 'ride',
  initialState,
  reducers: {
    setPendingRide: (
      state,
      action: PayloadAction<{ ride: Ride; timeoutSeconds: number }>
    ) => {
      state.pendingRide = action.payload.ride;
      state.timeoutSeconds = action.payload.timeoutSeconds;
      state.error = null;
    },

    clearPendingRide: (state) => {
      state.pendingRide = null;
      state.timeoutSeconds = 20;
    },

    setCurrentRide: (state, action: PayloadAction<Ride>) => {
      state.currentRide = action.payload;
      state.pendingRide = null;
      state.error = null;
    },

    updateRideStatus: (state, action: PayloadAction<Ride['status']>) => {
      if (state.currentRide) {
        state.currentRide.status = action.payload;
      }
    },

    clearCurrentRide: (state) => {
      state.currentRide = null;
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setPendingRide,
  clearPendingRide,
  setCurrentRide,
  updateRideStatus,
  clearCurrentRide,
  setLoading,
  setError,
} = rideSlice.actions;

export default rideSlice.reducer;
