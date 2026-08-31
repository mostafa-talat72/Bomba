import React from 'react';
import { AlertTriangle, LogOut, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ModalPortal from './ModalPortal';

interface OccupiedTablesWarningModalProps {
  isOpen: boolean;
  occupiedTablesCount: number;
  occupiedTablesNames: string[];
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  actionType?: 'logout' | 'close'; // نوع الإجراء (تسجيل خروج أو إغلاق التطبيق)
}

const OccupiedTablesWarningModal: React.FC<OccupiedTablesWarningModalProps> = ({
  isOpen,
  occupiedTablesCount,
  occupiedTablesNames,
  onConfirm,
  onCancel,
  isLoading = false,
  actionType = 'logout'
}) => {
  const { t } = useTranslation();

  if (!isOpen || occupiedTablesCount === 0) return null;

  const actionText = actionType === 'logout' 
    ? t('auth.logout', 'تسجيل الخروج')
    : t('app.closeApp', 'إغلاق التطبيق');

  const warningText = actionType === 'logout'
    ? t('tables.occupiedWarningLogout', 'هناك طاولات مشغولة. لن يتم إنهاء الجلسات تلقائياً.')
    : t('tables.occupiedWarningClose', 'هناك طاولات مشغولة. قد تفقد البيانات غير المحفوظة.');

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-red-200 dark:border-red-800">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('tables.occupiedTablesWarning', 'تحذير: طاولات مشغولة')}
            </h2>
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="ml-auto p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-4 mb-6">
            {/* Warning Message */}
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-300 font-medium">
                {warningText}
              </p>
            </div>

            {/* Occupied Tables Count */}
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-2">
                {t('tables.occupiedCount', `${occupiedTablesCount} طاولة مشغولة`)}
              </p>
              {occupiedTablesNames.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {occupiedTablesNames.map((name, idx) => (
                    <span
                      key={idx}
                      className="inline-block px-2.5 py-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-full text-xs font-medium"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Confirmation Message */}
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                {actionType === 'logout'
                  ? t('tables.confirmLogoutWithOccupied', 'هل تريد فعلاً تسجيل الخروج؟ ستبقى الطاولات مشغولة.')
                  : t('tables.confirmCloseWithOccupied', 'هل تريد فعلاً إغلاق التطبيق؟ قد تفقد البيانات غير المحفوظة.')}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.cancel', 'إلغاء')}
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              <LogOut className="w-4 h-4" />
              {actionText}
            </button>
          </div>

          {/* Info */}
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
            <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
              💡 {t('tables.occupiedTablesInfo', 'تلميح: يمكنك إغلاق الطاولات المشغولة من صفحة الطاولات أولاً ثم تسجيل الخروج.')}
            </p>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default OccupiedTablesWarningModal;
