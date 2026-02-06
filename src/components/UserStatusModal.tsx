import React, { useState } from 'react';
import { X, Save, UserCheck, UserX, Shield, AlertTriangle } from 'lucide-react';
import { User as UserType } from '../services/api';

interface UserStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType | null;
  onUpdateStatus: (userId: string, status: string) => Promise<void>;
}

const UserStatusModal: React.FC<UserStatusModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateStatus,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (user) {
      setSelectedStatus(user.status);
    }
  }, [user]);

  const statusOptions = [
    {
      id: 'active',
      name: 'نشط',
      description: 'المستخدم يمكنه تسجيل الدخول واستخدام النظام',
      icon: UserCheck,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      borderColor: 'border-green-300',
    },
    {
      id: 'inactive',
      name: 'غير نشط',
      description: 'المستخدم لا يمكنه تسجيل الدخول',
      icon: UserX,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      borderColor: 'border-red-300',
    },
    {
      id: 'suspended',
      name: 'معلق',
      description: 'المستخدم معلق مؤقتاً ولا يمكنه الوصول للنظام',
      icon: Shield,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      borderColor: 'border-yellow-300',
    },
  ];

  const handleSave = async () => {
    if (!user || selectedStatus === user.status) return;

    try {
      setLoading(true);
      await onUpdateStatus(user.id, selectedStatus);
      onClose();
    } catch (error) {
      console.error('Error updating user status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (statusId: string) => {
    return statusOptions.find(s => s.id === statusId) || statusOptions[0];
  };

  if (!isOpen || !user) return null;

  const currentStatusInfo = getStatusInfo(user.status);
  const newStatusInfo = getStatusInfo(selectedStatus);
  const hasChanges = selectedStatus !== user.status;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-slideUp"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className={`p-4 rounded-2xl shadow-lg ${currentStatusInfo.bgColor}`}>
                <currentStatusInfo.icon className={`w-6 h-6 ${currentStatusInfo.color}`} />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  تغيير حالة المستخدم
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  تحديث حالة {user.name}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${currentStatusInfo.bgColor} ${currentStatusInfo.color}`}>
                    الحالة الحالية: {currentStatusInfo.name}
                  </span>
                  {hasChanges && (
                    <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full text-xs font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      تغيير معلق
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 modern-scrollbar">
          <div className="space-y-6">
            {/* Status Options */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                اختر الحالة الجديدة:
              </h3>
              <div className="space-y-3">
                {statusOptions.map(status => {
                  const StatusIcon = status.icon;
                  const isSelected = selectedStatus === status.id;
                  const isCurrent = user.status === status.id;

                  return (
                    <label 
                      key={status.id}
                      className={`flex items-start p-4 border-2 rounded-xl transition-all cursor-pointer group ${
                        isSelected 
                          ? `${status.borderColor} ${status.bgColor}` 
                          : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-blue-300 dark:hover:border-blue-500'
                      }`}
                    >
                      <input
                        type="radio"
                        name="status"
                        value={status.id}
                        checked={isSelected}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="mt-1 w-5 h-5"
                      />
                      <div className="mr-3 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <StatusIcon className={`w-5 h-5 ${isSelected ? status.color : 'text-gray-500'}`} />
                          <span className={`text-lg font-bold ${isSelected ? status.color : 'text-gray-900 dark:text-gray-100'}`}>
                            {status.name}
                          </span>
                          {isCurrent && (
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-bold">
                              الحالة الحالية
                            </span>
                          )}
                        </div>
                        <p className={`text-sm ${isSelected ? status.color : 'text-gray-600 dark:text-gray-400'}`}>
                          {status.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Warning for status change */}
            {hasChanges && (
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-lg font-bold text-amber-900 dark:text-amber-200 mb-2">
                      تأكيد تغيير الحالة
                    </h4>
                    <p className="text-sm text-amber-800 dark:text-amber-300 mb-3">
                      ستقوم بتغيير حالة المستخدم من "{currentStatusInfo.name}" إلى "{newStatusInfo.name}".
                    </p>
                    {selectedStatus === 'inactive' && (
                      <p className="text-sm text-red-700 dark:text-red-400 font-semibold">
                        ⚠️ المستخدم لن يتمكن من تسجيل الدخول بعد هذا التغيير.
                      </p>
                    )}
                    {selectedStatus === 'suspended' && (
                      <p className="text-sm text-yellow-700 dark:text-yellow-400 font-semibold">
                        ⚠️ المستخدم سيتم تعليقه مؤقتاً ولن يتمكن من الوصول للنظام.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t-2 border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 flex-shrink-0">
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={loading || !hasChanges}
              className="flex-1 group relative overflow-hidden px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 font-bold text-lg"
            >
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
              <div className="relative flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>جاري التحديث...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-6 h-6" />
                    <span>تحديث الحالة</span>
                  </>
                )}
              </div>
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="px-6 py-4 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-xl transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 font-bold"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserStatusModal;