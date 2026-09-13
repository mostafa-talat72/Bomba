import type { TFunction } from 'i18next';

export interface ActivityPayload {
  kind: 'order' | 'bill' | 'session' | 'table';
  action: string;
  number?: string | number | null;
  status?: string | null;
  tableId?: string | null;
  tableNumber?: string | number | null;
  fromTableNumber?: string | number | null;
  billId?: string | null;
  billNumber?: string | null;
  deviceName?: string | null;
  fulfillment?: string | null;
  actor?: { name?: string | null; source?: string | null; userId?: string | null } | null;
  at?: string;
}

// تطبيع أنواع السوكت الخام إلى مفاتيح activity (payment-received ← paid ...).
function normalizeAction(kind: string, action: string, status?: string | null): string {
  const a = String(action || '');
  if (kind === 'bill' && (a === 'payment-received' || a === 'paid')) return 'paid';
  if (kind === 'bill' && a === 'partial-payment') return 'partial';
  if (kind === 'order' && a === 'updated' && status === 'ready') return 'ready';
  if (kind === 'order' && a === 'item-delivered') return 'delivered';
  if (kind === 'session' && a === 'controllers-changed') return 'updated';
  if (['created', 'updated', 'deleted', 'ready', 'paid', 'partial', 'started', 'ended', 'delivered', 'transferred'].includes(a)) return a;
  if (kind === 'session' && a === 'created') return 'started';
  if (kind === 'session' && a === 'deleted') return 'ended';
  return 'updated';
}

const KIND_KEYS: Record<string, string> = { order: 'order', bill: 'bill', session: 'session', table: 'table' };

/**
 * نص توست موحد لأي نشاط (إضافة/تعديل/حذف/دفع...) بنفس شكل إشعارات النظام:
 * جملة الفعل + السياق العلاقي (طاولة/فاتورة/جهاز) + الفاعل وجهازه.
 * تُبنى بلغة المشاهِد عبر i18n.
 */
export function buildActivityToast(
  payload: ActivityPayload,
  t: TFunction,
  language: string = 'ar'
): { text: string; toastType: 'success' | 'error' | 'warning' | 'info' } {
  const kind = KIND_KEYS[payload.kind] || 'order';
  const action = normalizeAction(kind, payload.action, payload.status);
  const number = payload.number ?? '';
  const device = payload.deviceName ?? '';
  const from = (payload as any).fromTableNumber ?? '';
  const base = t(`activity.${kind}.${action}`, { number, device, from, table: payload.tableNumber ?? '', defaultValue: '' } as any) as string;
  const parts: string[] = [];
  if (base) parts.push(base);
  // النقل يحمل الطاولتين في نصه — لا تكرر.
  if (action !== 'transferred' && payload.tableNumber !== null && payload.tableNumber !== undefined && payload.tableNumber !== '') {
    parts.push(`${t('activity.tableWord', { defaultValue: '' })} ${payload.tableNumber}`.trim());
  }
  if (payload.billNumber) {
    // لا تكرر رقم الفاتورة إن كان هو الرقم الأساسي (حالة الفاتورة نفسها)
    if (kind !== 'bill' || String(payload.billNumber) !== String(number)) {
      parts.push(`${t('activity.billWord', { defaultValue: '' })} ${payload.billNumber}`.trim());
    }
  }
  let text = parts.filter(Boolean).join(' — ') || (t('activity.updatedGeneric', { defaultValue: '' }) as string) || '•';
  // نوع الفاتورة/الطلب (دليفري/تيك أوي/طاولة) — بادئة مميزة.
  if (kind === 'bill' && payload.fulfillment && payload.fulfillment !== 'dine_in') {
    const icon = payload.fulfillment === 'delivery' ? '🛵' : '🥡';
    const word = t(`activity.fulfill.${payload.fulfillment}`, { defaultValue: '' }) as string;
    if (word) text = `${icon} ${word} — ${text}`;
  } else if (kind === 'bill' && payload.tableNumber !== null && payload.tableNumber !== undefined && payload.tableNumber !== '') {
    // فاتورة طاولة: أيقونة تمييز مع الرقم (بدل كلمة طاولة العادية).
    text = text.replace(
      `${t('activity.tableWord', { defaultValue: '' })} ${payload.tableNumber}`.trim(),
      `🪑 ${t('activity.tableWord', { defaultValue: '' })} ${payload.tableNumber}`.trim()
    );
  }
  const actorName = payload.actor?.name || '';
  if (actorName) {
    const suffix = payload.actor?.source === 'mobile'
      ? `${actorName} (${t('activity.phoneTag', { defaultValue: '' })})`
      : actorName;
    text = `${text} — ${suffix}`;
  }
  const toastType =
    action === 'deleted' ? 'error'
    : action === 'created' || action === 'started' || action === 'ready' || action === 'paid' || action === 'delivered' ? 'success'
    : 'info';
  void language;
  return { text, toastType };
}
