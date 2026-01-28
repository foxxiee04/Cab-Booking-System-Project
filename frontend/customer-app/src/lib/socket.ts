import io from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';

export const socket = io(SOCKET_URL, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  transports: ['websocket', 'polling'],
  auth: {
    token: typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null,
  },
});

// Auto-reconnect with new token when it changes
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'accessToken' && e.newValue) {
      socket.auth = { token: e.newValue };
      if (!socket.connected) {
        socket.connect();
      }
    }
  });
}

export default socket;
