import React, { useCallback } from 'react';
import { ToastContainer, toast, ToastOptions } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { CheckCircle, AlertCircle, Info, Clock } from 'lucide-react';

interface ToastManagerProps {
  children: React.ReactNode;
}

export const ToastContext = React.createContext<{
  showToast: (toast: {
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info' | 'session' | 'order' | 'inventory' | 'billing';
    duration?: number;
  }) => void;
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
  const showToast = useCallback((toastData: {
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info' | 'session' | 'order' | 'inventory' | 'billing';
    duration?: number;
  }) => {
    const { title, message, type, duration = 5000 } = toastData;

    const getIcon = () => {
      switch (type) {
        case 'success':
          return <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />;
        case 'error':
          return <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />;
        case 'warning':
          return <AlertCircle className="h-5 w-5 text-orange-500 flex-shrink-0" />;
        case 'session':
          return <Clock className="h-5 w-5 text-orange-500 flex-shrink-0" />;
        case 'order':
          return <CheckCircle className="h-5 w-5 text-orange-500 flex-shrink-0" />;
        case 'inventory':
          return <AlertCircle className="h-5 w-5 text-orange-500 flex-shrink-0" />;
        case 'billing':
          return <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />;
        default:
          return <Info className="h-5 w-5 text-orange-500 flex-shrink-0" />;
      }
    };

    const getBackgroundColor = () => {
      switch (type) {
        case 'success':
          return 'bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-700';
        case 'error':
          return 'bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-700';
        case 'warning':
          return 'bg-orange-50 dark:bg-orange-900 border-orange-200 dark:border-orange-700';
        case 'session':
          return 'bg-orange-50 dark:bg-orange-900 border-orange-200 dark:border-orange-700';
        case 'order':
          return 'bg-orange-50 dark:bg-orange-900 border-orange-200 dark:border-orange-700';
        case 'inventory':
          return 'bg-orange-50 dark:bg-orange-900 border-orange-200 dark:border-orange-700';
        case 'billing':
          return 'bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-700';
        default:
          return 'bg-orange-50 dark:bg-orange-900 border-orange-200 dark:border-orange-700';
      }
    };

    // Custom toast content
    const ToastContent = () => (
      <div className="flex items-start space-x-3 space-x-reverse" style={{ direction: 'rtl' }}>
        <div className="flex-shrink-0 mt-1">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1" style={{ textAlign: 'right' }}>
            {title}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line" style={{ textAlign: 'right' }}>
            {message}
          </p>
        </div>
      </div>
    );

    const options: ToastOptions = {
      autoClose: duration,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      className: `custom-toast ${getBackgroundColor()}`,
      bodyClassName: 'custom-toast-body',
      progressClassName: 'custom-toast-progress',
    };

    // Show toast based on type
    switch (type) {
      case 'success':
        toast.success(<ToastContent />, options);
        break;
      case 'error':
        toast.error(<ToastContent />, options);
        break;
      case 'warning':
        toast.warning(<ToastContent />, options);
        break;
      case 'info':
        toast.info(<ToastContent />, options);
        break;
      default:
        toast(<ToastContent />, options);
    }
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer
        position="bottom-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={true}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        style={{
          zIndex: 999999,
        }}
      />
    </ToastContext.Provider>
  );
};

export default ToastManager;
