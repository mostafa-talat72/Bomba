import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import { PAYMENT_METHODS, paymentMethodLabel, paymentMethodIcon, paymentCountLabel } from '../../utils/paymentMethod';
import { CASH_DRAWERS, drawerLabel, drawerIcon } from '../../utils/paymentDrawer';
import { billsCountLabel } from '../../utils/formatters';

export interface MethodTotals {
  total?: number;
  count?: number;
}

export interface DiscountTotals {
  fixedDiscount?: number;
  manualDiscount?: number;
  totalDiscounts?: number;
}

export interface PaymentsByMethodData {
  methods?: Record<string, MethodTotals>;
  discounts?: DiscountTotals;
  outstanding?: number;
  total?: number;
  count?: number;
}

/** بطاقة الإجمالي: قبل الخصم + الخصم + الصافي + المستحق (سطور إضافية عند وجودها) */
const GrandTotalCard: React.FC<{
  total?: number;
  count?: number;
  discounts?: DiscountTotals;
  outstanding?: number;
  formatCurrency: (n: number) => string;
  t: (k: string, fb?: string) => string;
  countLabel: (c: any) => string;
}> = ({ total, count, discounts, outstanding, formatCurrency, t, countLabel }) => {
  const collected = Number(total) || 0;
  const disc = Number(discounts?.totalDiscounts) || 0;
  const recv = Number(outstanding) || 0;
  const gross = collected + disc;
  return (
    <div className="bg-emerald-600 dark:bg-emerald-700 rounded-xl shadow-sm px-2 py-2 text-center col-span-2 sm:col-span-1">
      <div className="text-[11px] font-bold text-emerald-100">
        {t('reports.paymentsByMethod.total', 'الإجمالي')}
      </div>
      <div className="text-sm sm:text-base font-extrabold text-white">
        {formatCurrency(gross)}
      </div>
      {disc > 0 && (
        <>
          <div className="text-[10px] text-amber-200">
            {t('reports.paymentsByMethod.discount', 'الخصم')}: −{formatCurrency(disc)}
          </div>
          <div className="text-[10px] font-extrabold text-white">
            {t('reports.paymentsByMethod.net', 'الصافي')}: {formatCurrency(collected)}
          </div>
        </>
      )}
      {recv > 0 && (
        <div className="text-[10px] text-sky-200">
          {t('reports.paymentsByMethod.outstanding', 'المستحق')}: {formatCurrency(recv)}
        </div>
      )}
      <div className="text-[10px] text-emerald-200">
        {countLabel(count)}
      </div>
    </div>
  );
};

interface PaymentsByMethodCardsProps {
  data: PaymentsByMethodData | null;
  formatCurrency: (n: number) => string;
}

const CARD_STYLES: Record<string, string> = {
  cash: 'text-green-600 dark:text-green-400',
  card: 'text-blue-600 dark:text-blue-400',
  transfer: 'text-purple-600 dark:text-purple-400',
  e_wallet: 'text-amber-600 dark:text-amber-400',
  other: 'text-gray-600 dark:text-gray-400',
};

/** إجماليات المدفوعات حسب النوع (نقدي/بطاقة/تحويل/محفظة) — تتبع فلتر التاريخ للصفحة. */
export const PaymentsByMethodCards: React.FC<PaymentsByMethodCardsProps> = ({ data, formatCurrency }) => {
  const { t, i18n } = useTranslation();
  const [visible, setVisible] = useState(false);

  const methods = data?.methods || {};
  const other = methods.other;
  const showOther = (other?.total || 0) > 0 || (other?.count || 0) > 0;

  return (
    <div className="mt-3 sm:mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs sm:text-sm font-extrabold text-gray-700 dark:text-gray-200">
          {t('reports.paymentsByMethod.title', 'المدفوعات حسب النوع')}
        </div>
        <button
          onClick={() => setVisible(v => !v)}
          title={visible ? t('reports.hideAmount', 'إخفاء المبالغ') : t('reports.showAmount', 'إظهار المبالغ')}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {visible && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {PAYMENT_METHODS.map(m => (
            <div key={m} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 px-2 py-2 text-center">
              <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
                {paymentMethodIcon(m)} {paymentMethodLabel(m, t)}
              </div>
              <div className={`text-sm sm:text-base font-extrabold ${CARD_STYLES[m]}`}>
                {formatCurrency(Number(methods[m]?.total) || 0)}
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500">
                {paymentCountLabel(methods[m]?.count, i18n.language)}
              </div>
            </div>
          ))}
          {showOther && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 px-2 py-2 text-center">
              <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
                {t('reports.paymentsByMethod.other', 'أخرى')}
              </div>
              <div className={`text-sm sm:text-base font-extrabold ${CARD_STYLES.other}`}>
                {formatCurrency(Number(other?.total) || 0)}
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500">
                {paymentCountLabel(other?.count, i18n.language)}
              </div>
            </div>
          )}
          <GrandTotalCard
            total={data?.total}
            count={data?.count}
            discounts={data?.discounts}
            outstanding={data?.outstanding}
            formatCurrency={formatCurrency}
            t={t as (k: string, fb?: string) => string}
            countLabel={(c) => paymentCountLabel(c, i18n.language)}
          />
        </div>
      )}
    </div>
  );
};

