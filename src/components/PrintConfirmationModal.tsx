import React from 'react';
import { Printer, X } from 'lucide-react';

interface PrintConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
}

const PrintConfirmationModal: React.FC<PrintConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'طباعة الفاتورة',
  message = 'هل تريد طباعة الفاتورة على الطابعة؟',
  confirmText = 'نعم، اطبع',
  cancelText = 'إلغاء',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="flex flex-col items-center text-center">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full mb-4">
              <Printer className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-6">{message}</p>
            
            <div className="flex justify-center space-x-3 w-full">
              <button
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex-1 max-w-[150px]"
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center flex-1 max-w-[150px]"
              >
                <Printer className="ml-2 h-4 w-4" />
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintConfirmationModal;
