import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const SocketConnectionStatus: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [showDisconnected, setShowDisconnected] = useState(false);

  useEffect(() => {
    // إنشاء اتصال Socket.IO
    if (!socket) {
      socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
      });
    }

    const handleConnect = () => {
      setIsConnected(true);
      setShowDisconnected(false);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      // إظهار رسالة الانقطاع بعد 3 ثوانٍ
      setTimeout(() => {
        if (!socket?.connected) {
          setShowDisconnected(true);
        }
      }, 3000);
    };

    const handleReconnect = () => {
      setIsConnected(true);
      setShowDisconnected(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnect', handleReconnect);

    // التحقق من الحالة الأولية
    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket?.off('connect', handleConnect);
      socket?.off('disconnect', handleDisconnect);
      socket?.off('reconnect', handleReconnect);
    };
  }, []);

  // عدم عرض أي شيء إذا كان متصل
  if (isConnected || !showDisconnected) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg animate-pulse">
      <WifiOff className="w-5 h-5" />
      <span className="text-sm font-medium">
        انقطع الاتصال بالتحديثات الفورية
      </span>
    </div>
  );
};

export default SocketConnectionStatus;