export default PaymentsByMethodCards;

export interface DeliveryFeesData {
  total?: number;
  count?: number;
}

interface DeliveryFeesCardsProps {
  data: DeliveryFeesData | null;
  formatCurrency: (n: number) => string;
}

/** إجماليات رسوم التوصيل — تتبع فلتر التاريخ للصفحة. */
export const DeliveryFeesCards: React.FC<DeliveryFeesCardsProps> = ({ data, formatCurrency }) => {
  const { t, i18n } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <div className="mt-3 sm:mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs sm:text-sm font-extrabold text-gray-700 dark:text-gray-200">
          🛵 {t('reports.deliveryFees.title', 'رسوم التوصيل')}
        </div>
        <button
          onClick={() => setVisible(v => !v)}
          title={visible ? t('reports.hideAmount', 'إخفاء المبالغ') : t('reports.showAmount', 'إظهار المبالغ')}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {visible && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-sky-600 dark:bg-sky-700 rounded-xl shadow-sm px-2 py-2 text-center col-span-2 sm:col-span-1">
            <div className="text-[11px] font-bold text-sky-100">
              {t('reports.paymentsByMethod.total', 'الإجمالي')}
            </div>
            <div className="text-sm sm:text-base font-extrabold text-white">
              {formatCurrency(Number(data?.total) || 0)}
            </div>
            <div className="text-[10px] text-sky-200">
              {billsCountLabel(data?.count, i18n.language)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DRAWER_CARD_STYLES: Record<string, string> = {
  cashier: 'text-sky-600 dark:text-sky-400',
  hall: 'text-green-600 dark:text-green-400',
  takeaway: 'text-orange-600 dark:text-orange-400',
  delivery: 'text-blue-600 dark:text-blue-400',
  safe: 'text-amber-600 dark:text-amber-400',
};

export interface DrawersBreakdownData {
  drawers?: Record<string, MethodTotals>;
  discounts?: DiscountTotals;
  outstanding?: number;
  total?: number;
  count?: number;
}

interface DrawerBreakdownCardsProps {
  data: DrawersBreakdownData | null;
  formatCurrency: (n: number) => string;
}

/** إجماليات المدفوعات حسب الدرج — تتبع فلتر التاريخ للصفحة. */
export const DrawerBreakdownCards: React.FC<DrawerBreakdownCardsProps> = ({ data, formatCurrency }) => {
  const { t, i18n } = useTranslation();
  const [visible, setVisible] = useState(false);

  const drawers = data?.drawers || {};

  return (
    <div className="mt-3 sm:mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs sm:text-sm font-extrabold text-gray-700 dark:text-gray-200">
          {t('reports.paymentsByDrawer.title', 'المدفوعات حسب الدرج')}
        </div>
        <button
          onClick={() => setVisible(v => !v)}
          title={visible ? t('reports.hideAmount', 'إخفاء المبالغ') : t('reports.showAmount', 'إظهار المبالغ')}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {visible && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {CASH_DRAWERS.map(d => (
            <div key={d} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 px-2 py-2 text-center">
              <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
                {drawerIcon(d)} {drawerLabel(d, t)}
              </div>
              <div className={`text-sm sm:text-base font-extrabold ${DRAWER_CARD_STYLES[d]}`}>
                {formatCurrency(Number(drawers[d]?.total) || 0)}
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500">
                {paymentCountLabel(drawers[d]?.count, i18n.language)}
              </div>
            </div>
          ))}
          <GrandTotalCard
            total={data?.total}
            count={data?.count}
            discounts={data?.discounts}
            outstanding={data?.outstanding}
            formatCurrency={formatCurrency}
            t={t as (k: string, fb?: string) => string}
            countLabel={(c) => paymentCountLabel(c, i18n.language)}
          />
        </div>
      )}
    </div>
  );
};
