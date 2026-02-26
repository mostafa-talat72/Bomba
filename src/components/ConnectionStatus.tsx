import React, { useEffect, useState, useRef } from 'react';
import { WifiOff, AlertCircle, RefreshCw } from 'lucide-react';
import { HEALTH_CHECK_URL } from '../services/api';

interface ConnectionStatusProps {
  onRetry?: () => void;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ onRetry }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'checking'>('online');
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef(false);

  // فحص حالة الاتصال بالإنترنت
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      checkServerStatus();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setServerStatus('offline');
      setShowOfflineModal(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // فحص حالة السيرفر
  const checkServerStatus = async () => {
    // منع الفحص المتزامن
    if (isCheckingRef.current) return;
    
    isCheckingRef.current = true;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // تقليل الوقت إلى 3 ثوانٍ

      const response = await fetch(`${HEALTH_CHECK_URL}/health`, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-cache', // منع الـ cache
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const wasOffline = serverStatus === 'offline';
        setServerStatus('online');
        setShowOfflineModal(false);
        setLastChecked(new Date());
        
        // إذا كان السيرفر متوقف وعاد للعمل، أعد تحميل الصفحة
        if (wasOffline) {
          window.location.reload();
        }
      } else {
        setServerStatus('offline');
        setShowOfflineModal(true);
      }
    } catch (error) {
      setServerStatus('offline');
      setShowOfflineModal(true);
    } finally {
      isCheckingRef.current = false;
    }
  };

  // فحص دوري ومستمر لحالة السيرفر
  useEffect(() => {
    // فحص أولي
    checkServerStatus();
    
    // تم تعطيل الفحص الدوري المستمر
    // إذا أردت تفعيله مرة أخرى، قم بإلغاء التعليق على السطور التالية
    // checkIntervalRef.current = setInterval(checkServerStatus, 60000); // كل دقيقة بدلاً من 5 ثوانٍ

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);

  // عرض مؤشر الحالة في الزاوية - معطل افتراضياً
  const StatusIndicator = () => {
    // تم تعطيل المؤشر المستمر - سيظهر فقط عند انقطاع الاتصال الفعلي
    // من خلال events المتصفح (online/offline)
    if (!isOnline) {
      return (
        <div className="fixed top-4 left-4 z-50 flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg animate-pulse">
          <WifiOff className="w-5 h-5" />
          <span className="text-sm font-medium">
            لا يوجد اتصال بالإنترنت
          </span>
        </div>
      );
    }

    return null;
  };

  // Modal عند فقدان الاتصال - يظهر فقط عند انقطاع الاتصال الفعلي
  const OfflineModal = () => {
    // يظهر فقط عند انقطاع الاتصال بالإنترنت (من المتصفح)
    if (!showOfflineModal || isOnline) return null;

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 text-center">
          {/* أيقونة */}
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
          </div>

          {/* العنوان */}
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            انقطع الاتصال بالإنترنت
          </h2>

          {/* الوصف */}
          <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
            لا يوجد اتصال بالإنترنت. يرجى التحقق من اتصالك بالشبكة.
          </p>

          {/* حالة الفحص */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>في انتظار عودة الاتصال...</span>
            </div>
          </div>

          {/* أزرار */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                checkServerStatus();
                if (onRetry) onRetry();
              }}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              إعادة المحاولة
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-medium transition-colors"
            >
              إعادة تحميل
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <StatusIndicator />
      <OfflineModal />
    </>
  );
};

export default ConnectionStatus;
