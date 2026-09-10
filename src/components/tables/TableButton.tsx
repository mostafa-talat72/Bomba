import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table as TableIcon, ShoppingCart, DollarSign, Plus, Clock, Printer, ArrowLeftRight, Edit } from 'lucide-react';
import { Table, Bill } from '../../services/api';
import { formatCurrency as formatCurrencyUtil } from '../../utils/formatters';
import { getTableDisplay, getAgeLabel, getTableAgeColor } from './tableHelpers';

export interface TableButtonProps {
  table: Table;
  isSelected: boolean;
  isOccupied: boolean;
  tableBills: Bill[];
  tableOrdersCount: number;
  activeSessionType: 'playstation' | 'computer' | 'both' | null;
  /** عدد الجلسات النشطة على الطاولة */
  activeSessionCount?: number;
  /** مستوى تحذير مدة الجلسة */
  sessionUrgency?: 'none' | 'warn' | 'danger';
  onClick: (table: Table) => void;
  onOpen?: (table: Table, e: React.MouseEvent) => void;
  onQuickOrder: (table: Table, e: React.MouseEvent) => void;
  onQuickBilling: (table: Table, e: React.MouseEvent) => void;
  onEndAllSessions?: (table: Table, e: React.MouseEvent) => void;
  onQuickPrint?: (table: Table, e: React.MouseEvent) => void;
  onQuickChangeTable?: (table: Table, e: React.MouseEvent) => void;
  onQuickEditBill?: (table: Table, e: React.MouseEvent) => void;
  onHoverChange?: (table: Table | null) => void;
  /** تكلفة إضافية حية للجلسات النشطة (delta كل 10 ثوانٍ) */
  liveExtra?: number;
}

