import React from 'react';
import { ShieldOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';

interface PermissionDeniedProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

const PermissionDenied: React.FC<PermissionDeniedProps> = ({ 
  message, 
  size = 'medium' 
}) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const sizeClasses = {
    small: 'p-3 text-sm',
    medium: 'p-4 text-base',
    large: 'p-6 text-lg'
  };

  const iconSizes = {
    small: 'w-8 h-8',
    medium: 'w-12 h-12',
    large: 'w-16 h-16'
  };

  return (
    <div 
      className={`bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl ${sizeClasses[size]} flex items-center gap-3`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="bg-red-100 dark:bg-red-900/40 p-2 rounded-lg">
        <ShieldOff className={`${iconSizes[size]} text-red-600 dark:text-red-400`} />
      </div>
      <div className="flex-1">
        <p className="font-bold text-red-900 dark:text-red-200">
          {message || t('common.permissionDenied')}
        </p>
        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
          {t('common.contactAdmin')}
        </p>
      </div>
    </div>
  );
};

export default PermissionDenied;
