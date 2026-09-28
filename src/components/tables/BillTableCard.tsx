import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, DollarSign, Printer, ArrowLeftRight, Edit, MessageCircle, ChefHat } from 'lucide-react';
import { Bill } from '../../services/api';
import { formatCurrency as formatCurrencyUtil, getShortBillNumber } from '../../utils/formatters';
import { paymentMethodLabel, paymentMethodIcon } from '../../utils/paymentMethod';
import { drawerLabel, drawerIcon } from '../../utils/paymentDrawer';
import { getAgeLabel, getTableAgeColor } from './tableHelpers';

export interface BillTableCardProps {
  bill: any;
  kind: 'delivery' | 'takeaway';
  method: string;
  onMethodChange: (method: string) => void;
  drawer: string;
  onDrawerChange: (drawer: string) => void;
  driver?: string;
  onDriverChange?: (name: string) => void;
  showPhone?: boolean;
  compact?: boolean;
  onOpen: (bill: any) => void;
  onAddItems: (bill: any) => void;
  onCollect: (bill: any, method: string, drawer: string) => void;
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
  /** إظهار أزرار التعديل (طلب/تعديل أصناف/نقل) — false يخفيها */
  canEdit?: boolean;
  /** إظهار أزرار التحصيل الكامل — false يخفيها */
  canPayFull?: boolean;
  /** إظهار زر دفع الأصناف — false يخفيه */
  canPayPartial?: boolean;
}

