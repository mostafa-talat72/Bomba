import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, DollarSign, Printer, ArrowLeftRight, Edit, MessageCircle, ChefHat } from 'lucide-react';
import { Bill } from '../../services/api';
import { formatCurrency as formatCurrencyUtil, getShortBillNumber } from '../../utils/formatters';
import { getAgeLabel, getTableAgeColor } from './tableHelpers';

export interface BillTableCardProps {
  bill: any;
  kind: 'delivery' | 'takeaway';
  method: string;
  onMethodChange: (method: string) => void;
  driver?: string;
  onDriverChange?: (name: string) => void;
  showPhone?: boolean;
  compact?: boolean;
  onOpen: (bill: any) => void;
  onAddItems: (bill: any) => void;
  onCollect: (bill: any, method: string) => void;
  onEditItems: (bill: any) => void;
  onPrint: (bill: any) => void;
  onMove: (bill: any) => void;
  onPayItems?: (bill: any) => void;
  onPrepPrint?: (bill: any) => void;
  onWhatsApp?: (bill: any) => void;
  onDelete: (bill: any) => void;
  onCustomer?: (bill: any) => void;
  onHoverChange?: (bill: any | null) => void;
  onDriverSave?: (b: any, name: string) => void;
  children?: React.ReactNode;
}

