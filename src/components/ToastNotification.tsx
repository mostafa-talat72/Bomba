import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, Clock } from 'lucide-react';

interface ToastNotificationProps {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'session' | 'order' | 'inventory' | 'billing';
  duration?: number;
  onClose: (id: string) => void;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({
  id,
  title,
  message,
  type,
  duration = 5000,
  onClose
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show notification after a small delay
    const showTimer = setTimeout(() => {
      setIsVisible(true);
    }, 100);

    // Auto hide after duration
    const hideTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose(id), 300); // Wait for animation to complete
    }, duration);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [id, duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'session':
        return <Clock className="h-5 w-5 text-blue-500" />;
      case 'order':
        return <CheckCircle className="h-5 w-5 text-purple-500" />;
      case 'inventory':
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case 'billing':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'session':
        return 'bg-blue-50 border-blue-200';
      case 'order':
        return 'bg-purple-50 border-purple-200';
      case 'inventory':
        return 'bg-orange-50 border-orange-200';
      case 'billing':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div
      className={`
        w-80 max-w-sm bg-white rounded-lg shadow-lg border-2 p-4 transition-all duration-300 ease-in-out
        ${getBackgroundColor()}
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <div className="flex items-start space-x-3 space-x-reverse" style={{ direction: 'rtl' }}>
        <div className="flex-shrink-0 mt-1">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900" style={{ textAlign: 'right' }}>
              {title}
            </h4>
            <button
              onClick={() => {
                setIsVisible(false);
                setTimeout(() => onClose(id), 300);
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200 mr-2"
              title="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1" style={{ textAlign: 'right' }}>
            {message}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ToastNotification;