// نفس كارت الطاولة (TableButton) شكلاً وقدرات: نفس الحالات والأزرار والـ tooltip.
const BillTableCard = React.memo<BillTableCardProps>(({
  bill, kind, method, onMethodChange, drawer, onDrawerChange, showPhone = true,
  compact, onOpen, onAddItems, onCollect, onEditItems, onPrint, onMove,
  onWhatsApp, onDelete, onCustomer, onHoverChange, onDriverSave, onPayItems, onPrepPrint, children,
  canEdit = true, canPayFull = true, canPayPartial = true,
}) => {
  const { t, i18n } = useTranslation();
  const [showTooltip, setShowTooltip] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [driverVal, setDriverVal] = useState((bill as any)?.deliveryInfo?.driver || '');
  // تأكيد الدفع داخل الكارت مباشرة — بلا نافذة دفع.
  const [confirmPay, setConfirmPay] = useState(false);
  // لوحة إجراءات الموبايل — بديل الـ hover غير الموجود على اللمس.
  const [showMobileActions, setShowMobileActions] = useState(false);
  React.useEffect(() => { setConfirmPay(false); }, [(bill as any)?._id || (bill as any)?.id]);
  const payAmount = Number((bill as any)?.remaining) || 0;
  const methodLabel = paymentMethodLabel(method, t);
  const drawerName = drawerLabel(drawer, t);

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

          {kind === 'delivery' && showPhone && phone ? (
            <span className="text-sm sm:text-base font-extrabold text-blue-600 dark:text-blue-400 mt-0.5" dir="ltr">{phone}</span>
          ) : null}

          {(() => {
            const totalFD = (bill.orders || []).reduce((sum: number, o: any) => sum + (o?.fixedDiscount?.amount || 0), 0);
            const billDiscount = Number(bill.discount) || 0;
            const totalAllDiscounts = totalFD + billDiscount;
            const subtotalBeforeDiscount = (bill.total || 0) + totalAllDiscounts;
            const netAmount = isOccupied ? totalRemaining : (Number(bill.total) || 0);
            if (totalAllDiscounts <= 0) {
              if (netAmount <= 0) return null;
              return (
                <span className={`text-base sm:text-lg font-bold mt-0.5 ${styles.sub}`}>
                  {formatCurrencyUtil(netAmount, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP')}
                </span>
              );
            }
            return (
              <div className="flex items-center justify-center gap-2 mt-0.5 flex-wrap">
                <span className="text-base sm:text-lg font-bold text-gray-400 dark:text-gray-500 line-through whitespace-nowrap">{formatCurrencyUtil(subtotalBeforeDiscount, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP')}</span>
                <span className="text-base sm:text-lg font-bold text-purple-600 dark:text-purple-400 whitespace-nowrap">{t('billCard.discountLabel', { amount: formatCurrencyUtil(totalAllDiscounts, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP') })}</span>
                <span className={`text-base sm:text-lg font-bold whitespace-nowrap ${styles.sub}`}>{formatCurrencyUtil(netAmount, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP')}</span>
              </div>
            );
          })()}

          {kind === 'delivery' && Number(bill.deliveryInfo?.deliveryFee) > 0 && (
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 whitespace-nowrap">🚚 {t('billCard.deliveryFee', 'توصيل')}: {formatCurrencyUtil(Number(bill.deliveryInfo.deliveryFee), i18n.language, localStorage.getItem('organizationCurrency') || 'EGP')}</span>
          )}

          {/* طريقة الدفع والدرج — ظاهران دائمًا على الكارت */}
          {isOccupied && (
            <span className="mt-1 flex items-center justify-center gap-1 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[11px] sm:text-xs font-bold">
                {paymentMethodIcon(method)} {methodLabel}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[11px] sm:text-xs font-bold">
                {drawerIcon(drawer)} {drawerName}
              </span>
            </span>
          )}

          {kind === 'delivery' && onDriverSave && (
            <span className="mt-1 flex flex-col items-center gap-0.5 w-full px-1" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
              <input defaultValue={driverVal} placeholder={t('billCard.driverPlaceholder')}
                onBlur={e => { const v = e.target.value.trim(); setDriverVal(v); if (v !== (bill.deliveryInfo?.driver || '')) onDriverSave(bill, v); }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-[110px] px-1.5 py-0.5 text-[11px] text-center border border-gray-200 dark:border-gray-600 rounded-md bg-white/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300" />
            </span>
          )}
        </div>
        {children}

        {/* إجراءات الموبايل — بديل أزرار الـ hover (مخفية على الديسكتوب) */}
        <div className="sm:hidden px-1.5 pb-1.5" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
          <button
            onClick={() => setShowMobileActions(v => !v)}
            className="w-full py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-bold transition-colors"
          >
            ⋯ {t('billCard.actions', 'إجراءات')} {showMobileActions ? '▴' : '▾'}
          </button>
          {showMobileActions && (
            <div className="mt-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 p-1.5 space-y-1.5 shadow-lg">
              <div className="grid grid-cols-2 gap-1">
                {canEdit && (
                  <button onClick={() => { setShowMobileActions(false); onAddItems(bill); }} className="min-h-8 bg-white hover:bg-gray-50 dark:bg-gray-900 text-red-600 dark:text-red-400 text-[11px] font-bold rounded-md flex items-center justify-center gap-1 shadow border border-red-200 dark:border-red-800">
                    <ShoppingCart className="h-3.5 w-3.5" /><span>{t('billCard.order')}</span>
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => { setShowMobileActions(false); onEditItems(bill); }} className="min-h-8 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-md flex items-center justify-center gap-1 shadow border border-blue-700">
                    <Edit className="h-3.5 w-3.5" /><span>{t('billCard.edit')}</span>
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => { setShowMobileActions(false); onMove(bill); }} className="min-h-8 bg-white hover:bg-gray-50 dark:bg-gray-900 text-purple-600 dark:text-purple-400 text-[11px] font-bold rounded-md flex items-center justify-center gap-1 shadow border border-purple-200 dark:border-purple-800">
                    <ArrowLeftRight className="h-3.5 w-3.5" /><span>{t('billCard.move')}</span>
                  </button>
                )}
                <button onClick={() => { setShowMobileActions(false); onPrint(bill); }} className="min-h-8 bg-white hover:bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 text-[11px] font-bold rounded-md flex items-center justify-center gap-1 shadow border border-gray-200 dark:border-gray-600">
                  <Printer className="h-3.5 w-3.5" /><span>{t('billCard.printBill')}</span>
                </button>
                {onPrepPrint && (
                  <button onClick={() => { setShowMobileActions(false); onPrepPrint(bill); }} className="min-h-8 bg-white hover:bg-gray-50 dark:bg-gray-900 text-orange-600 dark:text-orange-400 text-[11px] font-bold rounded-md flex items-center justify-center gap-1 shadow border border-orange-200 dark:border-orange-800">
                    <ChefHat className="h-3.5 w-3.5" /><span>{t('billCard.prepOrders')}</span>
                  </button>
                )}
                {onPayItems && canPayPartial && (
                  <button onClick={() => { setShowMobileActions(false); onPayItems(bill); }} className="min-h-8 bg-white hover:bg-gray-50 dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold rounded-md flex items-center justify-center gap-1 shadow border border-indigo-200 dark:border-indigo-800">
                    <span className="text-sm leading-none">🧾</span><span>{t('billCard.items')}</span>
                  </button>
                )}
                {onWhatsApp && kind !== 'takeaway' && (
                  <button onClick={() => { setShowMobileActions(false); onWhatsApp(bill); }} className="min-h-8 bg-white hover:bg-gray-50 dark:bg-gray-900 text-green-600 dark:text-green-400 text-[11px] font-bold rounded-md flex items-center justify-center gap-1 shadow border border-green-200 dark:border-green-800">
                    <MessageCircle className="h-3.5 w-3.5" /><span>{t('billCard.whatsapp')}</span>
                  </button>
                )}
                <button onClick={() => { if (confirmDel) { setConfirmDel(false); setShowMobileActions(false); onDelete(bill); } else { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 3000); } }} className={`min-h-8 text-[11px] font-bold rounded-md flex items-center justify-center gap-1 shadow border transition-all ${confirmDel ? 'bg-red-700 text-white border-red-800 animate-pulse col-span-2' : 'bg-red-500 text-white border-red-600'}`}>
                  <span>{confirmDel ? t('billCard.confirmDelete') : t('billCard.delete')}</span>
                </button>
              </div>
              <select value={method} onChange={e => onMethodChange(e.target.value)} title={t('billCard.paymentMethodTitle')}
                className="w-full text-[10px] font-bold border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-1">
                <option value="cash">{paymentMethodIcon('cash')} {paymentMethodLabel('cash', t)}</option>
                <option value="card">{paymentMethodIcon('card')} {paymentMethodLabel('card', t)}</option>
                <option value="transfer">{paymentMethodIcon('transfer')} {paymentMethodLabel('transfer', t)}</option>
                <option value="e_wallet">{paymentMethodIcon('e_wallet')} {paymentMethodLabel('e_wallet', t)}</option>
              </select>
              <select value={drawer} onChange={e => onDrawerChange(e.target.value)} title={t('billCard.paymentMethodTitle')}
                className="w-full text-[10px] font-bold border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-1">
                <option value="cashier">{drawerIcon('cashier')} {drawerLabel('cashier', t)}</option>
                <option value="hall">{drawerIcon('hall')} {drawerLabel('hall', t)}</option>
                <option value="takeaway">{drawerIcon('takeaway')} {drawerLabel('takeaway', t)}</option>
                <option value="delivery">{drawerIcon('delivery')} {drawerLabel('delivery', t)}</option>
                <option value="safe">{drawerIcon('safe')} {drawerLabel('safe', t)}</option>
              </select>
            </div>
          )}
        </div>

        {/* زر تحصيل بارز دائم الظهور (للجوال حيث لا يوجد hover) — تأكيد بخطوتين */}
        {canPayFull && kind === 'delivery' && isOccupied && totalRemaining > 0 && (
          <div className="sm:hidden px-1.5 pb-1.5" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
            {!confirmPay ? (
              <button
                onClick={() => setConfirmPay(true)}
                className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold shadow"
              >
                {t('billCard.collect', { amount: formatCurrencyUtil(totalRemaining, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP') })}
              </button>
            ) : (
              <div className="flex gap-1">
                <button
                  onClick={() => setConfirmPay(false)}
                  className="flex-1 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold"
                >
                  {t('billCard.cancel')}
                </button>
                <button
                  onClick={() => { setConfirmPay(false); onCollect(bill, method, drawer); }}
                  className="flex-[2] py-2 rounded-xl bg-emerald-600 text-white text-sm font-extrabold shadow animate-pulse"
                >
                  {t('billCard.confirmWithMethod', { method: methodLabel })} · {drawerName}
                </button>
              </div>
            )}
          </div>
        )}

        <div className={`absolute inset-0 rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none ${styles.hover}`} />

        {isOccupied && (
            <div className="hidden sm:block absolute inset-1 z-20 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200 overflow-hidden">
              <div className="rounded-lg p-1 shadow-xl border bg-white/95 dark:bg-gray-900/95 border-gray-200 dark:border-gray-700 max-h-full overflow-y-auto">
              {confirmPay ? (
                <div className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                  <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{t('billCard.confirmPayTitle')}</div>
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 my-0.5">
                    {formatCurrencyUtil(payAmount, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP')}
                  </div>
                  <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1.5">{methodLabel} · {drawerName}</div>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmPay(false); }}
                      className="flex-1 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-bold transition-all"
                    >
                      {t('billCard.cancel')}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmPay(false); onCollect(bill, method, drawer); }}
                      className="flex-1 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all"
                    >
                      {t('billCard.confirmPayButton')}
                    </button>
                  </div>
                </div>
              ) : (
              <div className="flex items-stretch justify-between gap-1 min-w-0">
              <div className="flex-1 min-w-0 flex flex-col gap-1">
              {canEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onAddItems(bill); }}
                className="min-h-8 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 text-red-600 dark:text-red-400 text-xs font-bold rounded-md flex items-center justify-center gap-1 shadow border border-red-200 dark:border-red-800 transition-all"
                title={t('cafe.tableOrdersModal.newOrder')}>
                <ShoppingCart className="h-3.5 w-3.5" />
                <span>{t('billCard.order')}</span>
              </button>
              )}
              {onPrepPrint && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPrepPrint(bill); }}
                  className="min-h-8 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 text-orange-600 dark:text-orange-400 text-xs font-bold rounded-md flex items-center justify-center gap-1 shadow border border-orange-200 dark:border-orange-800 transition-all"
                  title={t('billCard.prepPrintTitle')}>
                  <ChefHat className="h-3.5 w-3.5" />
                  <span>{t('billCard.prepOrders')}</span>
                </button>
              )}
              {canPayFull && (
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmPay(true); }}
                className="min-h-8 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-md flex items-center justify-center gap-1 shadow border border-blue-200 dark:border-blue-800 transition-all"
                title={t('billing.paymentManagement')}>
                <DollarSign className="h-3.5 w-3.5" />
                <span>{t('billCard.pay')}</span>
              </button>
              )}
              {canEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEditItems(bill); }}
                className="min-h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-md flex items-center justify-center gap-1 shadow border border-blue-700 transition-all"
                title={t('billCard.editItemsTitle')}>
                <Edit className="h-3.5 w-3.5" />
                <span>{t('billCard.edit')}</span>
              </button>
              )}
              </div>
              <div className="flex flex-col items-center justify-center px-1 min-w-0 max-w-[40%] flex-shrink">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center shadow-sm ${styles.icon}`}>
                  <span className="text-lg leading-none select-none">{kind === 'delivery' ? '🛵' : '🥡'}</span>
                </span>
                <span className={`text-base sm:text-xl font-extrabold leading-tight text-center line-clamp-2 break-normal ${styles.text}`}>
                  {displayName}
                </span>
                {kind === 'delivery' && showPhone && phone ? (
                  <span className="text-sm sm:text-base font-extrabold text-blue-600 dark:text-blue-400 mt-0.5" dir="ltr">{phone}</span>
                ) : null}
                {(() => {
                  const hoverFD = (bill.orders || []).reduce((s: number, o: any) => s + (o?.fixedDiscount?.amount || 0), 0);
                  const hoverBD = Number(bill.discount) || 0;
                  const hoverTotal = hoverFD + hoverBD;
                  const hoverSub = (bill.total || 0) + hoverTotal;
                  const hoverNet = isOccupied ? totalRemaining : (Number(bill.total) || 0);
                  if (hoverTotal <= 0) {
                    if (hoverNet <= 0) return null;
                    return (
                      <span className={`text-base sm:text-lg font-bold mt-0.5 ${styles.sub}`}>
                        {formatCurrencyUtil(hoverNet, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP')}
                      </span>
                    );
                  }
                  return (
                    <div className="flex items-center justify-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-base sm:text-lg font-bold text-gray-400 dark:text-gray-500 line-through whitespace-nowrap">{formatCurrencyUtil(hoverSub, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP')}</span>
                      <span className="text-base sm:text-lg font-bold text-purple-600 dark:text-purple-400 whitespace-nowrap">{t('billCard.discountLabel', { amount: formatCurrencyUtil(hoverTotal, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP') })}</span>
                      <span className="text-base sm:text-lg font-bold text-gray-700 dark:text-gray-200 whitespace-nowrap">{formatCurrencyUtil(hoverNet, i18n.language, localStorage.getItem('organizationCurrency') || 'EGP')}</span>
                    </div>
                  );
                })()}
                {kind === 'delivery' && Number(bill.deliveryInfo?.deliveryFee) > 0 && (
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">🚚 {t('billCard.deliveryFee', 'توصيل')}: {formatCurrencyUtil(Number(bill.deliveryInfo.deliveryFee), i18n.language, localStorage.getItem('organizationCurrency') || 'EGP')}</span>
                )}
                <select value={method} onChange={e => onMethodChange(e.target.value)} onClick={e => e.stopPropagation()} title={t('billCard.paymentMethodTitle')}
                  className="mt-1 w-full text-[10px] font-bold border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-0.5">
                  <option value="cash">{paymentMethodIcon('cash')} {paymentMethodLabel('cash', t)}</option>
                  <option value="card">{paymentMethodIcon('card')} {paymentMethodLabel('card', t)}</option>
                  <option value="transfer">{paymentMethodIcon('transfer')} {paymentMethodLabel('transfer', t)}</option>
                  <option value="e_wallet">{paymentMethodIcon('e_wallet')} {paymentMethodLabel('e_wallet', t)}</option>
                </select>
                <select value={drawer} onChange={e => onDrawerChange(e.target.value)} onClick={e => e.stopPropagation()} title={t('billCard.paymentMethodTitle')}
                  className="mt-1 w-full text-[10px] font-bold border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-0.5">
                  <option value="cashier">{drawerIcon('cashier')} {drawerLabel('cashier', t)}</option>
                  <option value="hall">{drawerIcon('hall')} {drawerLabel('hall', t)}</option>
                  <option value="takeaway">{drawerIcon('takeaway')} {drawerLabel('takeaway', t)}</option>
                  <option value="delivery">{drawerIcon('delivery')} {drawerLabel('delivery', t)}</option>
                  <option value="safe">{drawerIcon('safe')} {drawerLabel('safe', t)}</option>
                </select>
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
              {canEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onMove(bill); }}
                className="min-h-8 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 text-purple-600 dark:text-purple-400 text-xs font-bold rounded-md flex items-center justify-center gap-1 shadow border border-purple-200 dark:border-purple-800 transition-all"
                title={t('billing.changeTableTitle', 'تغيير الطاولة')}>
                <ArrowLeftRight className="h-3.5 w-3.5" />
                <span>{t('billCard.move')}</span>
              </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onPrint(bill); }}
                className="min-h-8 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-md flex items-center justify-center gap-1 shadow border border-gray-200 dark:border-gray-600 transition-all"
                title={t('billCard.printFullTitle')}>
                <Printer className="h-3.5 w-3.5" />
                <span>{t('billCard.printBill')}</span>
              </button>
              {onPayItems && canPayPartial && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPayItems(bill); }}
                  className="min-h-8 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-md flex items-center justify-center gap-1 shadow border border-indigo-200 dark:border-indigo-800 transition-all"
                  title={t('billCard.payItemsTitle')}>
                  <span className="text-sm leading-none">🧾</span>
                  <span>{t('billCard.items')}</span>
                </button>
              )}
              {onWhatsApp && kind !== 'takeaway' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onWhatsApp(bill); }}
                  className="min-h-8 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 text-green-600 dark:text-green-400 text-xs font-bold rounded-md flex items-center justify-center gap-1 shadow border border-green-200 dark:border-green-800 transition-all"
                  title={t('billCard.whatsapp')}>
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>{t('billCard.whatsapp')}</span>
                </button>
              )}
              </div>
              </div>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); if (confirmDel) { setConfirmDel(false); onDelete(bill); } else { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 3000); } }}
                className={`mt-1 w-full py-1 text-xs font-bold rounded-md flex items-center justify-center gap-1 shadow border transition-all ${confirmDel ? 'bg-red-700 text-white border-red-800 animate-pulse' : 'bg-red-500 hover:bg-red-600 text-white border-red-600'}`}
                title={t('billCard.deleteBillTitle')}>
                <span>{confirmDel ? t('billCard.confirmDelete') : t('billCard.delete')}</span>
              </button>
              </div>
            </div>
        )}
        {!isOccupied && (
          <div className="hidden sm:block absolute inset-x-1 bottom-1 z-20 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200">
            <button
              onClick={(e) => { e.stopPropagation(); if (confirmDel) { setConfirmDel(false); onDelete(bill); } else { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 3000); } }}
              className={`w-full py-1 text-xs font-bold rounded-lg flex items-center justify-center gap-1 shadow-md border transition-all ${confirmDel ? 'bg-red-700 text-white border-red-800 animate-pulse' : 'bg-red-500 hover:bg-red-600 text-white border-red-600'}`}
              title={t('billCard.deleteBillTitle')}>
              <span>{confirmDel ? t('billCard.confirmShort') : t('billCard.delete')}</span>
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
              title={t('billCard.customerHistoryTitle')}
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
