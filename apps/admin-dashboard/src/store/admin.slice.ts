import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SystemStats } from '../types';

interface AdminState {
  stats: SystemStats | null;
  loading: boolean;
  error: string | null;
}

const initialState: AdminState = {
  stats: null,
  loading: false,
  error: null,
};

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    setStats: (state, action: PayloadAction<SystemStats>) => {
      state.stats = action.payload;
      state.error = null;
    },

    updateStats: (state, action: PayloadAction<Partial<SystemStats>>) => {
      if (state.stats) {
        state.stats = { ...state.stats, ...action.payload };
      }
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const { setStats, updateStats, setLoading, setError } = adminSlice.actions;
export default adminSlice.reducer;
