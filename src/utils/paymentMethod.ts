import type { TFunction } from 'i18next';
import { formatDecimal } from './formatters';

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'e_wallet';

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'transfer', 'e_wallet'];

const METHOD_KEYS: Record<PaymentMethod, string> = {
  cash: 'billing.paymentMethodCash',
  card: 'billing.paymentMethodCard',
  transfer: 'billing.paymentMethodTransfer',
  e_wallet: 'billing.paymentMethodWallet',
};

const METHOD_ICONS: Record<PaymentMethod, string> = {
  cash: '💵',
  card: '💳',
  transfer: '🏦',
  e_wallet: '👛',
};

// يظهر عند غياب المفتاح من ملف لغة ما — حتى لا يظهر مفتاح خام للمستخدم.
const METHOD_FALLBACKS: Record<PaymentMethod, string> = {
  cash: 'نقدي',
  card: 'بطاقة',
  transfer: 'تحويل',
  e_wallet: 'محفظة',
};

export function isPaymentMethod(m: unknown): m is PaymentMethod {
  return m === 'cash' || m === 'card' || m === 'transfer' || m === 'e_wallet';
}

/** اسم طريقة الدفع مترجماً حسب اللغة الحالية. */
export function paymentMethodLabel(method: string | undefined | null, t: TFunction): string {
  if (!method) return '';
  if (!isPaymentMethod(method)) return method;
  return t(METHOD_KEYS[method], { defaultValue: METHOD_FALLBACKS[method] });
}

/** أيقونة طريقة الدفع. */
export function paymentMethodIcon(method: string | undefined | null): string {
  if (!isPaymentMethod(method)) return '';
  return METHOD_ICONS[method];
}

/** نص العدد بصيغة الجمع الصحيحة حسب اللغة (دفعة/دفعتان/دفعات...). */
export function paymentCountLabel(count: number | undefined | null, lang?: string): string {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  const l = (lang || 'ar').split('-')[0].toLowerCase();
  const num = formatDecimal(n, l);
  if (l === 'ar') {
    if (n === 0) return 'لا مدفوعات';
    if (n === 1) return 'دفعة واحدة';
    if (n === 2) return 'دفعتان';
    if (n <= 10) return `${num} دفعات`;
    return `${num} دفعة`;
  }
  if (l === 'fr') return `${num} ${n <= 1 ? 'paiement' : 'paiements'}`;
  return `${num} ${n === 1 ? 'payment' : 'payments'}`;
}
