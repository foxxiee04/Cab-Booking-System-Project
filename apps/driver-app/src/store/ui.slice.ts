import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Notification } from '../types';

const NOTIFICATION_HISTORY_STORAGE_KEY = 'driverNotificationHistory';
const MAX_NOTIFICATION_HISTORY = 50;

type NotificationPayload = Omit<Notification, 'id' | 'createdAt' | 'read'>;

const loadNotificationHistory = (): Notification[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawValue = localStorage.getItem(NOTIFICATION_HISTORY_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .filter((item): item is Partial<Notification> => Boolean(item) && typeof item === 'object')
      .map((item, index) => ({
        id: typeof item.id === 'string' && item.id ? item.id : `history_${Date.now()}_${index}`,
        type: item.type === 'success' || item.type === 'error' || item.type === 'warning' || item.type === 'info'
          ? item.type
          : 'info',
        message: typeof item.message === 'string' ? item.message : 'Thông báo hệ thống',
        title: typeof item.title === 'string' ? item.title : undefined,
        rideId: typeof item.rideId === 'string' && item.rideId ? item.rideId : undefined,
        persistMs: typeof item.persistMs === 'number' ? item.persistMs : undefined,
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
        read: Boolean(item.read),
      }))
      .slice(0, MAX_NOTIFICATION_HISTORY);
  } catch {
    return [];
  }
};

const persistNotificationHistory = (history: Notification[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(
      NOTIFICATION_HISTORY_STORAGE_KEY,
      JSON.stringify(history.slice(0, MAX_NOTIFICATION_HISTORY)),
    );
  } catch {
    // Ignore quota/storage errors and keep the in-memory state working.
  }
};

const createNotification = (payload: NotificationPayload): Notification => ({
  ...payload,
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  createdAt: new Date().toISOString(),
  read: false,
});

interface UIState {
  loading: boolean;
  notification: Notification | null;
  notificationHistory: Notification[];
  sidebarOpen: boolean;
}

const initialState: UIState = {
  loading: false,
  notification: null,
  notificationHistory: loadNotificationHistory(),
  sidebarOpen: false,
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
      action: PayloadAction<NotificationPayload>
    ) => {
      const nextNotification = createNotification(action.payload);
      state.notification = nextNotification;
      state.notificationHistory = [nextNotification, ...state.notificationHistory].slice(0, MAX_NOTIFICATION_HISTORY);
      persistNotificationHistory(state.notificationHistory);
    },

    hideNotification: (state) => {
      state.notification = null;
    },

    markAllNotificationsRead: (state) => {
      state.notificationHistory = state.notificationHistory.map((item) => ({
        ...item,
        read: true,
      }));
      persistNotificationHistory(state.notificationHistory);
    },

    clearNotificationHistory: (state) => {
      state.notificationHistory = [];
      persistNotificationHistory(state.notificationHistory);
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
  markAllNotificationsRead,
  clearNotificationHistory,
  toggleSidebar,
  setSidebarOpen,
} = uiSlice.actions;

export default uiSlice.reducer;