// نفس كارت الطاولة (TableButton) شكلاً وقدرات: نفس الحالات والأزرار والـ tooltip.
const BillTableCard = React.memo<BillTableCardProps>(({
  bill, kind, method, onMethodChange, showPhone = true,
  compact, onOpen, onAddItems, onCollect, onEditItems, onPrint, onMove,
  onWhatsApp, onDelete, onCustomer, onHoverChange, onDriverSave, onPayItems, onPrepPrint, children,
}) => {
  const { t, i18n } = useTranslation();
  const [showTooltip, setShowTooltip] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [driverVal, setDriverVal] = useState((bill as any)?.deliveryInfo?.driver || '');
  // تأكيد الدفع داخل الكارت مباشرة — بلا نافذة دفع.
  const [confirmPay, setConfirmPay] = useState(false);
  React.useEffect(() => { setConfirmPay(false); }, [(bill as any)?._id || (bill as any)?.id]);
  const payAmount = Number((bill as any)?.remaining) || 0;
  const methodLabel = method === 'cash' ? 'نقدي' : method === 'card' ? 'كارت' : method === 'transfer' ? 'تحويل' : method === 'e_wallet' ? 'محفظة' : method;

  const billsArr: Bill[] = [bill];
  const isOccupied = (Number(bill.remaining) || 0) > 0;
  const ageLabel = isOccupied ? getAgeLabel(billsArr as any) : '';
  const ageColor = isOccupied ? getTableAgeColor(billsArr as any) : null;
  const totalRemaining = isOccupied ? (Number(bill.remaining) || 0) : 0;
  const ordersCount = Array.isArray(bill.orders)
    ? bill.orders.reduce((s: number, o: any) => s + (Array.isArray(o?.items) ? o.items.length : 0), 0)
    : 0;
  // الاسم: العميل أولاً، ثم الرقم المختصر (426D13-002) بدل تسمية النوع العامة.
  const shortNumber = bill.billNumber
    ? getShortBillNumber(bill.billNumber)
    : String(bill._id || bill.id || '').slice(-6);
  const displayName = bill.deliveryInfo?.customerName || bill.customerName || shortNumber;
  const phone = bill.deliveryInfo?.phone || bill.customerPhone || '';

  const styles = isOccupied
    ? {
        card:   'border-red-400 bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-900/40 dark:to-red-800/30 hover:border-red-500 hover:shadow-lg hover:shadow-red-100 dark:hover:shadow-red-900/30',
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
      onMouseEnter={() => { setShowTooltip(true); onHoverChange?.(bill); }}
      onMouseLeave={() => { setShowTooltip(false); onHoverChange?.(null); }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(bill)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(bill); } }}
        className={`group relative w-full h-full flex flex-col rounded-xl sm:rounded-2xl border-2 transition-all duration-300 transform hover:scale-[1.02] hover:-translate-y-0.5 cursor-pointer ${styles.card}`}
      >
        <div className="absolute -top-2 -right-2 z-10">
          {isOccupied ? (
            <span className={`flex items-center justify-center px-2 h-5 ${styles.badge} text-white text-xs font-bold rounded-full shadow border-2 border-white dark:border-gray-800 ${ageColor === 'red' ? 'animate-pulse' : ''}`}>
              {ageLabel || t('cafe.occupied')}
            </span>
          ) : (
            <span className="flex items-center justify-center px-2 h-5 bg-gray-400 dark:bg-gray-500 text-white text-xs font-bold rounded-full shadow border-2 border-white dark:border-gray-800">
              {t('cafe.empty')}
            </span>
          )}
        </div>

        {isOccupied && ordersCount > 0 && (
          <div className="absolute -top-2 -left-2 z-10 w-5 h-5 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow border border-white dark:border-gray-800">
            {ordersCount}
          </div>
        )}

        <div className={`flex flex-col items-center justify-center px-1.5 sm:px-2 ${compact ? 'pt-1 sm:pt-2' : 'pt-2 sm:pt-4'} pb-2`}>
          <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center mb-1 sm:mb-1.5 transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 shadow-sm ${styles.icon}`}>
            <span className="text-xl sm:text-2xl leading-none select-none">{kind === 'delivery' ? '🛵' : '🥡'}</span>
          </div>

          <span className={`text-base sm:text-xl font-extrabold leading-tight text-center line-clamp-2 break-normal ${styles.text}`}>
            {displayName}
          </span>

          {isOccupied && totalRemaining > 0 && (
            <span className={`text-xs sm:text-sm font-semibold mt-0.5 ${styles.sub}`}>
              {formatCurrencyUtil(totalRemaining, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP')}
            </span>
          )}

          {kind === 'delivery' && (
            <span className="mt-1 flex flex-col items-center gap-0.5 w-full px-1" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
              {showPhone && phone ? (
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400" dir="ltr">{phone}</span>
              ) : null}
              {onDriverSave && (
                <input defaultValue={driverVal} placeholder="السائق"
                  onBlur={e => { const v = e.target.value.trim(); setDriverVal(v); if (v !== (bill.deliveryInfo?.driver || '')) onDriverSave(bill, v); }}
                  onClick={e => e.stopPropagation()}
                  className="w-full max-w-[110px] px-1.5 py-0.5 text-[11px] text-center border border-gray-200 dark:border-gray-600 rounded-md bg-white/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300" />
              )}
            </span>
          )}
        </div>
        {children}

        <div className={`absolute inset-0 rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none ${styles.hover}`} />

        {isOccupied && (
            <div className="hidden sm:block absolute inset-x-1 bottom-1 z-20 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200">
              <div className="rounded-lg p-1 shadow-xl border bg-white/95 dark:bg-gray-900/95 border-gray-200 dark:border-gray-700">
              {confirmPay ? (
                <div className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                  <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400">تأكيد دفع</div>
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 my-0.5">
                    {formatCurrencyUtil(payAmount, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP')}
                  </div>
                  <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1.5">{methodLabel}</div>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmPay(false); }}
                      className="flex-1 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-bold transition-all"
                    >
                      تراجع
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmPay(false); onCollect(bill, method); }}
                      className="flex-1 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all"
                    >
                      تأكيد الدفع
                    </button>
                  </div>
                </div>
              ) : (
              <div className="flex items-stretch justify-between gap-1 min-w-0">
              <div className="flex-1 min-w-0 flex flex-col gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); onAddItems(bill); }}
                className="min-h-8 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 text-red-600 dark:text-red-400 text-xs font-bold rounded-md flex items-center justify-center gap-1 shadow border border-red-200 dark:border-red-800 transition-all"
                title={t('cafe.tableOrdersModal.newOrder')}>
                <ShoppingCart className="h-3.5 w-3.5" />
                <span>طلب</span>
              </button>
              {onPrepPrint && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPrepPrint(bill); }}
                  className="min-h-8 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 text-orange-600 dark:text-orange-400 text-xs font-bold rounded-md flex items-center justify-center gap-1 shadow border border-orange-200 dark:border-orange-800 transition-all"
                  title="طباعة أقسام التحضير كطلبات (مطبخ/مشويات...)">
                  <ChefHat className="h-3.5 w-3.5" />
                  <span>تحضير طلبات</span>
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmPay(true); }}
                className="min-h-8 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-md flex items-center justify-center gap-1 shadow border border-blue-200 dark:border-blue-800 transition-all"
                title={t('billing.paymentManagement')}>
                <DollarSign className="h-3.5 w-3.5" />
                <span>دفع</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onEditItems(bill); }}
                className="min-h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-md flex items-center justify-center gap-1 shadow border border-blue-700 transition-all"
                title="تعديل الأصناف">
                <Edit className="h-3.5 w-3.5" />
                <span>تعديل</span>
              </button>
              </div>
              <div className="flex flex-col items-center justify-center px-1 min-w-0 max-w-[40%] flex-shrink">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center shadow-sm ${styles.icon}`}>
                  <span className="text-lg leading-none select-none">{kind === 'delivery' ? '🛵' : '🥡'}</span>
                </span>
                <span className={`text-base font-extrabold leading-tight text-center line-clamp-2 break-normal ${styles.text}`}>
                  {displayName}
                </span>
                {totalRemaining > 0 && (
                  <span className={`text-xs font-bold leading-tight text-center break-normal ${styles.sub}`}>
                    {formatCurrencyUtil(totalRemaining, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP')}
                  </span>
                )}
                <select value={method} onChange={e => onMethodChange(e.target.value)} onClick={e => e.stopPropagation()} title="طريقة الدفع"
                  className="mt-1 w-full text-[10px] font-bold border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-0.5">
                  <option value="cash">نقدي</option>
                  <option value="card">كارت</option>
                  <option value="transfer">تحويل</option>
                  <option value="e_wallet">محفظة</option>
                </select>
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); onMove(bill); }}
                className="min-h-8 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 text-purple-600 dark:text-purple-400 text-xs font-bold rounded-md flex items-center justify-center gap-1 shadow border border-purple-200 dark:border-purple-800 transition-all"
                title={t('billing.changeTableTitle', 'تغيير الطاولة')}>
                <ArrowLeftRight className="h-3.5 w-3.5" />
                <span>نقل</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onPrint(bill); }}
                className="min-h-8 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-md flex items-center justify-center gap-1 shadow border border-gray-200 dark:border-gray-600 transition-all"
                title="طباعة الفاتورة كاملة">
                <Printer className="h-3.5 w-3.5" />
                <span>طباعة الفاتورة</span>
              </button>
              {onPayItems && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPayItems(bill); }}
                  className="min-h-8 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-md flex items-center justify-center gap-1 shadow border border-indigo-200 dark:border-indigo-800 transition-all"
                  title="دفع أصناف محددة">
                  <span className="text-sm leading-none">🧾</span>
                  <span>أصناف</span>
                </button>
              )}
              {onWhatsApp && (
                <button
                  onClick={(e) => { e.stopPropagation(); onWhatsApp(bill); }}
                  className="min-h-8 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 text-green-600 dark:text-green-400 text-xs font-bold rounded-md flex items-center justify-center gap-1 shadow border border-green-200 dark:border-green-800 transition-all"
                  title="واتساب">
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>واتساب</span>
                </button>
              )}
              </div>
              </div>
              )}
              </div>
            </div>
        )}
        {!isOccupied && (
          <div className="hidden sm:block absolute inset-x-1 bottom-1 z-20 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200">
            <button
              onClick={(e) => { e.stopPropagation(); if (confirmDel) { setConfirmDel(false); onDelete(bill); } else { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 3000); } }}
              className={`w-full py-1 text-xs font-bold rounded-lg flex items-center justify-center gap-1 shadow-md border transition-all ${confirmDel ? 'bg-red-700 text-white border-red-800 animate-pulse' : 'bg-red-500 hover:bg-red-600 text-white border-red-600'}`}
              title="حذف الفاتورة">
              <span>{confirmDel ? 'تأكيد؟' : '🗑 حذف'}</span>
            </button>
          </div>
        )}
      </div>

      {showTooltip && isOccupied && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-gray-900 dark:bg-gray-700 text-white rounded-xl shadow-2xl p-3 text-base pointer-events-none">
            <div className="font-bold text-lg mb-2 text-red-300 flex items-center gap-1.5">
              <span>{kind === 'delivery' ? '🛵' : '🥡'}</span>
              #{shortNumber}
            </div>
          <div className="flex justify-between items-center py-1 border-b border-gray-700 dark:border-gray-600">
            <button
              onClick={() => onCustomer?.(bill)}
              className="text-gray-300 hover:text-white hover:underline font-semibold truncate max-w-[60%] text-right"
              title="سجل العميل"
            >
              {displayName}
            </button>
            <span className="font-semibold text-red-300">
              {formatCurrencyUtil(totalRemaining, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP')}
            </span>
          </div>
          {showPhone && phone && (
            <div className="mt-1 text-blue-300 text-sm" dir="ltr">{phone}</div>
          )}
          {bill.deliveryInfo?.address && (
            <div className="mt-1 text-gray-300 text-xs truncate">📍 {bill.deliveryInfo.address}</div>
          )}
          {bill.deliveryInfo?.driver && (
            <div className="mt-1 text-gray-300 text-xs">🚗 {bill.deliveryInfo.driver}</div>
          )}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 dark:bg-gray-700 rotate-45" />
        </div>
      )}
    </div>
  );
});
BillTableCard.displayName = 'BillTableCard';

export default BillTableCard;
