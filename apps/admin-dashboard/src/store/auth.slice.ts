import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User, AuthTokens } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

// Use sessionStorage (per-tab) instead of localStorage (shared across tabs in same incognito window).
const initialState: AuthState = {
  user: JSON.parse(sessionStorage.getItem('user') || 'null'),
  accessToken: sessionStorage.getItem('accessToken'),
  refreshToken: sessionStorage.getItem('refreshToken'),
  isAuthenticated: !!sessionStorage.getItem('accessToken'),
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: User; tokens: AuthTokens }>
    ) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.tokens.accessToken;
      state.refreshToken = action.payload.tokens.refreshToken;
      state.isAuthenticated = true;
      state.error = null;

      sessionStorage.setItem('user', JSON.stringify(action.payload.user));
      sessionStorage.setItem('accessToken', action.payload.tokens.accessToken);
      sessionStorage.setItem('refreshToken', action.payload.tokens.refreshToken);
    },

    updateTokens: (state, action: PayloadAction<AuthTokens>) => {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.isAuthenticated = true;

      sessionStorage.setItem('accessToken', action.payload.accessToken);
      sessionStorage.setItem('refreshToken', action.payload.refreshToken);
    },

    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      sessionStorage.setItem('user', JSON.stringify(action.payload));
    },

    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.error = null;

      sessionStorage.removeItem('user');
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const { setCredentials, updateTokens, setUser, logout, setLoading, setError } = authSlice.actions;
export default authSlice.reducer;