const TableButton = React.memo<TableButtonProps>(({ table, isSelected, isOccupied, tableBills, tableOrdersCount, activeSessionType, activeSessionCount = 0, sessionUrgency = 'none', onClick, onOpen, onQuickOrder, onQuickBilling, onEndAllSessions, onQuickPrint, onQuickChangeTable, onQuickEditBill, onHoverChange, liveExtra = 0 }) => {
  const { t, i18n } = useTranslation();
  const [showTooltip, setShowTooltip] = useState(false);

  const ageLabel = isOccupied ? getAgeLabel(tableBills) : '';
  const ageColor = isOccupied ? getTableAgeColor(tableBills) : null;
  const totalRemaining = tableBills
    .filter(b => ['draft', 'partial', 'overdue'].includes(b.status))
    .reduce((s, b) => s + (b.remaining || 0), 0);
  const liveRemaining = totalRemaining + (liveExtra || 0);

  // ── ثلاث حالات فقط ──────────────────────────────────────────────────────
  // 1. فارغة  → رمادي
  // 2. مشغولة → أحمر موحد (badge الوقت هو المؤشر الوحيد)
  // 3. محددة  → برتقالي

  const styles = isSelected
    ? {
        card:   'border-orange-400 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/40 dark:to-orange-800/30 shadow-lg ring-2 ring-orange-300 dark:ring-orange-700',
        icon:   'bg-orange-500',
        text:   'text-orange-700 dark:text-orange-300',
        sub:    'text-orange-500 dark:text-orange-400',
        hover:  'bg-orange-400/10',
        badge:  'bg-orange-500',
      }
    : isOccupied
    ? {
        card:   sessionUrgency === 'danger'
                  ? 'border-red-500 bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-900/40 dark:to-red-800/30 hover:border-red-600 shadow-lg shadow-red-200 dark:shadow-red-900/40 ring-2 ring-red-400 dark:ring-red-600 animate-pulse'
                  : sessionUrgency === 'warn'
                  ? 'border-amber-400 bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-900/40 dark:to-amber-800/30 hover:border-amber-500 shadow-lg shadow-amber-100 dark:shadow-amber-900/30 ring-2 ring-amber-300 dark:ring-amber-700'
                  : 'border-red-400 bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-900/40 dark:to-red-800/30 hover:border-red-500 hover:shadow-lg hover:shadow-red-100 dark:hover:shadow-red-900/30',
        icon:   'bg-red-500',
        text:   'text-red-700 dark:text-red-300',
        sub:    'text-red-500 dark:text-red-400',
        hover:  'bg-red-400/10',
        badge:  ageColor === 'red'    ? 'bg-red-600'
               : ageColor === 'orange' ? 'bg-orange-500'
               : ageColor === 'yellow' ? 'bg-yellow-500'
               : 'bg-blue-500',
      }
    : {
        card:   'border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 hover:border-gray-300 hover:shadow-lg hover:shadow-gray-100 dark:hover:shadow-gray-900/30',
        icon:   'bg-gray-400 dark:bg-gray-500',
        text:   'text-gray-600 dark:text-gray-300',
        sub:    'text-gray-400 dark:text-gray-500',
        hover:  'bg-gray-400/10',
        badge:  'bg-gray-400',
      };

  return (
    <div
      className="relative h-full"
      onMouseEnter={() => { setShowTooltip(true); onHoverChange?.(table); }}
      onMouseLeave={() => { setShowTooltip(false); onHoverChange?.(null); }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onClick(table)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(table); } }}
        className={`group relative w-full h-full flex flex-col rounded-xl sm:rounded-2xl border-2 transition-all duration-300 transform hover:scale-[1.02] hover:-translate-y-0.5 cursor-pointer ${styles.card}`}
      >
        {/* ── وقت / حالة badge ── */}
        <div className="absolute -top-2 -right-2 z-10">
          {isSelected ? (
            <span className="flex items-center justify-center px-2 h-5 bg-orange-500 text-white text-xs font-bold rounded-full shadow border-2 border-white dark:border-gray-800">
              {t('cafe.selected')}
            </span>
          ) : isOccupied ? (
            <span className={`flex items-center justify-center px-2 h-5 ${styles.badge} text-white text-xs font-bold rounded-full shadow border-2 border-white dark:border-gray-800 ${ageColor === 'red' ? 'animate-pulse' : ''}`}>
              {ageLabel || t('cafe.occupied')}
            </span>
          ) : (
            <span className="flex items-center justify-center px-2 h-5 bg-gray-400 dark:bg-gray-500 text-white text-xs font-bold rounded-full shadow border-2 border-white dark:border-gray-800">
              {t('cafe.empty')}
            </span>
          )}
        </div>

        {/* ── orders count badge ── */}
        {isOccupied && tableOrdersCount > 0 && (
          <div className="absolute -top-2 -left-2 z-10 w-5 h-5 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow border border-white dark:border-gray-800">
            {tableOrdersCount}
          </div>
        )}

        {/* ── جسم الكارت (عرض فقط على الموبايل — الأزرار داخل نافذة الطاولة) ── */}
        <div className="flex flex-col items-center justify-center px-1.5 sm:px-2 pt-2 sm:pt-4 pb-2">
          {/* أيقونة الطاولة / الجلسة النشطة */}
          <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center mb-1 sm:mb-1.5 transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 shadow-sm ${styles.icon}`}>
            {isOccupied && activeSessionType ? (
              <span className="text-xl sm:text-3xl leading-none select-none animate-pulse">
                {activeSessionType === 'playstation' ? '🎮' :
                 activeSessionType === 'computer'    ? '💻' : '🎮💻'}
              </span>
            ) : (
              <TableIcon className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-white" />
            )}
          </div>

          {/* رقم الطاولة — سطران كحد أقصى، القص عند المسافات فقط */}
          <span className={`text-base sm:text-xl font-extrabold leading-tight text-center line-clamp-2 break-normal ${styles.text}`}>
            {getTableDisplay(table.number, i18n.language)}
          </span>

          {/* المبلغ المتبقي — يشمل delta الجلسات الحية كل 10 ثوانٍ */}
          {isOccupied && liveRemaining > 0 && (
            <span className={`text-xs sm:text-sm font-semibold mt-0.5 ${styles.sub}`}>
              {formatCurrencyUtil(liveRemaining, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP')}
              {liveExtra > 0 && <span className="ml-1 text-[10px] animate-pulse">●</span>}
            </span>
          )}
        </div>

        {/* hover glow */}
        <div className={`absolute inset-0 rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none ${styles.hover}`} />

        {/* ── Quick actions: hover overlay COVERING the card (like the original
            design) — named compact buttons, card never expands or moves.
            Mobile: cards are display-only (tap opens the table window
            where all actions live consistently). ── */}
        {isOccupied && !isSelected && (
            <div className="hidden sm:block absolute inset-x-1 bottom-1 z-20 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200">
              <div className="rounded-lg p-1 shadow-xl border bg-white/95 dark:bg-gray-900/95 border-gray-200 dark:border-gray-700">
              <div className="flex items-stretch justify-between gap-1 min-w-0">
              <div className="flex-1 min-w-0 flex flex-col gap-1">
              {/* NOTE: لا زر "فتح" هنا — الضغط على الكارت نفسه يفتحه */}
              <button
                onClick={(e) => onQuickOrder(table, e)}
                className="min-h-8 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 text-red-600 dark:text-red-400 text-xs font-bold rounded-md flex items-center justify-center gap-1 shadow border border-red-200 dark:border-red-800 transition-all"
                title={t('cafe.tableOrdersModal.newOrder')}>
                <ShoppingCart className="h-3.5 w-3.5" />
                <span>طلب</span>
              </button>
              <button
                onClick={(e) => onQuickBilling(table, e)}
                className="min-h-8 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-md flex items-center justify-center gap-1 shadow border border-blue-200 dark:border-blue-800 transition-all"
                title={t('billing.paymentManagement')}>
                <DollarSign className="h-3.5 w-3.5" />
                <span>دفع</span>
              </button>
              {(onQuickEditBill && tableBills.some(b => ['draft','partial','overdue','paid'].includes(b.status))) && (
                <button
                  onClick={(e) => onQuickEditBill(table, e)}
                  className="min-h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-md flex items-center justify-center gap-1 shadow border border-blue-700 transition-all"
                  title="تعديل الأصناف">
                  <Edit className="h-3.5 w-3.5" />
                  <span>تعديل</span>
                </button>
              )}
              </div>
              {/* ── الوسط: علامة الطاولة + المبلغ المتبقي تحتها ── */}
              <div className="flex flex-col items-center justify-center px-1 min-w-0 max-w-[40%] flex-shrink">
                {isOccupied && activeSessionType ? (
                  <span className="text-2xl leading-none select-none animate-pulse">
                    {activeSessionType === 'playstation' ? '🎮' :
                     activeSessionType === 'computer'    ? '💻' : '🎮💻'}
                  </span>
                ) : (
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center shadow-sm ${styles.icon}`}>
                    <TableIcon className="h-3.5 w-3.5 text-white" />
                  </span>
                )}
                <span className={`text-base font-extrabold leading-tight text-center line-clamp-2 break-normal ${styles.text}`}>
                  {getTableDisplay(table.number, i18n.language)}
                </span>
                {liveRemaining > 0 && (
                  <span className={`text-xs font-bold leading-tight text-center break-normal ${styles.sub}`}>
                    {formatCurrencyUtil(liveRemaining, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP')}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
              {onQuickChangeTable && (
                <button
                  onClick={(e) => onQuickChangeTable(table, e)}
                  className="min-h-8 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 text-purple-600 dark:text-purple-400 text-xs font-bold rounded-md flex items-center justify-center gap-1 shadow border border-purple-200 dark:border-purple-800 transition-all"
                  title={t('billing.changeTableTitle', 'تغيير الطاولة')}>
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  <span>نقل</span>
                </button>
              )}
              {(onQuickPrint && totalRemaining > 0) && (
                <button
                  onClick={(e) => onQuickPrint(table, e)}
                  className="min-h-8 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-md flex items-center justify-center gap-1 shadow border border-gray-200 dark:border-gray-600 transition-all"
                  title="طباعة الفاتورة">
                  <Printer className="h-3.5 w-3.5" />
                  <span>طباعة</span>
                </button>
              )}
              {(activeSessionCount > 0 && onEndAllSessions) && (
                <button
                  onClick={(e) => onEndAllSessions(table, e)}
                  className={`min-h-8 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 text-xs font-bold rounded-md flex items-center justify-center gap-1 shadow border transition-all ${
                    sessionUrgency === 'danger' ? 'border-red-400 text-red-600 dark:text-red-400 animate-pulse' : 'border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                  }`}
                  title={`إيقاف جميع جلسات البلايستيشن (${activeSessionCount})`}>
                  <span className="text-sm leading-none">⏹</span><span>إيقاف</span>
                </button>
              )}
              </div>
              </div>
              </div>
            </div>
        )}
        {!isOccupied && (
          <div className="hidden sm:block absolute inset-x-1 bottom-1 z-20 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200">
            <button
              onClick={(e) => onQuickOrder(table, e)}
              className="w-full py-1 bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-500 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 shadow-md shadow-green-200 dark:shadow-green-900/40 border border-green-600 dark:border-green-500 transition-all"
              title={t('cafe.tableOrdersModal.newOrder')}>
              <Plus className="h-3.5 w-3.5" />
              <span>طلب جديد</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Tooltip ── */}
      {showTooltip && isOccupied && tableBills.length > 0 && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-gray-900 dark:bg-gray-700 text-white rounded-xl shadow-2xl p-3 text-base pointer-events-none">
          <div className="font-bold text-lg mb-2 text-red-300 flex items-center gap-1.5">
            <TableIcon className="h-3.5 w-3.5" />
            {t('cafe.table')} {getTableDisplay(table.number, i18n.language)}
          </div>
          {tableBills.filter(b => ['draft','partial','overdue'].includes(b.status)).slice(0, 3).map((b, i) => (
            <div key={i} className="flex justify-between items-center py-1 border-b border-gray-700 dark:border-gray-600 last:border-0">
              <span className="text-gray-300">#{b.billNumber?.slice(-6) || b.id?.slice(-6)}</span>
              <span className="font-semibold text-red-300">
                {formatCurrencyUtil(b.remaining || 0, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP')}
              </span>
            </div>
          ))}
          {tableOrdersCount > 0 && (
            <div className="mt-2 text-blue-300 flex items-center gap-1.5">
              <ShoppingCart className="h-3 w-3" />
              <span>{tableOrdersCount} {t('nav.orders', 'طلبات')}</span>
            </div>
          )}
          {ageLabel && (
            <div className="mt-1 flex items-center gap-1.5 text-yellow-300">
              <Clock className="h-3 w-3" />
              <span>{ageLabel}</span>
            </div>
          )}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 dark:bg-gray-700 rotate-45" />
        </div>
      )}
    </div>
  );
});
TableButton.displayName = 'TableButton';

export default TableButton;
