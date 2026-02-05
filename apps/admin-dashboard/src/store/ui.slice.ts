import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Notification } from '../types';

interface UIState {
  loading: boolean;
  notification: Notification | null;
  sidebarOpen: boolean;
}

const initialState: UIState = {
  loading: false,
  notification: null,
  sidebarOpen: true,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    showNotification: (
      state,
      action: PayloadAction<Omit<Notification, 'id'>>
    ) => {
      state.notification = {
        ...action.payload,
        id: Date.now().toString(),
      };
    },

    hideNotification: (state) => {
      state.notification = null;
    },

    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },

    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
  },
});

export const {
  setLoading,
  showNotification,
  hideNotification,
  toggleSidebar,
  setSidebarOpen,
} = uiSlice.actions;

export default uiSlice.reducer;
