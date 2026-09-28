import type { User } from '../services/api';

/** User's own print settings when they opted in, otherwise null (fall back to org). */
export function resolveUserPrintSettings(user: Partial<User> | any): Record<string, any> | null {
  if (!user || user.useCustomPrintSettings !== true) return null;
  const ps = user.printSettings;
  if (!ps || typeof ps !== 'object' || Array.isArray(ps)) return null;
  return Object.keys(ps).length ? { ...ps } : null;
}

/**
 * Effective print settings resolution (STRICT, no merge — mirrors server
 * resolvePrintSettingsForUser): user custom settings over organization
 * settings. Device-specific printer path keeps resolving from
 * devicePrinters on the caller side.
 */
export function resolveEffectivePrintSettings(
  user: Partial<User> | any,
  organization?: any
): Record<string, any> {
  const userPs = resolveUserPrintSettings(user);
  if (userPs) return { ...userPs };
  const org = organization || user?.organization;
  const orgPs = org?.printSettings && typeof org.printSettings === 'object' ? org.printSettings : {};
  return { ...orgPs };
}

export type PrintFulfillment = 'dine_in' | 'takeaway' | 'delivery';

/** لاحقة مفاتيح النوع: الطاولات بلا لاحقة (المفاتيح الأساسية)، تيك أوي/دليفري بلاحقة. */
export function fulfillmentSuffix(fulfillment?: string): '' | 'Takeaway' | 'Delivery' {
  if (fulfillment === 'takeaway') return 'Takeaway';
  if (fulfillment === 'delivery') return 'Delivery';
  return '';
}

/**
 * حل قيمة أتمتة حسب النوع: الخاص أولاً ثم العام (مثل التوجيه والنسخ).
 * الفارغ يتبع الطاولات — لا سلوك جديد حتى يضبط المستخدم النوع صراحةً.
 */
export function resolveFulfillmentValue<T>(
  settings: any,
  base: string,
  fulfillment?: string,
  fallback?: T
): T | undefined {
  const sfx = fulfillmentSuffix(fulfillment);
  if (sfx) {
    const specific = (settings as any)?.[`${base}${sfx}`];
    if (specific !== undefined) return specific as T;
  }
  const general = (settings as any)?.[base];
  return (general !== undefined ? general : fallback) as T | undefined;
}

/**
 * طابعات نسخ المستند: الخاص أولاً ثم العام — الفارغ = الافتراضي (نسخة واحدة للطابعة الأساسية).
 * مرآتها على السيرفر: printController.resolveDocCopyPrinters — أي تغيير هنا يُعكس هناك.
 */
export function resolveDocCopyPrinters(settings: any, key: string, fallbackKey?: string): string[] {
  const readList = (obj: any, k: string): string[] | undefined => {
    if (!obj) return undefined;
    let v: any;
    try { v = typeof obj.get === 'function' ? obj.get(k) : obj[k]; } catch { return undefined; }
    if (!Array.isArray(v) || v.length === 0) return undefined;
    return v.slice(0, 5).map((x) => String(x || ''));
  };
  const arr = readList((settings as any)?.documentCopyPrinters, key)
    ?? (fallbackKey ? readList((settings as any)?.documentCopyPrinters, fallbackKey) : undefined);
  if (arr) return arr;
  const raw = (settings as any)?.documentCopies?.[key]
    ?? (fallbackKey ? (settings as any)?.documentCopies?.[fallbackKey] : undefined)
    ?? 1;
  const n = Math.min(5, Math.max(1, Number(raw) || 1));
  return Array(n).fill('');
}

/** حل طابعات النسخ لكل قسم على حدة — يرجع مصفوفة طابعات النسخ لكل sectionId.
 *  المفتاح في الإعدادات: sectionCopyPrinterMap / sectionCopyPrinterMapTakeaway / sectionCopyPrinterMapDelivery
 *  القيمة: { [sectionId]: string[] } — مصفوفة IDs طابعات النسخ لكل قسم.
 */
export function resolveSectionCopyPrinters(settings: any, fulfillment: string | undefined, docType?: string): Record<string, string[]> {
  // فواتير الطاولات/تيك أوي/دليفري تستخدم نفس مفاتيح التحضير
  // فواتير البيع (bill/takeaway/delivery) و تقرير الاستهلاك تستخدم مفاتيح خاصة بها
  let mapKey = '';
  
  if (docType === 'bill' || docType === 'bill_takeaway' || docType === 'bill_delivery') {
    mapKey = docType === 'bill_takeaway' ? 'sectionCopyPrinterMapTakeaway'
      : docType === 'bill_delivery' ? 'sectionCopyPrinterMapDelivery'
      : 'sectionCopyPrinterMap';
  } else if (docType === 'consumptionReport') {
    mapKey = 'sectionCopyPrinterMapConsumption';
  } else if (fulfillment === 'takeaway') {
    mapKey = 'sectionCopyPrinterMapTakeaway';
  } else if (fulfillment === 'delivery') {
    mapKey = 'sectionCopyPrinterMapDelivery';
  } else {
    mapKey = 'sectionCopyPrinterMap';
  }
  
  const obj = (settings as any)?.[mapKey];
  if (!obj) return {};
  try {
    const entries = typeof obj.get === 'function' ? obj.entries() : Object.entries(obj);
    const result: Record<string, string[]> = {};
    for (const [sectionId, printers] of entries) {
      const arr = Array.isArray(printers) ? printers.slice(0, 5).map((x) => String(x || '')) : [];
      result[String(sectionId)] = arr.filter(Boolean);
    }
    return result;
  } catch {
    return {};
  }
}

/** نسخة بوليانية: غير المضبوط = القيمة الافتراضية للمستهلك. */
export function resolveFulfillmentFlag(
  settings: any,
  base: string,
  fulfillment?: string,
  def = false
): boolean {
  const v = resolveFulfillmentValue(settings, base, fulfillment, undefined);
  return v === undefined ? def : v === true;
}
