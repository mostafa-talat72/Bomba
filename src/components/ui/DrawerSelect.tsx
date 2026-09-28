import React from 'react';
import { useTranslation } from 'react-i18next';
import { CASH_DRAWERS, drawerLabel, drawerIcon, type CashDrawer } from '../../utils/paymentDrawer';

interface DrawerSelectProps {
  value: CashDrawer;
  onChange: (drawer: CashDrawer) => void;
  className?: string;
  disabled?: boolean;
  showLabels?: boolean;
}

export const DrawerSelect: React.FC<DrawerSelectProps> = ({
  value,
  onChange,
  className = '',
  disabled = false,
  showLabels = true,
}) => {
  const { t } = useTranslation();

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as CashDrawer)}
      disabled={disabled}
      className={`px-2 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-orange-400 outline-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {CASH_DRAWERS.map(d => (
        <option key={d} value={d}>
          {showLabels ? `${drawerIcon(d)} ${drawerLabel(d, t)}` : d}
        </option>
      ))}
    </select>
  );
};

export default DrawerSelect;
