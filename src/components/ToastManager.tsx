import React, { useState, useCallback, useEffect } from 'react';
import ToastNotification from './ToastNotification';

interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'session' | 'order' | 'inventory' | 'billing';
  duration?: number;
}

interface ToastManagerProps {
  children: React.ReactNode;
}

export const ToastContext = React.createContext<{
  showToast: (toast: Omit<Toast, 'id'>) => void;
}>({
  showToast: () => {},
});

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const ToastManager: React.FC<ToastManagerProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast = { ...toast, id };
    setToasts(prev => [...prev, newToast]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // Add test functions to window for debugging
  useEffect(() => {
    (window as any).showToast = showToast;
    (window as any).testNotifications = () => {
      showToast({
        title: 'إشعار تجريبي 1',
        message: 'هذا إشعار تجريبي للاختبار',
        type: 'success'
      });

      setTimeout(() => {
        showToast({
          title: 'إشعار تجريبي 2',
          message: 'إشعار ثاني للاختبار',
          type: 'warning'
        });
      }, 1000);

      setTimeout(() => {
        showToast({
          title: 'إشعار تجريبي 3',
          message: 'إشعار ثالث للاختبار',
          type: 'error'
        });
      }, 2000);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((toast, index) => (
          <div
            key={toast.id}
            style={{
              transform: `translateY(-${(toasts.length - 1 - index) * 80}px)`,
            }}
          >
            <ToastNotification
              {...toast}
              onClose={removeToast}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastManager;
