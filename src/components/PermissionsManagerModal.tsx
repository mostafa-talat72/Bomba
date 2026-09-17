import React, { useState, useEffect } from 'react';
import { X, Save, Crown, Shield, AlertTriangle } from 'lucide-react';
import { User as UserType } from '../services/api';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import PermissionPicker from './PermissionPicker';

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
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
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

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-slideUp"
        dir={isRTL ? 'rtl' : 'ltr'}
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
                  {t('users.permissionsModal.title')}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('users.permissionsModal.subtitle')} {user.name}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-xs font-bold">
                    {user.role === 'admin' ? t('users.roles.admin') : user.role === 'staff' ? t('users.roles.staff') : user.role === 'cashier' ? t('users.roles.cashier') : t('users.roles.kitchen')}
                  </span>
                  {hasChanges && (
                    <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full text-xs font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {t('users.permissionsModal.unsavedChanges')}
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
                  {t('users.permissionsModal.summary')}
                </h3>
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm font-bold">
                  {selectedPermissions.length} {t('users.form.of')} {permissions.length}
                </span>
              </div>
              {selectedPermissions.includes('all') ? (
                <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                  <Crown className="w-5 h-5" />
                  <span className="font-bold">{t('users.permissionsModal.allPermissionsAccess')}</span>
                </div>
              ) : (
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  {selectedPermissions.length === 0 
                    ? t('users.noPermissions')
                    : t('users.permissionsModal.selectedCount', { count: selectedPermissions.length })
                  }
                </div>
              )}
            </div>

            {/* Permissions by Group */}
            <PermissionPicker
              permissions={permissions}
              selected={selectedPermissions}
              onChange={setSelectedPermissions}
            />
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
                    <span>{t('users.permissionsModal.saving')}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-6 h-6" />
                    <span>{t('users.permissionsModal.savePermissions')}</span>
                  </>
                )}
              </div>
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="px-6 py-4 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-xl transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 font-bold"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionsManagerModal;
