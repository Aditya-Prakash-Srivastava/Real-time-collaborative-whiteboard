import { io } from 'socket.io-client';

/**
 * The base URL for the backend Socket.IO server.
 * Uses environment variables for deployment (Vercel) or fallbacks to localhost.
 */
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * SocketService Singleton Class
 * Manages the WebSocket lifecycle, ensuring only one active connection 
 * exists across the React application to prevent memory leaks and duplicate events.
 */
class SocketService {
  constructor() {
    this.socket = null;
  }

  /**
   * Initializes the socket connection if one doesn't exist.
   * Passes the JWT token in the auth payload for backend validation.
   * 
   * @param {string} token - The JWT authentication token.
   * @returns {import('socket.io-client').Socket} The initialized socket instance.
   */
  connect(token) {
    if (this.socket) return this.socket;

    this.socket = io(SOCKET_URL, {
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Connected to realtime server');
    });

    this.socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    return this.socket;
  }

  getSocket() {
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
