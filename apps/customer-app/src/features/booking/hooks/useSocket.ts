import { useEffect, useMemo, useRef, useState } from 'react';
import { Socket, io } from 'socket.io-client';
import {
  DriverLocationSocketPayload,
  DriverLocationUpdate,
  RideStatusSocketPayload,
} from '../types';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';

export interface UseSocketOptions {
  token?: string | null;
  rideId?: string;
  driverId?: string;
  enabled?: boolean;
  eventName?: string;
  onRideStatusUpdate?: (payload: RideStatusSocketPayload) => void;
}

export interface UseSocketResult {
  socket: Socket | null;
  isConnected: boolean;
  driverLocation: DriverLocationUpdate | null;
  lastRideStatus: RideStatusSocketPayload | null;
  connectionError: string | null;
}

function normalizeDriverLocation(payload: DriverLocationSocketPayload): DriverLocationUpdate | null {
  const latRaw =
    payload.lat ??
    payload.location?.lat ??
    payload.coordinates?.lat ??
    (payload as any).latitude ??
    (payload as any).location?.latitude ??
    (payload as any).coordinates?.latitude;
  const lngRaw =
    payload.lng ??
    payload.location?.lng ??
    payload.coordinates?.lng ??
    (payload as any).longitude ??
    (payload as any).location?.longitude ??
    (payload as any).coordinates?.longitude;

  const lat = typeof latRaw === 'string' ? Number(latRaw) : latRaw;
  const lng = typeof lngRaw === 'string' ? Number(lngRaw) : lngRaw;

  if (typeof lat !== 'number' || Number.isNaN(lat) || typeof lng !== 'number' || Number.isNaN(lng)) {
    return null;
  }

  const speedRaw = (payload as any).speedKph ?? (payload as any).speed ?? (payload.location as any)?.speed;
  const normalizedSpeed = typeof speedRaw === 'string' ? Number(speedRaw) : speedRaw;

  return {
    driverId: payload.driverId,
    rideId: payload.rideId,
    lat,
    lng,
    heading: payload.heading ?? payload.location?.heading,
    speedKph: typeof normalizedSpeed === 'number' && !Number.isNaN(normalizedSpeed) ? normalizedSpeed : undefined,
    timestamp: payload.timestamp ?? Date.now(),
  };
}

export function useSocket({
  token,
  rideId,
  driverId,
  enabled = true,
  eventName = 'driver_location_update',
  onRideStatusUpdate,
}: UseSocketOptions): UseSocketResult {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [driverLocation, setDriverLocation] = useState<DriverLocationUpdate | null>(null);
  const [lastRideStatus, setLastRideStatus] = useState<RideStatusSocketPayload | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !token) {
      return undefined;
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
      upgrade: true,
      timeout: 12000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      autoConnect: true,
    });

    socketRef.current = socket;

    const handleConnect = () => {
      setIsConnected(true);
      setConnectionError(null);

      if (rideId) {
        socket.emit('ride:subscribe', { rideId });
        socket.emit('subscribe_ride_tracking', { rideId });
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleConnectError = (error: Error) => {
      setConnectionError(error.message);
      setIsConnected(false);
    };

    const handleLocationUpdate = (payload: DriverLocationSocketPayload) => {
      const normalized = normalizeDriverLocation(payload);

      if (!normalized) {
        return;
      }

      if (rideId && normalized.rideId && normalized.rideId !== rideId) {
        return;
      }

      if (driverId && normalized.driverId && normalized.driverId !== driverId) {
        return;
      }

      setDriverLocation(normalized);
    };

    const handleRideStatus = (payload: RideStatusSocketPayload) => {
      if (rideId && payload.rideId !== rideId) {
        return;
      }

      setLastRideStatus(payload);
      onRideStatusUpdate?.(payload);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on(eventName, handleLocationUpdate);
    socket.on('driver:location', handleLocationUpdate);
    socket.on('RIDE_STATUS_UPDATE', handleRideStatus);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off(eventName, handleLocationUpdate);
      socket.off('driver:location', handleLocationUpdate);
      socket.off('RIDE_STATUS_UPDATE', handleRideStatus);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [driverId, enabled, eventName, onRideStatusUpdate, rideId, token]);

  return useMemo(
    () => ({
      socket: socketRef.current,
      isConnected,
      driverLocation,
      lastRideStatus,
      connectionError,
    }),
    [connectionError, driverLocation, isConnected, lastRideStatus],
  );
}