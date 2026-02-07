import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
  showCloseButton?: boolean;
  zIndex?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-md',
  showCloseButton = true,
  zIndex = 'z-50'
}) => {
  // إضافة دعم مفتاح ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`modal-backdrop fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center ${zIndex} p-2 sm:p-4`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={`modal-content bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full ${maxWidth} max-h-[95vh] sm:max-h-[90vh] overflow-y-auto mx-2 sm:mx-0`}>
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 sm:px-6 py-3 sm:py-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate pr-2">{title}</h2>
            {showCloseButton && (
              <button
                className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xl sm:text-2xl font-bold transition-colors duration-200 flex-shrink-0"
                onClick={onClose}
              >
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            )}
          </div>
        </div>
        <div className="p-3 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
