import React from 'react';
import { useCurrency } from '../hooks/useCurrency';

interface CurrencyDisplayProps {
  amount: number | string | null | undefined;
  className?: string;
}

/**
 * Component to display currency values using organization settings
 */
export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({ amount, className = '' }) => {
  const { formatCurrency } = useCurrency();
  
  return <span className={className}>{formatCurrency(Number(amount || 0))}</span>;
};

export default CurrencyDisplay;
