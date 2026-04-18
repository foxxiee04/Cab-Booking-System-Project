import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import axiosInstance from '../api/axios.config';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';
const MAX_HISTORY_MESSAGES = 100;

export interface ChatMessage {
  id?: string;
  from: string;
  role: string;
  message: string;
  type?: string;
  timestamp: number;
  createdAt?: string;
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
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    if (!token || !rideId) return;

    let isMounted = true;

    const mapMessage = (payload: ChatMessage) => ({
      ...payload,
      isSelf: payload.from === myUserId,
    });

    const appendMessage = (payload: ChatMessage) => {
      setMessages((prev) => {
        const nextMessage = mapMessage(payload);
        const alreadyExists = nextMessage.id
          ? prev.some((message) => message.id === nextMessage.id)
          : prev.some((message) => (
            message.from === nextMessage.from
            && message.timestamp === nextMessage.timestamp
            && message.message === nextMessage.message
          ));

        if (alreadyExists) {
          return prev;
        }

        return [...prev, nextMessage];
      });
    };

    const loadHistory = async () => {
      try {
        const response = await axiosInstance.get(`/rides/${rideId}/messages`, {
          params: { limit: MAX_HISTORY_MESSAGES },
        });
        const history = Array.isArray(response.data?.data?.messages) ? response.data.data.messages : [];

        if (!isMounted) {
          return;
        }

        setMessages(history.map((message: ChatMessage) => mapMessage(message)));
      } catch {
        if (isMounted) {
          setMessages([]);
        }
      } finally {
        if (isMounted) {
          setHistoryLoaded(true);
        }
      }
    };

    void loadHistory();

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
      upgrade: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('ride:subscribe', { rideId });
      socket.emit('join_room', { roomId: `trip_${rideId}` });
      void loadHistory();
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('chat:message', appendMessage);
    socket.on('receive_message', appendMessage);

    return () => {
      socket.off('chat:message');
      socket.off('receive_message');
      socket.emit('leave_room', { roomId: `trip_${rideId}` });
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      isMounted = false;
    };
  }, [token, rideId, myUserId]);

  const sendMessage = (message: string) => {
    const trimmed = message.trim();
    if (!socketRef.current?.connected || !rideId || !trimmed) return;
    socketRef.current.emit('send_message', { roomId: `trip_${rideId}`, message: trimmed, type: 'TEXT' });
  };

  return { messages, sendMessage, connected, historyLoaded };
}
