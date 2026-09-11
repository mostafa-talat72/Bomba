import type { UserNotificationPrefs } from '../services/api/users';

export type ToastKind = 'order' | 'bill' | 'session' | 'table' | 'inventory' | 'system';

const KINDS: ToastKind[] = ['order', 'bill', 'session', 'table', 'inventory', 'system'];

export const DEFAULT_NOTIF_PREFS: UserNotificationPrefs = {
  toastKinds: { order: true, bill: true, session: true, table: true, inventory: true, system: true },
  sound: true,
  kitchenAlarm: false,
};

function readLocalSettings(): any {
  try {
    return JSON.parse(localStorage.getItem('notificationSettings') || '{}');
  } catch {
    return {};
  }
}

/** تفضيلات المستخدم من السيرفر مدمجة فوق الافتراضي (الغائب = مفعّل، ما عدا منبه المطبخ). */
export function getServerNotifPrefs(user?: any): UserNotificationPrefs {
  const p = (user as any)?.preferences?.notifications || {};
  const kinds: Record<ToastKind, boolean> = { ...DEFAULT_NOTIF_PREFS.toastKinds } as Record<ToastKind, boolean>;
  for (const k of KINDS) {
    if (p.toastKinds && (p.toastKinds as any)[k] !== undefined) {
      kinds[k] = (p.toastKinds as any)[k] !== false;
    }
  }
  return {
    toastKinds: kinds,
    sound: p.sound !== undefined ? p.sound !== false : true,
    kitchenAlarm: p.kitchenAlarm === true,
  };
}

/** التوست مسموح؟ سيرفر المستخدم AND عدم كتم الجهاز. */
export function isToastKindEnabled(user: any, kind: string): boolean {
  try {
    const server = getServerNotifPrefs(user).toastKinds[kind as ToastKind];
    if (server === false) return false;
    const local = readLocalSettings();
    if (local?.mutedActivityKinds?.[kind] === true) return false;
    return true;
  } catch {
    return true;
  }
}

/** الصوت مسموح؟ سيرفر AND جهاز. */
export function isSoundOn(user?: any): boolean {
  try {
    if (getServerNotifPrefs(user).sound === false) return false;
    const local = readLocalSettings();
    return local?.soundEnabled !== false;
  } catch {
    return true;
  }
}

/** منبه المطبخ؟ سيرفر OR جهاز OR دور المطبخ. */
export function isKitchenAlarmOn(user?: any): boolean {
  try {
    if (getServerNotifPrefs(user).kitchenAlarm === true) return true;
    const local = readLocalSettings();
    if (local?.kitchenAlarmMode === true) return true;
    return (user as any)?.role === 'kitchen';
  } catch {
    return false;
  }
}
