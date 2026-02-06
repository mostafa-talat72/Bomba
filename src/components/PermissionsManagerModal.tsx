import React, { useState, useEffect } from 'react';
import { X, Save, Crown, Shield, Check, AlertTriangle } from 'lucide-react';
import { User as UserType } from '../services/api';

interface Permission {
  id: string;
  name: string;
  description: string;
}

interface PermissionsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType | null;
  permissions: Permission[];
  onUpdatePermissions: (userId: string, permissions: string[]) => Promise<void>;
}

const PermissionsManagerModal: React.FC<PermissionsManagerModalProps> = ({
  isOpen,
  onClose,
  user,
  permissions,
  onUpdatePermissions,
}) => {
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (user) {
      setSelectedPermissions(user.permissions || []);
      setHasChanges(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const originalPermissions = user.permissions || [];
      const hasChanged = 
        selectedPermissions.length !== originalPermissions.length ||
        selectedPermissions.some(p => !originalPermissions.includes(p)) ||
        originalPermissions.some(p => !selectedPermissions.includes(p));
      setHasChanges(hasChanged);
    }
  }, [selectedPermissions, user]);

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    setSelectedPermissions(prev => {
      let newPermissions: string[];

      if (permissionId === 'all') {
        if (checked) {
          newPermissions = ['all'];
        } else {
          newPermissions = prev.filter(p => p !== 'all');
        }
      } else {
        if (checked) {
          const filteredPermissions = prev.filter(p => p !== 'all');
          newPermissions = [...filteredPermissions, permissionId];
        } else {
          newPermissions = prev.filter(p => p !== permissionId);
        }
      }

      return newPermissions;
    });
  };

  const handleSave = async () => {
    if (!user || !hasChanges) return;

    try {
      setLoading(true);
      await onUpdatePermissions(user.id, selectedPermissions);
      onClose();
    } catch (error) {
      console.error('Error updating permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPermissionsByCategory = () => {
    const categories = {
      'إدارة النظام': ['all', 'users', 'settings'],
      'التقارير والإحصائيات': ['dashboard', 'reports', 'consumption'],
      'الألعاب': ['playstation', 'computer'],
      'المطعم والكافيه': ['cafe', 'menu', 'inventory'],
      'المالية': ['billing', 'costs'],
    };

    return categories;
  };

  if (!isOpen || !user) return null;

  const categories = getPermissionsByCategory();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-slideUp"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  إدارة صلاحيات المستخدم
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  تحديد الصلاحيات لـ {user.name}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-xs font-bold">
                    {user.role === 'admin' ? 'مدير' : user.role === 'staff' ? 'موظف' : user.role === 'cashier' ? 'كاشير' : 'مطبخ'}
                  </span>
                  {hasChanges && (
                    <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full text-xs font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      تغييرات غير محفوظة
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
            {/* Current Permissions Summary */}
            <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  ملخص الصلاحيات
                </h3>
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm font-bold">
                  {selectedPermissions.length} من {permissions.length}
                </span>
              </div>
              {selectedPermissions.includes('all') ? (
                <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                  <Crown className="w-5 h-5" />
                  <span className="font-bold">جميع الصلاحيات - وصول كامل للنظام</span>
                </div>
              ) : (
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  {selectedPermissions.length === 0 
                    ? 'لا توجد صلاحيات محددة' 
                    : `تم تحديد ${selectedPermissions.length} صلاحية`
                  }
                </div>
              )}
            </div>

            {/* Permissions by Category */}
            <div className="space-y-6">
              {Object.entries(categories).map(([categoryName, categoryPermissions]) => (
                <div key={categoryName} className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 border-2 border-gray-200 dark:border-gray-600 rounded-xl p-5">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <div className="w-3 h-3 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full"></div>
                    {categoryName}
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    {categoryPermissions.map(permissionId => {
                      const permission = permissions.find(p => p.id === permissionId);
                      if (!permission) return null;

                      const isChecked = selectedPermissions.includes(permissionId);
                      const isDisabled = selectedPermissions.includes('all') && permissionId !== 'all';

                      return (
                        <label 
                          key={permissionId}
                          className={`flex items-start p-4 bg-white dark:bg-gray-700 border-2 rounded-xl transition-all cursor-pointer group ${
                            isChecked 
                              ? 'border-green-300 dark:border-green-500 bg-green-50 dark:bg-green-900/20' 
                              : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'
                          } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="relative">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => handlePermissionChange(permissionId, e.target.checked)}
                              disabled={isDisabled}
                              className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-5 h-5"
                            />
                            {isChecked && (
                              <Check className="absolute top-0.5 left-0.5 w-4 h-4 text-green-600 pointer-events-none" />
                            )}
                          </div>
                          <div className="mr-3 flex-1">
                            <div className={`text-sm font-bold transition-colors ${
                              isChecked 
                                ? 'text-green-900 dark:text-green-200' 
                                : 'text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                            }`}>
                              {permission.name}
                              {permissionId === 'all' && (
                                <Crown className="inline w-4 h-4 mr-1 text-purple-600" />
                              )}
                            </div>
                            <div className={`text-xs mt-1 ${
                              isChecked 
                                ? 'text-green-700 dark:text-green-400' 
                                : 'text-gray-500 dark:text-gray-400'
                            }`}>
                              {permission.description}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t-2 border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 flex-shrink-0">
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={loading || !hasChanges}
              className="flex-1 group relative overflow-hidden px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 font-bold text-lg"
            >
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
              <div className="relative flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-6 h-6" />
                    <span>حفظ الصلاحيات</span>
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

export default PermissionsManagerModal;