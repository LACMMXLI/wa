import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SessionStatusEvent {
  sessionId: string;
  status: string;
  timestamp: string;
}

interface QRCodeEvent {
  sessionId: string;
  qrCode: string;
  timestamp: string;
}

interface MessageEvent {
  sessionId: string;
  message: Record<string, unknown>;
  timestamp: string;
}

interface WebSocketEvents {
  onSessionStatus?: (event: SessionStatusEvent) => void;
  onQRCode?: (event: QRCodeEvent) => void;
  onMessage?: (event: MessageEvent) => void;
}

interface WebSocketServerMessage {
  type: 'subscribed' | 'unsubscribed' | 'event' | 'error' | 'pong';
  payload?: {
    event: string;
    sessionId: string;
    data: unknown;
  };
  code?: string;
  message?: string;
  timestamp: string;
}

// Use current origin for WebSocket (goes through nginx proxy in Docker)
// Falls back to env var or localhost for development
const SOCKET_URL = import.meta.env.VITE_WS_URL || window.location.origin;

export function useWebSocket(events: WebSocketEvents = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    // Get API key from sessionStorage (same as api.ts)
    const apiKey = sessionStorage.getItem('openwa_api_key');

    if (!apiKey) {
      console.warn('[WebSocket] No API key found, skipping connection');
      return;
    }

    socketRef.current = io(`${SOCKET_URL}/events`, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: {
        apiKey,
      },
      extraHeaders: {
        'X-API-Key': apiKey,
      },
      query: {
        apiKey,
      },
    });

    socketRef.current.on('connect', () => {
      console.log('[WebSocket] Connected');
      setIsConnected(true);
      socketRef.current?.emit('message', {
        type: 'subscribe',
        sessionId: '*',
        events: ['*'],
        requestId: `dashboard-${Date.now()}`,
      });
    });

    socketRef.current.on('disconnect', () => {
      console.log('[WebSocket] Disconnected');
      setIsConnected(false);
    });

    socketRef.current.on('connect_error', error => {
      console.warn('[WebSocket] Connection error:', error.message);
    });
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [connect]);

  // Register event handlers
  useEffect(() => {
    if (!socketRef.current) return;

    const socket = socketRef.current;

    const handleServerMessage = (message: WebSocketServerMessage) => {
      if (message.type !== 'event' || !message.payload) return;

      const { event, sessionId, data } = message.payload;
      const timestamp = message.timestamp || new Date().toISOString();

      if (event === 'session.status' && events.onSessionStatus) {
        const statusData = data as { status?: string };
        if (statusData.status) {
          events.onSessionStatus({ sessionId, status: statusData.status, timestamp });
        }
      }

      if (event === 'session.qr' && events.onQRCode) {
        const qrData = data as { qrCode?: string };
        if (qrData.qrCode) {
          events.onQRCode({ sessionId, qrCode: qrData.qrCode, timestamp });
        }
      }

      if ((event === 'message.received' || event === 'message.sent') && events.onMessage) {
        events.onMessage({ sessionId, message: data as Record<string, unknown>, timestamp });
      }
    };

    socket.on('message', handleServerMessage);

    return () => {
      socket.off('message', handleServerMessage);
    };
  }, [events.onSessionStatus, events.onQRCode, events.onMessage]);

  return { isConnected };
}
