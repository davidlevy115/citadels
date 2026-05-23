import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // In production (single service), connect to same origin.
    // In dev, connect to the separate server on port 3001.
    const url =
      process.env.NEXT_PUBLIC_SERVER_URL ||
      (typeof window !== 'undefined' && window.location.port === '3000'
        ? 'http://localhost:3001'
        : undefined);

    socket = io(url ?? '', {
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}
