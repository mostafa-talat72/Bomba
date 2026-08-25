import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Table as TableIcon } from 'lucide-react';
import { Bill } from '../../services/api';
import { getTableDisplay } from './tableHelpers';

// Memoized PlayStation Bill Item
const PlaystationBillItem = memo(({ bill, onPaymentClick, onChangeTableClick, getStatusColor, getStatusText, formatCurrency }: {
  bill: Bill; onPaymentClick: (bill: Bill) => void; onChangeTableClick?: (bill: Bill) => void;
  getStatusColor: (s: string) => string; getStatusText: (s: string) => string; formatCurrency: (a: number) => string;
}) => {
  const { t, i18n } = useTranslation();
  const isUnpaid = ['draft', 'partial', 'overdue'].includes(bill.status);
  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 rounded-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg border-2 gap-3 sm:gap-0
      ${isUnpaid ? 'bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-orange-300 dark:border-orange-700' : 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-300 dark:border-green-700'}`}>
      <div className="flex-1 cursor-pointer w-full sm:w-auto" onClick={() => onPaymentClick(bill)}>
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100">#{bill.billNumber || bill.id || bill._id}</span>
          <span className={`px-2 sm:px-3 py-1 text-xs font-bold rounded-full shadow-sm ${getStatusColor(bill.status)}`}>{getStatusText(bill.status)}</span>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          {bill.table?.number ? (
            <span className="flex items-center text-blue-600 dark:text-blue-400 font-medium">🪑 {t('billing.tableWithNumber', { number: getTableDisplay(bill.table.number, i18n.language) })}</span>
          ) : (
            <span className="flex items-center text-gray-500">⚠️ {t('billing.notLinkedToTable')}</span>
          )}
          <span className="font-medium">{formatCurrency(bill.total || 0)}</span>
        </div>
      </div>
      <div className="flex flex-row items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
        <div className="text-center bg-white dark:bg-gray-800 px-2 sm:px-3 py-2 rounded-lg shadow-sm">
          <div className={`text-sm sm:text-base font-bold ${isUnpaid ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>{formatCurrency(bill.remaining || 0)}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{t('billing.remainingAmount')}</div>
        </div>
        {onChangeTableClick && (
          <button onClick={(e) => { e.stopPropagation(); onChangeTableClick(bill); }}
            className="px-2 sm:px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm rounded-lg transition-all flex items-center gap-1 shadow-md">
            <TableIcon className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">{t('billing.change')}</span>
          </button>
        )}
      </div>
    </div>
  );
});

export default PlaystationBillItem;
