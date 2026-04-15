import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';

export interface ChatMessage {
  from: string;
  role: string;
  message: string;
  timestamp: number;
  isSelf?: boolean;
}

export function useRideChat(
  token: string | null | undefined,
  rideId: string | null | undefined,
  myUserId?: string | null,
) {
  const socketRef = useRef<Socket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token || !rideId) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
      upgrade: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('ride:subscribe', { rideId });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('chat:message', (payload: ChatMessage) => {
      setMessages((prev) => [
        ...prev,
        { ...payload, isSelf: payload.from === myUserId },
      ]);
    });

    return () => {
      socket.off('chat:message');
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token, rideId, myUserId]);

  const sendMessage = (message: string) => {
    const trimmed = message.trim();
    if (!socketRef.current?.connected || !rideId || !trimmed) return;
    socketRef.current.emit('chat:send', { rideId, message: trimmed });
  };

  return { messages, sendMessage, connected };
}
