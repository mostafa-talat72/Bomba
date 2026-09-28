import type { TFunction } from 'i18next';

export type CashDrawer = 'cashier' | 'hall' | 'takeaway' | 'delivery' | 'safe';

export const CASH_DRAWERS: CashDrawer[] = ['cashier', 'hall', 'takeaway', 'delivery', 'safe'];

const DRAWER_KEYS: Record<CashDrawer, string> = {
  cashier: 'billing.drawerCashier',
  hall: 'billing.drawerHall',
  takeaway: 'billing.drawerTakeaway',
  delivery: 'billing.drawerDelivery',
  safe: 'billing.drawerSafe',
};

const DRAWER_ICONS: Record<CashDrawer, string> = {
  cashier: '🧮',
  hall: '🪑',
  takeaway: '🥡',
  delivery: '🛵',
  safe: '🔐',
};

// يظهر عند غياب المفتاح من ملف لغة ما — حتى لا يظهر مفتاح خام للمستخدم.
const DRAWER_FALLBACKS: Record<CashDrawer, string> = {
  cashier: 'درج الكاشير',
  hall: 'درج الصالة',
  takeaway: 'درج التيك أوي',
  delivery: 'درج الدليفري',
  safe: 'درج الخزينة',
};

export function isCashDrawer(d: unknown): d is CashDrawer {
  return d === 'cashier' || d === 'hall' || d === 'takeaway' || d === 'delivery' || d === 'safe';
}

/** اسم الدرج مترجماً حسب اللغة الحالية. */
export function drawerLabel(drawer: string | undefined | null, t: TFunction): string {
  if (!drawer) return '';
  if (!isCashDrawer(drawer)) return drawer;
  return t(DRAWER_KEYS[drawer], { defaultValue: DRAWER_FALLBACKS[drawer] });
}

/** أيقونة الدرج. */
export function drawerIcon(drawer: string | undefined | null): string {
  if (!isCashDrawer(drawer)) return '';
  return DRAWER_ICONS[drawer];
}

/** الدرج التلقائي حسب نوع الفاتورة — وأي قيمة غير معروفة تقع على الخزينة. */
export function defaultDrawerForFulfillment(fulfillmentType: string | undefined | null): CashDrawer {
  if (fulfillmentType === 'dine_in') return 'hall';
  if (fulfillmentType === 'takeaway') return 'takeaway';
  if (fulfillmentType === 'delivery') return 'delivery';
  return 'safe';
}

/** تطبيع أي قيمة درج قادمة من السيرفر/الداتا القديمة — الناقص = الخزينة. */
export function normalizeDrawer(d: unknown): CashDrawer {
  return isCashDrawer(d) ? d : 'safe';
}
