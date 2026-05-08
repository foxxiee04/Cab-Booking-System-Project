import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Ride } from '../types';
import { logout } from './auth.slice';

interface RideState {
  pendingRide: Ride | null; // New ride request
  currentRide: Ride | null; // Active ride (accepted)
  timeoutSeconds: number;
  loading: boolean;
  error: string | null;
  /** Offer no longer valid (accepted elsewhere / cancelled) — hide from nearby list without reload */
  revokedFeedRideIds: string[];
}

const initialState: RideState = {
  pendingRide: null,
  currentRide: null,
  timeoutSeconds: 20,
  loading: false,
  error: null,
  revokedFeedRideIds: [],
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

    revokeRideFromFeed: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      if (!state.revokedFeedRideIds.includes(id)) {
        state.revokedFeedRideIds.push(id);
      }
      while (state.revokedFeedRideIds.length > 100) {
        state.revokedFeedRideIds.shift();
      }
      if (state.pendingRide?.id === id) {
        state.pendingRide = null;
      }
    },
  },
  extraReducers: (builder) => {
    // Clear ALL ride state when user logs out — prevents another account seeing this user's ride
    builder.addCase(logout, () => ({
      pendingRide: null,
      currentRide: null,
      timeoutSeconds: 20,
      loading: false,
      error: null,
      revokedFeedRideIds: [],
    }));
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
  revokeRideFromFeed,
} = rideSlice.actions;

export default rideSlice.reducer;
