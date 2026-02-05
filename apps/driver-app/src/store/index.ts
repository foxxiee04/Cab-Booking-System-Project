import { configureStore } from '@reduxjs/toolkit';
import authReducer from './auth.slice';
import driverReducer from './driver.slice';
import rideReducer from './ride.slice';
import uiReducer from './ui.slice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    driver: driverReducer,
    ride: rideReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
