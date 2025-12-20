import React from 'react';
import { X, AlertTriangle, Lock } from 'lucide-react';
import { User as UserType } from '../services/api';

interface UserDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  user: UserType | null;
  password: string;
  onPasswordChange: (value: string) => void;
  error: string;
  loading: boolean;
}

const UserDeleteModal: React.FC<UserDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  user,
  password,
  onPasswordChange,
  error,
  loading,
}) => {
  if (!isOpen || !user) return null;

  const isAdmin = user.role === 'admin';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md animate-slideUp"
        dir="rtl"
      >
        {/* Header */}
        <div 
          className="p-6 border-b border-gray-200 dark:border-gray-700"
          style={{ 
            background: 'linear-gradient(135deg, #EF444415 0%, #DC262605 100%)'
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div
                className="p-4 rounded-2xl"
                style={{ 
                  background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                  boxShadow: '0 8px 24px -6px rgba(239, 68, 68, 0.6)'
                }}
              >
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                  تأكيد حذف المستخدم
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  هذا الإجراء لا يمكن التراجع عنه
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Warning Message */}
          <div className="p-4 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-900 dark:text-red-200 mb-1">
                  هل أنت متأكد من حذف المستخدم؟
                </p>
                <p className="text-sm text-red-700 dark:text-red-400">
                  سيتم حذف المستخدم <span className="font-bold">{user.name}</span> نهائياً من النظام
                </p>
              </div>
            </div>
          </div>

          {/* Password Input for Admin */}
          {isAdmin && (
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <Lock className="w-4 h-4 text-red-600" />
                كلمة المرور للتأكيد <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                placeholder="أدخل كلمة المرور لتأكيد الحذف..."
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all font-semibold"
                autoFocus
                disabled={loading}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                ⚠️ حذف مدير يتطلب تأكيد كلمة المرور
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/30 border-2 border-red-200 dark:border-red-800 rounded-xl animate-slideUp">
              <div className="flex items-start gap-3">
                <X className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t-2 border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-xl transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 font-bold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              إلغاء
            </button>
            <button
              onClick={onConfirm}
              disabled={loading || (isAdmin && !password)}
              className="flex-1 group relative overflow-hidden px-6 py-3 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-bold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
              <div className="relative flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5" />
                    <span>تأكيد الحذف</span>
                  </>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDeleteModal;
