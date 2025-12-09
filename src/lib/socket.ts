import { io, Socket } from 'socket.io-client';

// WebSocket connection for real-time collaboration
// In production, this would connect to your WebSocket server
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

let socket: Socket | null = null;

export const connectSocket = (roomId: string, userId: string): Socket => {
  if (socket?.connected) {
    socket.disconnect();
  }
  
  socket = io(SOCKET_URL, {
    query: { roomId, userId },
    transports: ['websocket', 'polling'],
  });
  
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = (): Socket | null => socket;

