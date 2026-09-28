import React from 'react';
import { useTranslation } from 'react-i18next';
import { PAYMENT_METHODS, paymentMethodLabel, paymentMethodIcon, type PaymentMethod } from '../../utils/paymentMethod';

interface PaymentMethodSelectProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  className?: string;
  disabled?: boolean;
  showLabels?: boolean;
}

export const PaymentMethodSelect: React.FC<PaymentMethodSelectProps> = ({
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
      onChange={e => onChange(e.target.value as PaymentMethod)}
      disabled={disabled}
      className={`px-2 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-orange-400 outline-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {PAYMENT_METHODS.map(m => (
        <option key={m} value={m}>
          {showLabels ? `${paymentMethodIcon(m)} ${paymentMethodLabel(m, t)}` : m}
        </option>
      ))}
    </select>
  );
};

export default PaymentMethodSelect;
