import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Driver, Location, Earnings } from '../types';

interface DriverState {
  profile: Driver | null;
  isOnline: boolean;
  isAvailable: boolean;
  currentLocation: Location | null;
  earnings: Earnings | null;
  loading: boolean;
  error: string | null;
}

const initialState: DriverState = {
  profile: null,
  isOnline: false,
  isAvailable: false,
  currentLocation: null,
  earnings: null,
  loading: false,
  error: null,
};

const driverSlice = createSlice({
  name: 'driver',
  initialState,
  reducers: {
    setProfile: (state, action: PayloadAction<Driver>) => {
      state.profile = action.payload;
      state.isOnline = action.payload.isOnline;
      state.isAvailable = action.payload.isAvailable;
      state.currentLocation = action.payload.currentLocation;
      state.error = null;
    },

    updateProfile: (state, action: PayloadAction<Partial<Driver>>) => {
      if (state.profile) {
        state.profile = { ...state.profile, ...action.payload };
      }
    },

    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
      if (state.profile) {
        state.profile.isOnline = action.payload;
      }
    },

    setAvailableStatus: (state, action: PayloadAction<boolean>) => {
      state.isAvailable = action.payload;
      if (state.profile) {
        state.profile.isAvailable = action.payload;
      }
    },

    setCurrentLocation: (state, action: PayloadAction<Location>) => {
      state.currentLocation = action.payload;
      if (state.profile) {
        state.profile.currentLocation = action.payload;
      }
    },

    setEarnings: (state, action: PayloadAction<Earnings>) => {
      state.earnings = action.payload;
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    clearDriver: (state) => {
      state.profile = null;
      state.isOnline = false;
      state.isAvailable = false;
      state.currentLocation = null;
      state.earnings = null;
      state.error = null;
    },
  },
});

export const {
  setProfile,
  updateProfile,
  setOnlineStatus,
  setAvailableStatus,
  setCurrentLocation,
  setEarnings,
  setLoading,
  setError,
  clearDriver,
} = driverSlice.actions;

export default driverSlice.reducer;
