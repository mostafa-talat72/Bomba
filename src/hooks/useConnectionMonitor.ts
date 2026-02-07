import { useState, useEffect, useCallback } from 'react';
import { HEALTH_CHECK_URL } from '../services/api';

interface ConnectionState {
  isOnline: boolean;
  serverOnline: boolean;
  lastChecked: Date | null;
  error: string | null;
}

export const useConnectionMonitor = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isOnline: navigator.onLine,
    serverOnline: true,
    lastChecked: null,
    error: null,
  });

  const checkServerHealth = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${HEALTH_CHECK_URL}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setConnectionState(prev => ({
          ...prev,
          serverOnline: true,
          lastChecked: new Date(),
          error: null,
        }));
        return true;
      } else {
        setConnectionState(prev => ({
          ...prev,
          serverOnline: false,
          lastChecked: new Date(),
          error: 'السيرفر لا يستجيب',
        }));
        return false;
      }
    } catch (error) {
      setConnectionState(prev => ({
        ...prev,
        serverOnline: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'خطأ في الاتصال بالسيرفر',
      }));
      return false;
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setConnectionState(prev => ({ ...prev, isOnline: true }));
      checkServerHealth();
    };

    const handleOffline = () => {
      setConnectionState(prev => ({
        ...prev,
        isOnline: false,
        serverOnline: false,
        error: 'لا يوجد اتصال بالإنترنت',
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // فحص أولي
    checkServerHealth();

    // فحص دوري كل 30 ثانية
    const interval = setInterval(checkServerHealth, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [checkServerHealth]);

  return {
    ...connectionState,
    isConnected: connectionState.isOnline && connectionState.serverOnline,
    checkServerHealth,
  };
};
