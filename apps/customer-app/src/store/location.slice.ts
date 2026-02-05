import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Location } from '../types';

interface LocationState {
  currentLocation: Location | null;
  permissionStatus: 'prompt' | 'granted' | 'denied';
  loading: boolean;
  error: string | null;
}

const initialState: LocationState = {
  currentLocation: null,
  permissionStatus: 'prompt',
  loading: false,
  error: null,
};

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setCurrentLocation: (state, action: PayloadAction<Location>) => {
      state.currentLocation = action.payload;
      state.loading = false;
      state.error = null;
    },
    setPermissionStatus: (
      state,
      action: PayloadAction<'prompt' | 'granted' | 'denied'>
    ) => {
      state.permissionStatus = action.payload;
    },
  },
});

export const {
  setLoading,
  setError,
  setCurrentLocation,
  setPermissionStatus,
} = locationSlice.actions;

export default locationSlice.reducer;
