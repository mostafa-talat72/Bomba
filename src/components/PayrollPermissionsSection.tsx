import { useState, useEffect } from 'react';
import { Users, Check, AlertCircle, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PayrollPermissionsSectionProps {
  isOwner: boolean;
  onSave: (permissions: PayrollPermissions) => Promise<void>;
  initialPermissions?: PayrollPermissions;
  availableManagers: Array<{ _id: string; name: string; email: string }>;
}

interface PayrollPermissions {
  allowManagersToManagePayroll: boolean;
  authorizedPayrollManagers: string[];
}

export const PayrollPermissionsSection: React.FC<PayrollPermissionsSectionProps> = ({
  isOwner,
  onSave,
  initialPermissions,
  availableManagers
}) => {
  const { t } = useTranslation();
  const [permissions, setPermissions] = useState<PayrollPermissions>({
    allowManagersToManagePayroll: false,
    authorizedPayrollManagers: [],
    ...initialPermissions
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialPermissions) {
      setPermissions(prev => ({ ...prev, ...initialPermissions }));
    }
  }, [initialPermissions]);

  const handleToggleManager = (managerId: string) => {
    setPermissions(prev => {
      const isSelected = prev.authorizedPayrollManagers.includes(managerId);
      return {
        ...prev,
        authorizedPayrollManagers: isSelected
          ? prev.authorizedPayrollManagers.filter(id => id !== managerId)
          : [...prev.authorizedPayrollManagers, managerId]
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(permissions);
    } finally {
      setSaving(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 ml-3 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              {t('settings.organization.payroll.noPermission.title')}
            </h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              {t('settings.organization.payroll.noPermission.message')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center">
          <Users className="h-5 w-5 ml-2 text-blue-600" />
          {t('settings.organization.payroll.permissions.title')}
        </h3>
        <span className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-xs px-2 py-1 rounded-full">
          {t('settings.organization.payroll.permissions.ownerOnly')}
        </span>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-1">
              {t('settings.organization.payroll.permissions.allowManagers')}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('settings.organization.payroll.permissions.allowManagersDesc')}
            </p>
          </div>
          <button
            onClick={() => setPermissions(prev => ({ 
              ...prev, 
              allowManagersToManagePayroll: !prev.allowManagersToManagePayroll 
            }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              permissions.allowManagersToManagePayroll
                ? 'bg-blue-600'
                : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                permissions.allowManagersToManagePayroll ? 'translate-x-1' : 'translate-x-6'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Authorized Managers */}
      {permissions.allowManagersToManagePayroll && availableManagers.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center">
            <Users className="h-5 w-5 ml-2 text-blue-600" />
            {t('settings.organization.payroll.permissions.authorizedManagers')}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {t('settings.organization.payroll.permissions.selectManagers')}
          </p>
          <div className="space-y-2">
            {availableManagers.map((manager) => (
              <div
                key={manager._id}
                className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {manager.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {manager.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleManager(manager._id)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    permissions.authorizedPayrollManagers.includes(manager._id)
                      ? 'bg-blue-600 border-blue-600'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {permissions.authorizedPayrollManagers.includes(manager._id) && (
                    <Check className="h-3 w-3 text-white" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Managers Available */}
      {permissions.allowManagersToManagePayroll && availableManagers.length === 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 ml-3 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                {t('settings.organization.payroll.permissions.noManagers')}
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                {t('settings.organization.permissions.noManagers')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-6 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{t('common.saving')}</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>{t('settings.organization.payroll.permissions.savePermissions')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
