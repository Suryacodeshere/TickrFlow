'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinEvent: (eventId: number | string) => void;
  leaveEvent: (eventId: number | string) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  joinEvent: () => {},
  leaveEvent: () => {},
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    console.log(`🔌 Initializing Socket.IO client, connecting to: ${backendUrl}`);

    const socketInstance = io(backendUrl, {
      autoConnect: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      console.log('✅ WebSockets Connected!');
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('❌ WebSockets Disconnected');
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      console.log('🔌 Cleaning up socket connection...');
      socketInstance.disconnect();
    };
  }, []);

  const joinEvent = (eventId: number | string) => {
    if (socket) {
      socket.emit('join:event', eventId);
      console.log(`📡 Emitted join:event for event: ${eventId}`);
    }
  };

  const leaveEvent = (eventId: number | string) => {
    if (socket) {
      socket.emit('leave:event', eventId);
      console.log(`📡 Emitted leave:event for event: ${eventId}`);
    }
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, joinEvent, leaveEvent }}>
      {children}
    </SocketContext.Provider>
  );
};
